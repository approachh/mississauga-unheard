// Copies the speech-evaluation outputs from the analysis branch into frontend/data/speech/,
// verbatim, and records which commit they came from. Nothing is checked out or modified.
//
//   npm run data:speech:pull            (default ref: origin/feature/speech-evaluation)
//   node scripts/pull-speech.mjs <git-ref>
//
// Then run `npm run data:speech` and `npm run data:index`.

import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = join(here, '..', 'data', 'speech')
const ref = process.argv[2] ?? 'origin/feature/speech-evaluation'
const FILES = ['speech_results.csv', 'speech_summary.csv']

const git = (...args) => execFileSync('git', args, { cwd: here, maxBuffer: 64 * 1024 * 1024 })
const commit = git('rev-parse', ref).toString().trim()
for (const f of FILES) writeFileSync(join(outDir, f), git('show', `${commit}:analysis/outputs/${f}`))
writeFileSync(
  join(outDir, 'source.json'),
  JSON.stringify({ ref, commit, files: FILES.map((f) => `analysis/outputs/${f}`), pulled: new Date().toISOString().slice(0, 10) }, null, 2) + '\n',
)
console.log(`Copied ${FILES.join(', ')} from ${ref} @ ${commit.slice(0, 7)}`)
