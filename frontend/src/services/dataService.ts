import type {
  AccentResults,
  CensusChecks,
  CitywideLanguage,
  Dataset,
  LanguageResult,
  RoutingConfusion,
  RoutingData,
  RoutingLanguageCoverage,
  RoutingMetric,
  RoutingMisroute,
  RoutingTestResult,
  RoutingUnscoredExample,
  SpeechCoverage,
  TranscriptionResult,
  TorontoDivision,
  TorontoRequestType,
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

const routingUrl = (file: string) =>
  `${import.meta.env.BASE_URL}data/routing/${file}`

function parseCsv(text: string, file: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true
    } else if (character === ',') {
      row.push(field)
      field = ''
    } else if (character === '\n' || character === '\r') {
      row.push(field)
      if (row.some((cell) => cell.length > 0)) rows.push(row)
      row = []
      field = ''
      if (character === '\r' && text[index + 1] === '\n') index += 1
    } else {
      field += character
    }
  }
  if (quoted) throw new Error(`${file} contains an unterminated quoted field`)
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    if (row.some((cell) => cell.length > 0)) rows.push(row)
  }
  if (!rows.length) throw new Error(`${file} is empty`)

  const headers = rows[0]
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error(`${file} has missing or duplicate column names`)
  }
  return rows.slice(1).map((cells, rowIndex) => {
    if (cells.length !== headers.length) {
      throw new Error(
        `${file} row ${rowIndex + 2} has ${cells.length} cells; expected ${headers.length}`,
      )
    }
    return Object.fromEntries(headers.map((header, index) => [header, cells[index]]))
  })
}

