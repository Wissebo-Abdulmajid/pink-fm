import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { projectRoot } from './catalog-shared.ts'

type Candidate = {
  label: string
  modelId: string
  revision: string
  dtype: 'q8' | 'q4'
  pooling: 'mean' | 'cls'
  downloadBytes: number
  notes: string
}

type ModelReport = {
  mode: string
  overall: { directAccuracy: number; moodF1: number }
  groups: Record<string, { directAccuracy: number; moodF1: number }>
  metrics: {
    negationAccuracy: number
    clarificationAppropriateness: number
    contextFollowUpAccuracy: number
  }
  grounding: {
    hallucinatedCatalogueTracks: number
    unsupportedFactualClaims: number
    lyricOutputCount: number
  }
  performance: Record<string, unknown>
}

const candidates: Candidate[] = [
  {
    label: 'paraphrase-minilm-q8',
    modelId: 'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
    revision: '2c4055b12046f11709e9df2c122e59ffbdc2f900',
    dtype: 'q8',
    pooling: 'mean',
    downloadBytes: 135_392_208,
    notes: 'Established browser-compatible multilingual sentence model; similar footprint to the current E5 model.',
  },
  {
    label: 'granite-97m-q8',
    modelId: 'onnx-community/granite-embedding-97m-multilingual-r2-ONNX',
    revision: '536a9f241cb3f02a9c5995a1e708c784bd274859',
    dtype: 'q8',
    pooling: 'cls',
    downloadBytes: 123_173_845,
    notes: 'IBM Granite 97M multilingual R2 in standard int8-compatible Transformers.js packaging.',
  },
  {
    label: 'granite-97m-gbq4',
    modelId: 'tooape/granite-embedding-97m-multilingual-r2-GBQ4-ONNX',
    revision: '54db88c5667bd79b4aea24ea6027a7ef45a7bbb5',
    dtype: 'q4',
    pooling: 'cls',
    downloadBytes: 86_565_293,
    notes: 'Community GBQ4 conversion of IBM Granite 97M; smallest technically compatible multilingual candidate found.',
  },
]

const tsxCli = resolve(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs')

const run = (args: string[]) => {
  execFileSync(process.execPath, [tsxCli, resolve(projectRoot, 'scripts', 'evaluate-hidden-bot.ts'), ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
  })
}

const currentOutput = 'docs/phase-3-model-current-e5.json'
run(['--enhanced-current', '--output', currentOutput])

for (const candidate of candidates) {
  run([
    '--benchmark-model', candidate.modelId,
    '--model-revision', candidate.revision,
    '--model-dtype', candidate.dtype,
    '--model-pooling', candidate.pooling,
    '--model-label', candidate.label,
    '--download-bytes', String(candidate.downloadBytes),
    '--output', `docs/phase-3-model-${candidate.label}.json`,
  ])
}

const readReport = (path: string) => JSON.parse(
  readFileSync(resolve(projectRoot, path), 'utf8'),
) as ModelReport

const results = [
  {
    label: 'current-e5-q8',
    modelId: 'Xenova/multilingual-e5-small',
    revision: '761b726dd34fb83930e26aab4e9ac3899aa1fa78',
    dtype: 'q8',
    pooling: 'mean',
    downloadBytes: 135_392_674,
    notes: 'Phase 2 comparator; remains optional and is never loaded automatically.',
    report: readReport(currentOutput),
  },
  ...candidates.map((candidate) => ({
    ...candidate,
    report: readReport(`docs/phase-3-model-${candidate.label}.json`),
  })),
].map((item) => ({
  label: item.label,
  modelId: item.modelId,
  revision: item.revision,
  dtype: item.dtype,
  pooling: item.pooling,
  downloadBytes: item.downloadBytes,
  downloadMiB: Number((item.downloadBytes / 1024 / 1024).toFixed(1)),
  notes: item.notes,
  metrics: {
    overallAccuracy: item.report.overall.directAccuracy,
    moodF1: item.report.overall.moodF1,
    englishAccuracy: item.report.groups.en?.directAccuracy ?? null,
    malayAccuracy: item.report.groups.ms?.directAccuracy ?? null,
    mixedAccuracy: item.report.groups.mixed?.directAccuracy ?? null,
    indirectAccuracy: item.report.groups.indirect?.directAccuracy ?? null,
    negationAccuracy: item.report.metrics.negationAccuracy,
    clarificationAccuracy: item.report.metrics.clarificationAppropriateness,
    contextAccuracy: item.report.metrics.contextFollowUpAccuracy,
  },
  grounding: item.report.grounding,
  performance: item.report.performance,
}))

const report = {
  schemaVersion: 1,
  createdAt: new Date().toISOString(),
  environment: 'Windows desktop, Node CPU. These are comparative build-machine measurements, not mobile browser claims.',
  frozenDataset: 'evaluation/hidden/holdout.json',
  candidates: results,
}
writeFileSync(
  resolve(projectRoot, 'docs', 'phase-3-model-benchmark.json'),
  `${JSON.stringify(report, null, 2)}\n`,
)

const percent = (value: number | null) => value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`
const markdown = [
  '# Phase 3 semantic-model benchmark',
  '',
  `Generated: ${report.createdAt}`,
  '',
  'The holdout was frozen before Phase 3 tuning. Timings below come from this Windows desktop under Node CPU and must not be represented as phone timings.',
  '',
  '| Option | Download | EN | MS | Mixed | Mood F1 | Init | First | Repeat |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
  ...results.map((item) => {
    const timing = item.performance as Record<string, number>
    return `| ${item.label} | ${item.downloadMiB} MiB | ${percent(item.metrics.englishAccuracy)} | ${percent(item.metrics.malayAccuracy)} | ${percent(item.metrics.mixedAccuracy)} | ${percent(item.metrics.moodF1)} | ${timing.modelLoadMs ?? 'n/a'} ms | ${timing.firstInferenceMs ?? 'n/a'} ms | ${timing.repeatInferenceMs ?? 'n/a'} ms |`
  }),
  '',
  '## Notes',
  '',
  ...results.map((item) => `- **${item.label}:** ${item.notes}`),
  '',
  'No model is selected by size alone. Pink FM retains instant mode as the default, and any enhanced model remains an explicit listener-approved download.',
  '',
].join('\n')
writeFileSync(resolve(projectRoot, 'docs', 'phase-3-model-benchmark.md'), markdown)
console.log('Combined benchmark: docs/phase-3-model-benchmark.json')
