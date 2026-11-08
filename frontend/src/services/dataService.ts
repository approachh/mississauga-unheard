import type {
  AccentResults,
  CensusChecks,
  CitywideLanguage,
  Dataset,
  LanguageResult,
  SpeechCoverage,
  TranscriptionResult,
  UnheardIndex,
  WardProfile,
  WardShapes,
} from '../types/data'

/**
 * Data layer.
 *
 * For each dataset `name` we look for `public/data/<name>.json` (real research
 * output) first. If it does not exist we fall back to `<name>.sample.json`
 * (placeholder) and flag the result with `isSample: true` so the UI can never
 * present it as a verified finding.
 *
 * To go live: drop the real file into `frontend/public/data/` — no code change.
 */

type Validator<T> = (row: unknown) => row is T

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0

export const isLanguageResult: Validator<LanguageResult> = (r): r is LanguageResult =>
  isObj(r) &&
  isStr(r.language) &&
  isStr(r.language_code) &&
  isNum(r.clips_tested) &&
  (isNum(r.wer) || r.wer === null) &&
  isNum(r.cer)

export const isTranscriptionResult: Validator<TranscriptionResult> = (r): r is TranscriptionResult =>
  isObj(r) &&
  isStr(r.id) &&
  isStr(r.language) &&
  isStr(r.language_code) &&
  typeof r.reference === 'string' &&
  typeof r.hypothesis === 'string' &&
  (r.wer === undefined || isNum(r.wer)) &&
  (r.cer === undefined || isNum(r.cer))

export const isCitywideLanguage: Validator<CitywideLanguage> = (r): r is CitywideLanguage =>
  isObj(r) && isNum(r.rank) && isStr(r.language) && isNum(r.home_speakers)

export const isWardProfile: Validator<WardProfile> = (r): r is WardProfile =>
  isObj(r) &&
  isNum(r.ward) &&
  isNum(r.population_total) &&
  isNum(r.population_language_base) &&
  isNum(r.top14_total) &&
  (r.corrected === undefined || typeof r.corrected === 'boolean') &&
  isObj(r.home_speakers) &&
  Object.values(r.home_speakers).every(isNum)

export const isSpeechCoverage: Validator<SpeechCoverage> = (r): r is SpeechCoverage =>
  isObj(r) &&
  isStr(r.language) &&
  isNum(r.fleurs_clips) &&
  isNum(r.accent_archive_speakers) &&
  isNum(r.minds14_calls) &&
  isNum(r.speech_massive_commands) &&
  typeof r.has_service_request_audio === 'boolean' &&
  (r.limited_speech_coverage === undefined || typeof r.limited_speech_coverage === 'boolean')

export const isCensusChecks: Validator<CensusChecks> = (r): r is CensusChecks =>
  isObj(r) &&
  isStr(r.generated) &&
  isNum(r.languages_reconciled) &&
  isNum(r.languages_with_ward_data) &&
  isNum(r.summary_rows_checked) &&
  Array.isArray(r.notes) &&
  r.notes.every((n) => typeof n === 'string')

const dataUrl = (file: string) => `${import.meta.env.BASE_URL}data/${file}`

/** Returns parsed JSON array, or null if the file is absent / not JSON (SPA fallbacks return HTML). */
async function fetchJsonArray(file: string): Promise<unknown[] | null> {
  const res = await fetch(dataUrl(file), { cache: 'no-cache' })
  if (!res.ok) return null
  const text = await res.text()
  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) throw new Error(`${file} must contain a JSON array`)
    return parsed
  } catch (e) {
    if (e instanceof SyntaxError) return null // HTML fallback => treat as missing
    throw e
  }
}

export async function loadDataset<T>(name: string, validate: Validator<T>): Promise<Dataset<T>> {
  try {
    let isSample = false
    let rows = await fetchJsonArray(`${name}.json`)
    if (rows === null) {
      rows = await fetchJsonArray(`${name}.sample.json`)
      isSample = true
    }
    if (rows === null) return { status: 'missing', data: [], isSample: false, skipped: 0 }

    const data = rows.filter(validate)
    return { status: 'ready', data, isSample, skipped: rows.length - data.length }
  } catch (e) {
    return {
      status: 'error',
      data: [],
      isSample: false,
      skipped: 0,
      error: e instanceof Error ? e.message : 'Unknown error',
    }
  }
}

// One request per dataset per page load, shared by the layout and every page.
const cache = new Map<string, Promise<Dataset<unknown>>>()
function cached<T>(name: string, validate: Validator<T>): Promise<Dataset<T>> {
  if (!cache.has(name)) cache.set(name, loadDataset(name, validate))
  return cache.get(name) as Promise<Dataset<T>>
}

