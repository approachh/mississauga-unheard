// Converts the speech-evaluation outputs (analysis team, branch feature/speech-evaluation)
// into the JSON the frontend reads.
//
//   npm run data:speech   (reads frontend/data/speech/, writes frontend/public/data/)
//   node scripts/convert-speech.mjs <input-dir> <output-dir>
//
// Inputs (copied verbatim from analysis/outputs/):
//   speech_summary.csv  -> language_results.json      (one row per language x mode)
//   speech_results.csv  -> transcription_results.json (one row per clip x mode)
//
// Only the FLEURS rows are used; the Speech Accent Archive rows go through convert-accents.mjs.
//
// Rules:
// - Values are copied as computed by the analysis pipeline; nothing is re-scored here.
// - Empty WER (languages written without spaces, e.g. Chinese) stays null: CER is the metric there.
// - For those languages the transcript text is split into characters so the said/heard view can
//   align character by character. This only affects display, never the metrics.

import { writeFileSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { onlyDataset, parseCsv as readCsv } from './lib/csv.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const inDir = process.argv[2] ?? join(here, '..', 'data', 'speech')
const outDir = process.argv[3] ?? join(here, '..', 'public', 'data')
const parseCsv = (file) => readCsv(inDir, file)

const num = (v) => (v === '' || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null)
const bool = (v) => /^true$/i.test(v)
const ALIASES = { 'mandarin chinese': 'Mandarin' }
const harmonise = (name) => ALIASES[name.trim().toLowerCase()] ?? name.trim()

/** Characters separated by spaces (punctuation and spaces removed) for character-level alignment. */
const charSpaced = (s) => [...s.replace(/[\s\p{P}\p{S}]/gu, '')].join(' ')

// FLEURS only: accent recordings (data:accents) must never reach the language results.
const results = onlyDataset(parseCsv('speech_results.csv'), 'fleurs', 'speech_results.csv')
const summary = onlyDataset(parseCsv('speech_summary.csv'), 'fleurs', 'speech_summary.csv')

// ISO 639-1 code per language, from the per-clip file.
const codeOf = new Map(results.map((r) => [harmonise(r.language), r.iso639_1]))

const languageResults = summary.map((s) => {
  const language = harmonise(s.language)
  const ci = (lo, hi) => (num(lo) === null || num(hi) === null ? null : [num(lo), num(hi)])
  return {
    language,
    language_code: codeOf.get(language) ?? '',
    mode: s.mode,
    dataset: s.dataset,
    clips_tested: num(s.n_clips),
    wer: num(s.mean_wer),
    cer: num(s.mean_cer),
    wer_ci: ci(s.wer_ci_low, s.wer_ci_high),
    cer_ci: ci(s.cer_ci_low, s.cer_ci_high),
    cer_script_neutral: num(s.mean_cer_script_neutral),
    pct_language_mismatch: num(s.pct_language_mismatch),
    pct_script_mismatch: num(s.pct_script_mismatch),
  }
})

const transcriptionResults = results.map((r) => {
  const language = harmonise(r.language)
  const wer = num(r.wer)
  const charLevel = wer === null
  return {
    id: `${r.mode}-${basename(r.file, '.flac')}`,
    language,
    language_code: r.iso639_1,
    mode: r.mode,
    reference: charLevel ? charSpaced(r.reference) : r.reference,
    hypothesis: charLevel ? charSpaced(r.prediction) : r.prediction,
    ...(wer !== null ? { wer } : {}),
    ...(num(r.cer) !== null ? { cer: num(r.cer) } : {}),
    detected_language: r.detected_language || null,
    script_mismatch: bool(r.script_mismatch),
    language_mismatch: bool(r.language_mismatch),
    char_level: charLevel,
  }
})

const write = (name, data) => writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n')
write('language_results.json', languageResults)
write('transcription_results.json', transcriptionResults)

// Report
const modes = [...new Set(languageResults.map((r) => r.mode))]
console.log(`language_results: ${languageResults.length} rows (${modes.join(', ')}), transcription_results: ${transcriptionResults.length} clips`)
for (const m of modes) {
  const rows = languageResults.filter((r) => r.mode === m)
  const noWer = rows.filter((r) => r.wer === null).map((r) => r.language)
  console.log(`  ${m}: ${rows.length} languages, ${rows.reduce((n, r) => n + r.clips_tested, 0)} clips${noWer.length ? `; CER only: ${noWer.join(', ')}` : ''}`)
}
const missingCode = languageResults.filter((r) => !r.language_code).map((r) => r.language)
if (missingCode.length) console.log(`  WARNING: no language code for ${missingCode.join(', ')}`)
// Cross-check: clip counts per language/mode match the summary
for (const s of languageResults) {
  const n = transcriptionResults.filter((t) => t.language === s.language && t.mode === s.mode).length
  if (n !== s.clips_tested) console.log(`  MISMATCH ${s.language}/${s.mode}: summary ${s.clips_tested} clips, results ${n}`)
}
