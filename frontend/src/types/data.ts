/** One row of `language_results.json` (produced by the Python analysis). */
export interface LanguageResult {
  language: string
  language_code: string
  clips_tested: number
  /** Word Error Rate, 0–1 (can exceed 1 when many insertions occur). */
  wer: number
  /** Character Error Rate, 0–1. */
  cer: number
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
