import type { LanguageResult, TranscriptionResult } from '../types/data'
import { pct } from './format'

/**
 * The evaluation runs every clip twice: 'auto' (the model detects the language, as a resident
 * using a voice service would experience it) and 'forced' (the language is given).
 * Headline figures use 'auto'; Speech Intelligence lets readers switch.
 */
export const PRIMARY_MODE = 'auto'

export const MODE_LABEL: Record<string, string> = {
  auto: 'Language detected',
  forced: 'Language given',
}

export function modesOf(rows: { mode?: string }[]): string[] {
  const set = new Set(rows.map((r) => r.mode).filter((m): m is string => !!m))
  return [...set].sort((a, b) => (a === PRIMARY_MODE ? -1 : b === PRIMARY_MODE ? 1 : a.localeCompare(b)))
}

/** Rows for one mode. Data without a mode field (older files, samples) passes through unchanged. */
export function inMode<T extends LanguageResult | TranscriptionResult>(rows: T[], mode: string | null): T[] {
  if (!mode || !rows.some((r) => r.mode)) return rows
  return rows.filter((r) => r.mode === mode)
}

/** Sort key that puts missing values last. */
export const orMinus = (v: number | null | undefined) => (v === null || v === undefined ? -1 : v)

/** Rate as a percentage, or an en dash when the metric doesn't apply. */
export const rate = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '–' : pct(v, digits))

/** Mean of the non-null values, or null. */
export function meanOf(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number')
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}