async function fetchCsv(file: string): Promise<Record<string, string>[]> {
  const response = await fetch(routingUrl(file), { cache: 'no-cache' })
  if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`)
  return parseCsv(await response.text(), file)
}

function csvNumber(row: Record<string, string>, column: string, file: string): number {
  const value = Number(row[column])
  if (!Number.isFinite(value)) throw new Error(`${file} has an invalid ${column} value`)
  return value
}

function csvBoolean(row: Record<string, string>, column: string, file: string): boolean {
  if (row[column] === 'True' || row[column] === 'true') return true
  if (row[column] === 'False' || row[column] === 'false') return false
  throw new Error(`${file} has an invalid ${column} value`)
}

function csvText(row: Record<string, string>, column: string, file: string): string {
  const value = row[column]
  if (typeof value !== 'string') throw new Error(`${file} is missing the ${column} column`)
  return value
}

function parseDataset(row: Record<string, string>, file: string): 'minds14' | 'speech_massive' {
  const dataset = csvText(row, 'dataset', file)
  if (dataset !== 'minds14' && dataset !== 'speech_massive') {
    throw new Error(`${file} has an unsupported dataset name: ${dataset}`)
  }
  return dataset
}

function parseRoutingMetric(row: Record<string, string>): RoutingMetric {
  const file = 'routing_metrics.csv'
  return {
    dataset: parseDataset(row, file),
    language: csvText(row, 'language', file),
    test_examples: csvNumber(row, 'test_examples', file),
    intent_accuracy: csvNumber(row, 'intent_accuracy', file),
    reference_text_intent_accuracy: csvNumber(row, 'reference_text_intent_accuracy', file),
    asr_induced_route_errors: csvNumber(row, 'asr_induced_route_errors', file),
    reference_equals_english_translation_examples: csvNumber(
      row,
      'reference_equals_english_translation_examples',
      file,
    ),
    mean_wer: csvNumber(row, 'mean_wer', file),
    mean_cer: csvNumber(row, 'mean_cer', file),
  }
}

function parseRoutingTestResult(
  row: Record<string, string>,
  file: string,
): RoutingTestResult {
  return {
    dataset: parseDataset(row, file),
    language: csvText(row, 'language', file),
    file: csvText(row, 'file', file),
    true_intent: csvText(row, 'true_intent', file),
    predicted_intent: csvText(row, 'predicted_intent', file),
    reference_text_intent_prediction: csvText(row, 'reference_text_intent_prediction', file),
    intent_correct: csvBoolean(row, 'intent_correct', file),
    reference_text_intent_correct: csvBoolean(row, 'reference_text_intent_correct', file),
    asr_induced_route_error: csvBoolean(row, 'asr_induced_route_error', file),
    reference_equals_english_translation: csvBoolean(
      row,
      'reference_equals_english_translation',
      file,
    ),
    router_similarity: csvNumber(row, 'router_similarity', file),
    reference_text: csvText(row, 'reference_text', file),
    elevenlabs_transcript: csvText(row, 'elevenlabs_transcript', file),
    wer: csvNumber(row, 'wer', file),
    cer: csvNumber(row, 'cer', file),
  }
}

let routingPromise: Promise<Dataset<RoutingData>> | null = null
/** Loads the static routing-analysis CSV snapshot used by the Routing page. */
export function loadRoutingData(): Promise<Dataset<RoutingData>> {
  if (routingPromise) return routingPromise
  const pending: Promise<Dataset<RoutingData>> = Promise.all([
    fetchCsv('routing_metrics.csv'),
    fetchCsv('routing_language_coverage.csv'),
    fetchCsv('routing_confusion.csv'),
    fetchCsv('routing_misroutes.csv'),
    fetchCsv('routing_test_results.csv'),
    fetchCsv('routing_unscored_examples.csv'),
    fetchCsv('toronto_311_request_types.csv'),
    fetchCsv('toronto_311_divisions.csv'),
  ])
    .then(
      ([
        metrics,
        coverage,
        confusion,
        misroutes,
        testResults,
        unscored,
        requestTypes,
        divisions,
      ]) => {
        const data: RoutingData = {
          metrics: metrics.map(parseRoutingMetric),
          coverage: coverage.map((row): RoutingLanguageCoverage => ({
            dataset: parseDataset(row, 'routing_language_coverage.csv'),
            language: csvText(row, 'language', 'routing_language_coverage.csv'),
            selected_clips: csvNumber(row, 'selected_clips', 'routing_language_coverage.csv'),
            scored_test_examples: csvNumber(
              row,
              'scored_test_examples',
              'routing_language_coverage.csv',
            ),
            unscored_clips: csvNumber(row, 'unscored_clips', 'routing_language_coverage.csv'),
          })),
          confusion: confusion.map((row): RoutingConfusion => ({
            dataset: parseDataset(row, 'routing_confusion.csv'),
            language: csvText(row, 'language', 'routing_confusion.csv'),
            true_intent: csvText(row, 'true_intent', 'routing_confusion.csv'),
            predicted_intent: csvText(row, 'predicted_intent', 'routing_confusion.csv'),
            count: csvNumber(row, 'count', 'routing_confusion.csv'),
          })),
          misroutes: misroutes.map((row): RoutingMisroute =>
            parseRoutingTestResult(row, 'routing_misroutes.csv'),
          ),
          testResults: testResults.map((row) =>
            parseRoutingTestResult(row, 'routing_test_results.csv'),
          ),
          unscored: unscored.map((row): RoutingUnscoredExample => ({
            dataset: csvText(row, 'dataset', 'routing_unscored_examples.csv'),
            language: csvText(row, 'language', 'routing_unscored_examples.csv'),
            true_intent: csvText(row, 'true_intent', 'routing_unscored_examples.csv'),
            file: csvText(row, 'file', 'routing_unscored_examples.csv'),
            reason: csvText(row, 'reason', 'routing_unscored_examples.csv'),
          })),
          torontoRequestTypes: requestTypes.map((row): TorontoRequestType => ({
            service_request_type: csvText(row, 'service_request_type', 'toronto_311_request_types.csv'),
            request_count: csvNumber(row, 'request_count', 'toronto_311_request_types.csv'),
            share_percent: csvNumber(row, 'share_percent', 'toronto_311_request_types.csv'),
          })),
          torontoDivisions: divisions.map((row): TorontoDivision => ({
            division: csvText(row, 'division', 'toronto_311_divisions.csv'),
            request_count: csvNumber(row, 'request_count', 'toronto_311_divisions.csv'),
            share_percent: csvNumber(row, 'share_percent', 'toronto_311_divisions.csv'),
          })),
        }
        return { status: 'ready' as const, data: [data], isSample: false, skipped: 0 }
      },
    )
    .catch((error: unknown) => ({
      status: 'error' as const,
      data: [],
      isSample: false,
      skipped: 0,
      error: error instanceof Error ? error.message : 'Unable to load routing results',
    }))
  routingPromise = pending
  return pending
}
