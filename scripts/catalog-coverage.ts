import { resolve } from 'node:path'
import { auditCatalog } from './catalog-audit.ts'
import {
  argumentValue,
  loadCatalog,
  sortedCounts,
  writeJsonFile,
} from './catalog-shared.ts'

const slug = argumentValue('--slug') ?? 'siti'
const catalog = loadCatalog(slug)
const report = auditCatalog(slug, catalog)

const section = (label: string, values: Record<string, number>) => {
  console.log('\n' + label)
  for (const [name, count] of sortedCounts(values)) {
    console.log('  ' + name + ': ' + count)
  }
}

console.log('Pink FM catalogue coverage: ' + slug)
console.log('Unique tracks: ' + report.totals.unique)
console.log('Active tracks: ' + report.totals.active)
console.log('Recommendation-ready: ' + report.totals.recommendationReady)
console.log('Reviewed: ' + report.totals.reviewed)
console.log('Verified metadata: ' + report.totals.verifiedMetadata)
console.log('Provisional: ' + report.totals.provisional)
console.log('Albums represented: ' + report.totals.albums)

section('Era coverage', report.byEra)
section('Mood coverage', report.byPrimaryMood)
section('Collection coverage', report.byCollection)
section('Version coverage', report.byVersionType)

const output = argumentValue('--json')
if (output) {
  const outputPath = resolve(process.cwd(), output)
  writeJsonFile(outputPath, report)
  console.log('\nWrote coverage report: ' + outputPath)
}
