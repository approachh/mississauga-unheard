/** One row of `language_results.json` (produced by the Python analysis). */
export interface LanguageResult {
  language: string
  language_code: string
  clips_tested: number
  /** Word Error Rate, 0–1 (can exceed 1). Null for scripts without word spaces (e.g. Chinese). */
  wer: number | null
  /** Character Error Rate, 0–1. */
  cer: number
  /** 'auto' = language detected by the model; 'forced' = language given to it. */
  mode?: string
  dataset?: string
  /** 95% confidence interval [low, high] for WER / CER, when computed. */
  wer_ci?: [number, number] | null
  cer_ci?: [number, number] | null
  /** CER ignoring script choice (e.g. Simplified vs Traditional Chinese). */
  cer_script_neutral?: number | null
  /** % of clips where the detected language / script differed from the expected one. */
  pct_language_mismatch?: number | null
  pct_script_mismatch?: number | null
}

/** One row of `transcription_results.json`. */
export interface TranscriptionResult {
  id: string
  language: string
  language_code: string
  /** Ground-truth text. */
  reference: string
  /** ElevenLabs Scribe output. */
  hypothesis: string
  /** Optional per-clip metrics; computed in the browser (WER only) if absent. */
  wer?: number
  cer?: number
  mode?: string
  detected_language?: string | null
  script_mismatch?: boolean
  /** In auto mode: the model named a different language from the one spoken. */
  language_mismatch?: boolean
  /** Text is split into characters for display (no word spaces in the script). */
  char_level?: boolean
}

/** `census_citywide_languages.json`: validated citywide home-language ranking. */
export interface CitywideLanguage {
  rank: number
  language: string
  /** People who speak the language at home, citywide (validated). */
  home_speakers: number
}

/** `census_ward_languages.json`: 2021 ward language profile, one row per ward. */
export interface WardProfile {
  ward: number
  population_total: number
  population_language_base: number
  /** Home speakers of the 14 profiled non-official languages. */
  top14_total: number
  /** True when the census team corrected this ward's figures (Ward 10 in the Nov 2026 release). */
  corrected?: boolean
  /** Keyed by harmonised language name, e.g. "Mandarin". */
  home_speakers: Record<string, number>
}

/** `speech_dataset_coverage.json`: which public speech datasets include each language. */
export interface SpeechCoverage {
  language: string
  /** FLEURS: read speech in the language. */
  fleurs_clips: number
  /** Speech Accent Archive: English read by native speakers of the language. */
  accent_archive_speakers: number
  /** MINDS-14: spoken e-banking service requests. */
  minds14_calls: number
  /** Speech-MASSIVE: spoken virtual-assistant commands. */
  speech_massive_commands: number
  has_service_request_audio: boolean
  /** Census team flag; criterion not documented in the file. */
  limited_speech_coverage?: boolean
}

/** `census_checks.json`: results of the converter's cross-file consistency checks. */
export interface CensusChecks {
  generated: string
  languages_reconciled: number
  languages_with_ward_data: number
  summary_rows_checked: number
  /** Verification of the official-language figures (see scripts/convert-census.mjs). */
  official_language?: {
    city_total: number
    language_base: number
    matches_neighbourhood_total: boolean
    ward10_matches_neighbourhoods: boolean
  }
  notes: string[]
}

/**
 * `census_official_language.json`: residents who cannot conduct a conversation in English or French,
 * 2021 census, per ward. Counts are rounded to 5 by Statistics Canada. `share` uses the ward's
 * language-base population as its denominator, like the home-language shares.
 */
export interface OfficialLanguageWard {
  ward: number
  language_base: number
  knows_neither: number
  share: number
}

/** `ward_shapes.json`: official ward boundaries, projected and simplified for SVG (see scripts/convert-wards.mjs). */
export interface WardShapes {
  source: { name: string; item: string; terms: string; simplification_m: number }
  width: number
  height: number
  metres_per_unit: number
  wards: { ward: number; d: string; label: [number, number] }[]
}

export type DatasetStatus = 'loading' | 'ready' | 'missing' | 'error'

export interface Dataset<T> {
  status: DatasetStatus
  data: T[]
  /** True when the data came from a `*.sample.json` placeholder file. */
  isSample: boolean
  /** Rows dropped because they failed validation. */
  skipped: number
  error?: string
}

export type RecognitionMode = 'auto' | 'forced'
type ByMode<T> = Record<RecognitionMode, T>

