import { readFile, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))
const slug = process.argv.find((arg) => arg.startsWith('--slug='))?.slice('--slug='.length) ?? 'siti'
const profileRoot = resolve(projectRoot, 'public', 'gifts', slug)
const docsRoot = resolve(projectRoot, 'docs')

const tracks = JSON.parse(await readFile(resolve(profileRoot, 'tracks.json'), 'utf8')).tracks
const sources = tracks.flatMap((track) =>
  (track.fullPlaybackSources ?? []).map((source) => ({
    trackId: track.id,
    sourceId: source.id,
    videoId: source.videoId,
  })),
)

const checks = []
for (const source of sources) {
  try {
    const response = await fetch(`https://www.youtube-nocookie.com/embed/${source.videoId}`, {
      redirect: 'manual',
    })
    checks.push({
      ...source,
      ok: response.status >= 200 && response.status < 400,
      status: response.status,
    })
  } catch (error) {
    checks.push({
      ...source,
      ok: false,
      status: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
}

const report = {
  slug,
  checkedAt: new Date().toISOString(),
  checkedSources: checks.length,
  failedSources: checks.filter((check) => !check.ok).length,
  checks,
}

await mkdir(docsRoot, { recursive: true })
await import('node:fs/promises').then(({ writeFile }) =>
  writeFile(resolve(docsRoot, 'phase-4-1-youtube-embed-check.json'), `${JSON.stringify(report, null, 2)}\n`),
)

console.log(`YouTube embed check: ${checks.length} source(s), ${report.failedSources} failed.`)
if (report.failedSources > 0) process.exitCode = 1
