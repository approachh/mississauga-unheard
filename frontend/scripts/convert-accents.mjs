// Converts the accented-English evaluation (Speech Accent Archive) into frontend/public/data/accent_results.json.
//
//   npm run data:accents   (reads frontend/data/speech/, writes frontend/public/data/)
//   node scripts/convert-accents.mjs <input-dir> <output-dir>
//
// Inputs (copied verbatim from analysis/outputs/ by `npm run data:speech:pull`):
//   speech_results.csv  one row per recording
//   speech_summary.csv  one row per group, with the analysis team's bootstrap 95% ranges
// Only rows with dataset = "accent" are used; FLEURS rows are handled by convert-speech.mjs.
//
// Every speaker reads the same English paragraph. Groups are the speaker's native language, and
// "English" (native speakers) is the baseline.
//
// Privacy, by design: the published file holds scores and what the AI wrote, nothing about who
// the speakers are. No file names, no age, gender or country, no audio. Each group's speaker
// scores are an unlabelled, sorted list, so individual variation is visible but nobody can be
// identified or looked up.
//
// Nothing is re-scored: WER and CER are the analysis pipeline's own values.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { onlyDataset, parseCsv as readCsv } from './lib/csv.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const inDir = process.argv[2] ?? join(here, '..', 'data', 'speech')
const outDir = process.argv[3] ?? join(here, '..', 'public', 'data')
const NATIVE = 'English'
const ALIASES = { 'mandarin chinese': 'Mandarin' }
const harmonise = (name) => ALIASES[name.trim().toLowerCase()] ?? name.trim()

const num = (v) => (v === '' || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const round = (x, d = 6) => Math.round(x * 10 ** d) / 10 ** d
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length
const median = (sorted) => (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
const tidy = (s) => s.replace(/\s+/g, ' ').trim()

const rows = onlyDataset(readCsv(inDir, 'speech_results.csv'), 'accent', 'speech_results.csv')
const summary = onlyDataset(readCsv(inDir, 'speech_summary.csv'), 'accent', 'speech_summary.csv')
if (!rows.length) {
  console.log('No accent rows found: accent_results.json not written.')
  process.exit(0)
}

// Validate: auto mode only, scored, one shared paragraph.
const bad = rows.filter((r) => r.mode !== 'auto' || num(r.wer) === null || num(r.cer) === null)
if (bad.length) throw new Error(`${bad.length} accent rows are not scored auto-mode recordings`)
const passages = new Set(rows.map((r) => tidy(r.reference)))
if (passages.size !== 1) console.log(`  WARNING: ${passages.size} different reference texts; using the first`)
const passage = tidy(rows[0].reference)

const summaryOf = new Map(summary.map((s) => [harmonise(s.language), s]))

const groupsByName = new Map()
for (const r of rows) {
  const name = harmonise(r.language)
  if (!groupsByName.has(name)) groupsByName.set(name, [])
  groupsByName.get(name).push({ wer: num(r.wer), cer: num(r.cer), heard: tidy(r.prediction ?? ''), mismatch: /^true$/i.test(r.language_mismatch), tie: r.file })
}

function buildGroup(language, clips) {
  // Deterministic order; the tie-break on file name is used only for ordering and never published.
  const sorted = [...clips].sort((a, b) => a.wer - b.wer || a.cer - b.cer || a.tie.localeCompare(b.tie))
  const wers = sorted.map((c) => c.wer)
  const typical = sorted[Math.floor((sorted.length - 1) / 2)]
  const highest = sorted[sorted.length - 1]
  const s = summaryOf.get(language)
  const ci = s && num(s.wer_ci_low) !== null && num(s.wer_ci_high) !== null ? [round(num(s.wer_ci_low)), round(num(s.wer_ci_high))] : null
  const m = mean(wers)
  if (s && num(s.mean_wer) !== null && Math.abs(num(s.mean_wer) - m) > 0.0006) console.log(`  WARNING: ${language} mean WER ${m.toFixed(4)} differs from the summary ${s.mean_wer}`)
  return {
    language,
    speakers: sorted.length,
    wer: round(m),
    wer_ci: ci,
    median_wer: round(median(wers)),
    highest_wer: round(highest.wer),
    wer_without_highest: sorted.length > 1 ? round(mean(wers.slice(0, -1))) : null,
    cer: round(mean(sorted.map((c) => c.cer))),
    speaker_wer: wers.map((w) => round(w)),
    typical: { wer: round(typical.wer), heard: typical.heard },
    highest: { wer: round(highest.wer), heard: highest.heard },
  }
}

const native = groupsByName.has(NATIVE) ? buildGroup(NATIVE, groupsByName.get(NATIVE)) : null
if (!native) throw new Error(`No ${NATIVE} (native speaker) group: there would be no baseline to compare against`)
const groups = [...groupsByName]
  .filter(([name]) => name !== NATIVE)
  .map(([name, clips]) => buildGroup(name, clips))
  .sort((a, b) => b.wer - a.wer)

const accentedClips = [...groupsByName].filter(([n]) => n !== NATIVE).flatMap(([, c]) => c)
const accentedWer = accentedClips.map((c) => c.wer).sort((a, b) => a - b)
const mismatches = rows.filter((r) => /^true$/i.test(r.language_mismatch)).length
const sourcePath = join(inDir, 'source.json')
const commit = existsSync(sourcePath) ? JSON.parse(readFileSync(sourcePath, 'utf8')).commit : undefined

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: {
    dataset: 'Speech Accent Archive',
    url: 'https://accent.gmu.edu',
    model: 'ElevenLabs Scribe, language detected automatically',
    ...(commit ? { commit } : {}),
  },
  passage: { text: passage, words: passage.split(' ').length },
  /** Recordings where the AI named English, out of all of them. */
  english_recognised: { correct: rows.length - mismatches, total: rows.length },
  native,
  accented: {
    speakers: accentedClips.length,
    groups: groups.length,
    wer: round(mean(accentedWer)),
    median_wer: round(median(accentedWer)),
    cer: round(mean(accentedClips.map((c) => c.cer))),
  },
  groups,
}

writeFileSync(join(outDir, 'accent_results.json'), JSON.stringify(out, null, 2) + '\n')

console.log(`accent_results: ${rows.length} recordings, ${groups.length} accent groups + native ${NATIVE} baseline`)
console.log(`  native ${NATIVE}: mean WER ${(native.wer * 100).toFixed(2)}%, highest ${(native.highest_wer * 100).toFixed(1)}%`)
console.log(`  accented (${out.accented.speakers} speakers): mean WER ${(out.accented.wer * 100).toFixed(2)}%, median ${(out.accented.median_wer * 100).toFixed(2)}%`)
for (const g of groups) console.log(`  ${g.language.padEnd(11)} mean ${(g.wer * 100).toFixed(1).padStart(4)}%  median ${(g.median_wer * 100).toFixed(1).padStart(4)}%  highest ${(g.highest_wer * 100).toFixed(1).padStart(4)}%`)
console.log(`  AI named English in ${out.english_recognised.correct} of ${out.english_recognised.total} recordings`)