/** `unheard_index.json`: relative accessibility-priority score per ward (see scripts/build-unheard-index.mjs). */
export interface UnheardIndex {
  generated: string
  source: {
    speech: { file: string; ref?: string; commit?: string; dataset: string; clips_used: number; clips_dropped: number }
    census: string
  }
  method: {
    metric: 'cer'
    formula: string
    share_denominator: string
    scale_reference: { mode: RecognitionMode; ward: number; raw: number }
    bootstrap: { resamples: number; seed: number; interval: number }
    small_sample_threshold: number
  }
  /** Experimental accessibility-weighted view. Not a head count; see `caveat`. */
  weighted_method: { formula: string; caveat: string; scale_reference: { mode: RecognitionMode; ward: number } }
  baseline: { language: string; clips: number; cer: ByMode<number> } | null
  languages: {
    language: string
    clips: number
    small_sample: boolean
    citywide_speakers: number | null
    cer: ByMode<number>
    cer_ci: ByMode<[number, number] | null>
    cer_script_neutral: ByMode<number>
    pct_language_mismatch: ByMode<number>
  }[]
  untested: { language: string; citywide_speakers: number | null }[]
  coverage: { tested_share: number; untested_share: number; note: string }
  wards: UnheardWard[]
}

export interface UnheardWard {
  ward: number
  language_base: number
  /** 0–100 on one scale for both modes: 100 = highest ward under auto-detect. */
  index: ByMode<number>
  index_ci: ByMode<[number, number]>
  rank: ByMode<number>
  rank_range: ByMode<[number, number]>
  rank_script_neutral: ByMode<number>
  /** Top three languages by share of the ward's score. */
  drivers: ByMode<{ language: string; share_of_score: number }[]>
  tested_share: number
  untested_share: number
  untested_unconfirmed_zero: string[]
  /** Residents without English or French in this ward (2021 census) and their share of the language base. */
  no_official_count: number
  no_official_share: number
  /** Experimental view: the same score multiplied by no_official_share (see `weighted_method`). */
  weighted: {
    index: ByMode<number>
    index_ci: ByMode<[number, number]>
    rank: ByMode<number>
    rank_range: ByMode<[number, number]>
  }
}

/** One group of speakers in `accent_results.json`: scores only, nothing that identifies a person. */
export interface AccentGroup {
  /** Native language of the speakers ("English" is the native-speaker baseline). */
  language: string
  speakers: number
  /** Word error rate, 0–1: the mean over the group's speakers. */
  wer: number
  /** 95% bootstrap range for the mean, when computed. */
  wer_ci: [number, number] | null
  median_wer: number
  highest_wer: number
  /** The mean without the single highest speaker. */
  wer_without_highest: number | null
  cer: number
  /** Every speaker's WER, ascending and unlabelled. */
  speaker_wer: number[]
  /** What the AI wrote for the median speaker and for the highest one. */
  typical: { wer: number; heard: string }
  highest: { wer: number; heard: string }
}

/** `accent_results.json`: English read with an accent (Speech Accent Archive). See scripts/convert-accents.mjs. */
export interface AccentResults {
  generated: string
  source: { dataset: string; url: string; model: string; commit?: string }
  /** The paragraph every speaker read. */
  passage: { text: string; words: number }
  /** Recordings where the AI named English, out of all recordings. */
  english_recognised: { correct: number; total: number }
  native: AccentGroup
  accented: { speakers: number; groups: number; wer: number; median_wer: number; cer: number }
  /** Accent groups, highest mean WER first. */
  groups: AccentGroup[]
}

export interface RoutingMetric {
  dataset: 'minds14' | 'speech_massive'
  language: string
  test_examples: number
  intent_accuracy: number
  reference_text_intent_accuracy: number
  asr_induced_route_errors: number
  reference_equals_english_translation_examples: number
  mean_wer: number
  mean_cer: number
}

export interface RoutingLanguageCoverage {
  dataset: 'minds14' | 'speech_massive'
  language: string
  selected_clips: number
  scored_test_examples: number
  unscored_clips: number
}

export interface RoutingTestResult {
  dataset: 'minds14' | 'speech_massive'
  language: string
  file: string
  true_intent: string
  predicted_intent: string
  reference_text_intent_prediction: string
  intent_correct: boolean
  reference_text_intent_correct: boolean
  asr_induced_route_error: boolean
  reference_equals_english_translation: boolean
  router_similarity: number
  reference_text: string
  elevenlabs_transcript: string
  wer: number
  cer: number
}

export interface RoutingConfusion {
  dataset: 'minds14' | 'speech_massive'
  language: string
  true_intent: string
  predicted_intent: string
  count: number
}

export type RoutingMisroute = RoutingTestResult

export interface TorontoRequestType {
  service_request_type: string
  request_count: number
  share_percent: number
}

export interface TorontoDivision {
  division: string
  request_count: number
  share_percent: number
}

export interface RoutingUnscoredExample {
  dataset: string
  language: string
  true_intent: string
  file: string
  reason: string
}

export interface RoutingData {
  metrics: RoutingMetric[]
  coverage: RoutingLanguageCoverage[]
  confusion: RoutingConfusion[]
  misroutes: RoutingMisroute[]
  testResults: RoutingTestResult[]
  unscored: RoutingUnscoredExample[]
  torontoRequestTypes: TorontoRequestType[]
  torontoDivisions: TorontoDivision[]
}