export const loadLanguageResults = () => cached('language_results', isLanguageResult)
export const loadTranscriptions = () => cached('transcription_results', isTranscriptionResult)

// Census team data (generated from validated CSVs by `npm run data:census`).
export const loadCitywideLanguages = () => cached('census_citywide_languages', isCitywideLanguage)
export const loadWardProfiles = () => cached('census_ward_languages', isWardProfile)
export const loadSpeechCoverage = () => cached('speech_dataset_coverage', isSpeechCoverage)
export const loadCensusChecks = () => cached('census_checks', isCensusChecks)

const isWardShapes = (r: unknown): r is WardShapes =>
  isObj(r) &&
  isNum(r.width) &&
  isNum(r.height) &&
  isObj(r.source) &&
  Array.isArray(r.wards) &&
  r.wards.length > 0 &&
  r.wards.every((w) => isObj(w) && isNum(w.ward) && isStr(w.d) && Array.isArray(w.label) && w.label.length === 2)

/** Fetches one JSON document; null if it is missing, malformed or fails validation. */
function loadDocument<T>(file: string, valid: (r: unknown) => r is T): Promise<T | null> {
  return fetch(dataUrl(file), { cache: 'no-cache' })
    .then((res) => (res.ok ? res.text() : null))
    .then((text) => {
      if (!text) return null
      try {
        const parsed: unknown = JSON.parse(text)
        return valid(parsed) ? parsed : null
      } catch {
        return null // SPA fallback returned HTML
      }
    })
    .catch(() => null)
}

let shapesPromise: Promise<WardShapes | null> | null = null
/** Ward boundary shapes for the map, or null if the file is missing or malformed. */
export function loadWardShapes(): Promise<WardShapes | null> {
  shapesPromise ??= loadDocument('ward_shapes.json', isWardShapes)
  return shapesPromise
}

const isPair = (v: unknown) => Array.isArray(v) && v.length === 2 && v.every(isNum)
const isByMode = (v: unknown, check: (x: unknown) => boolean) => isObj(v) && check(v.auto) && check(v.forced)
const isUnheardIndex = (r: unknown): r is UnheardIndex =>
  isObj(r) &&
  isObj(r.method) &&
  isObj(r.coverage) &&
  Array.isArray(r.languages) &&
  Array.isArray(r.untested) &&
  Array.isArray(r.wards) &&
  r.wards.length === 11 &&
  r.wards.every(
    (w) =>
      isObj(w) &&
      isNum(w.ward) &&
      isByMode(w.index, isNum) &&
      isByMode(w.index_ci, isPair) &&
      isByMode(w.rank, isNum) &&
      isByMode(w.rank_range, isPair) &&
      isByMode(w.drivers, Array.isArray) &&
      isNum(w.tested_share) &&
      isNum(w.untested_share),
  ) &&
  r.languages.every((l) => isObj(l) && isStr(l.language) && isNum(l.clips) && isByMode(l.cer, isNum))

let indexPromise: Promise<UnheardIndex | null> | null = null
/** The Unheard Index, or null if the file is missing or malformed. */
export function loadUnheardIndex(): Promise<UnheardIndex | null> {
  indexPromise ??= loadDocument('unheard_index.json', isUnheardIndex)
  return indexPromise
}

const isAccentGroup = (g: unknown) =>
  isObj(g) &&
  isStr(g.language) &&
  isNum(g.speakers) &&
  isNum(g.wer) &&
  isNum(g.median_wer) &&
  isNum(g.highest_wer) &&
  Array.isArray(g.speaker_wer) &&
  g.speaker_wer.length > 0 &&
  g.speaker_wer.every(isNum) &&
  isObj(g.typical) &&
  typeof g.typical.heard === 'string' &&
  isObj(g.highest) &&
  typeof g.highest.heard === 'string'
const isAccentResults = (r: unknown): r is AccentResults =>
  isObj(r) &&
  isObj(r.passage) &&
  isStr(r.passage.text) &&
  isObj(r.english_recognised) &&
  isObj(r.accented) &&
  isNum(r.accented.wer) &&
  isAccentGroup(r.native) &&
  Array.isArray(r.groups) &&
  r.groups.length > 0 &&
  r.groups.every(isAccentGroup)

let accentPromise: Promise<AccentResults | null> | null = null
/** Accented-English results, or null if the file is missing or malformed (the section is then simply not shown). */
export function loadAccentResults(): Promise<AccentResults | null> {
  accentPromise ??= loadDocument('accent_results.json', isAccentResults)
  return accentPromise
}
