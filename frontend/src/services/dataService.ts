import type {
  CitywideLanguage,
  Dataset,
  LanguageResult,
  SpeechCoverage,
  TranscriptionResult,
  WardProfile,
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
  isObj(r) && isStr(r.language) && isStr(r.language_code) && isNum(r.clips_tested) && isNum(r.wer) && isNum(r.cer)

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
  isObj(r.home_speakers) &&
  Object.values(r.home_speakers).every(isNum)

export const isSpeechCoverage: Validator<SpeechCoverage> = (r): r is SpeechCoverage =>
  isObj(r) &&
  isStr(r.language) &&
  isNum(r.fleurs_clips) &&
  isNum(r.accent_archive_speakers) &&
  isNum(r.minds14_calls) &&
  isNum(r.speech_massive_commands) &&
  typeof r.has_service_request_audio === 'boolean'

const dataUrl =(file: string) => `${import.meta.env.BASE_URL}data/${file}`

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
