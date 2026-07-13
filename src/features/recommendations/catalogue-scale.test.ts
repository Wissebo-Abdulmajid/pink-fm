import tracksJson from '../../../public/gifts/siti/tracks.json?raw'
import collectionsJson from '../../../public/gifts/siti/collections.json?raw'
import sourcesJson from '../../../public/gifts/siti/catalog-sources.json?raw'
import {
  catalogSourcesSchema,
  collectionsFileSchema,
  moodDimensionKeys,
  tracksFileSchema,
} from '../../config/schemas'

const tracksFile = tracksFileSchema.parse(JSON.parse(tracksJson) as unknown)
const collectionsFile = collectionsFileSchema.parse(JSON.parse(collectionsJson) as unknown)
const sources = catalogSourcesSchema.parse(JSON.parse(sourcesJson) as unknown)
const active = tracksFile.tracks.filter((track) => track.active)

describe('production Siti catalogue scale and coverage', () => {
  it('meets the verified launch and reviewed recommendation-ready targets', () => {
    expect(active.length).toBeGreaterThanOrEqual(80)
    expect(active.filter((track) => track.curationStatus === 'reviewed').length).toBeGreaterThanOrEqual(60)
    expect(active.every((track) => track.curationStatus !== 'provisional')).toBe(true)
  })

  it('contains unique track IDs and no duplicate primary recording keys', () => {
    expect(new Set(active.map((track) => track.id)).size).toBe(active.length)
    const keys = active.map((track) => [
      track.title.toLocaleLowerCase('en').replace(/[^a-z0-9]+/g, ' ').trim(),
      track.primaryArtistId,
      track.versionType,
      [...track.featuredArtistIds].sort().join(','),
    ].join('|'))
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('represents broad release eras and albums', () => {
    expect(new Set(active.map((track) => track.era)).size).toBeGreaterThanOrEqual(6)
    expect(new Set(active.map((track) => track.albumId).filter(Boolean)).size).toBeGreaterThanOrEqual(25)
    const years = active.flatMap((track) => track.releaseYear ? [track.releaseYear] : [])
    expect(Math.min(...years)).toBeLessThanOrEqual(1996)
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2025)
  })

  it.each(moodDimensionKeys)('has meaningful reviewed coverage for %s', (mood) => {
    const covered = active.filter(
      (track) => track.curationStatus === 'reviewed' && track.moods[mood] >= 65,
    )
    expect(covered.length).toBeGreaterThanOrEqual(20)
  })

  it('keeps collections data-driven and populated', () => {
    const activeCollections = collectionsFile.collections.filter((collection) => collection.active)
    expect(activeCollections.length).toBeGreaterThanOrEqual(10)
    for (const collection of activeCollections) {
      expect(active.filter((track) => track.collections.includes(collection.id)).length).toBeGreaterThanOrEqual(5)
    }
    expect(collectionsFile.collections.find((item) => item.id === 'malaysian-legends')?.active).toBe(false)
  })

  it('has an HTTPS official destination and provenance for every active track', () => {
    for (const track of active) {
      expect(Object.values(track.officialLinks).some((link) => link.startsWith('https://'))).toBe(true)
      expect(track.sourceIds.length).toBeGreaterThan(0)
      expect(sources.trackVerification[track.id]).toBeDefined()
      expect(sources.trackVerification[track.id]?.sourceIds.length).toBeGreaterThan(0)
    }
  })

  it('uses conservative confidence for metadata-only records', () => {
    const metadataOnly = active.filter((track) => track.curationStatus === 'verified-metadata')
    expect(metadataOnly.length).toBeGreaterThan(0)
    expect(metadataOnly.every((track) => track.curationConfidence <= 0.78)).toBe(true)
  })
})
