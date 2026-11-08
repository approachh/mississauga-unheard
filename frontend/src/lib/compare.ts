import type { LanguageResult, TranscriptionResult } from '../types/data'

/**
 * Auto-detect vs language-given, one language at a time, from the real evaluation results.
 * Everything here is derived from `language_results.json` and `transcription_results.json`;
 * nothing is rescored. The error measure is character error rate (CER): it is defined for every
 * language, including Mandarin and Cantonese, which have no word spaces.
 */

/** Languages with at least this many recordings get the full comparison; smaller tests are too small to read. */
export const FULL_TEST_CLIPS = 20

export interface LanguagePair {
  language: string
  code: string
  clips: number
  auto: LanguageResult
  forced: LanguageResult
}

/** Languages that were run both ways, most mistakes (when guessing) first. */
export function buildPairs(rows: LanguageResult[]): LanguagePair[] {
  const forced = new Map(rows.filter((r) => r.mode === 'forced').map((r) => [r.language_code, r]))
  return rows
    .filter((r) => r.mode === 'auto' && forced.has(r.language_code))
    .map((auto) => ({ language: auto.language, code: auto.language_code, clips: auto.clips_tested, auto, forced: forced.get(auto.language_code)! }))
    .sort((a, b) => b.auto.cer - a.auto.cer)
}

/** Chinese is counted in characters; everything else in letters. */
export const unitOf = (code: string) => (code === 'zh' || code === 'yue' ? 'characters' : 'letters')

export type VerdictKind = 'much' | 'some' | 'same' | 'worse'

export interface Verdict {
  kind: VerdictKind
  /** Mistakes when guessing divided by mistakes when told (only for 'much'). */
  ratio: number
  /** Share of mistakes removed, 0–1 (only for 'some'). */
  fewer: number
}

/** A gap under one percentage point is called "about the same"; no language is made to look better than it is. */
export function verdictOf(p: LanguagePair): Verdict {
  const a = p.auto.cer
  const f = p.forced.cer
  const delta = a - f
  if (Math.abs(delta) < 0.01) return { kind: 'same', ratio: 1, fewer: 0 }
  if (delta < 0) return { kind: 'worse', ratio: a / f, fewer: delta / a }
  const ratio = a / Math.max(f, 1e-9)
  return { kind: ratio >= 2 ? 'much' : 'some', ratio, fewer: 1 - f / a }
}

/** "6×", "2.4×". */
export function ratioText(ratio: number) {
  const r = Math.round(ratio * 10) / 10
  return Number.isInteger(r) ? `${r}×` : `${r.toFixed(1)}×`
}

/** Recordings out of the language's total, from a published percentage. */
export const countOf = (pctValue: number | null | undefined, clips: number) => Math.round(((pctValue ?? 0) / 100) * clips)

const DETECTED: Record<string, string> = {
  urd: 'Urdu', hin: 'Hindi', zho: 'Chinese', cmn: 'Mandarin', yue: 'Cantonese', jpn: 'Japanese', pan: 'Punjabi',
  eng: 'English', ara: 'Arabic', fil: 'Filipino', tgl: 'Filipino', spa: 'Spanish', por: 'Portuguese', vie: 'Vietnamese',
  pol: 'Polish', tam: 'Tamil', guj: 'Gujarati', kor: 'Korean', rus: 'Russian', ukr: 'Ukrainian', ben: 'Bengali',
  ita: 'Italian', mal: 'Malayalam',
}
export const detectedName = (code: string | null | undefined) => (code ? (DETECTED[code] ?? code.toUpperCase()) : 'another language')

/** The language AI most often named instead, among recordings where it named the wrong one. */
export function topWrongGuess(pair: LanguagePair, clips: TranscriptionResult[]): string | null {
  const counts = new Map<string, number>()
  for (const t of clips) {
    if (t.mode !== 'auto' || t.language_code !== pair.code || !t.language_mismatch) continue
    const key = t.detected_language ?? ''
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0]
  return top ? detectedName(top[0]) : null
}

export interface Example {
  id: string
  auto: TranscriptionResult
  forced: TranscriptionResult
  /** Auto-detect named a different language for this recording. */
  wrongLanguage: boolean
}

export interface Examples {
  /** Recordings where the two ways produced different text, in recording order. */
  list: Example[]
  /** Where to start: the first recording AI mistook for another language, else the first that differs. */
  start: number
  /** Recording-by-recording tally over all recordings (CER difference under 0.1 point counts as the same). */
  tally: { paired: number; fewer: number; more: number; same: number }
}

const clipKey = (t: TranscriptionResult) => t.id.replace(/^(auto|forced)-/, '')

export function examplesFor(pair: LanguagePair, clips: TranscriptionResult[]): Examples {
  const mine = clips.filter((t) => t.language_code === pair.code)
  const forced = new Map(mine.filter((t) => t.mode === 'forced').map((t) => [clipKey(t), t]))
  const paired: Example[] = []
  for (const a of mine.filter((t) => t.mode === 'auto')) {
    const f = forced.get(clipKey(a))
    if (f) paired.push({ id: clipKey(a), auto: a, forced: f, wrongLanguage: a.language_mismatch === true })
  }
  paired.sort((x, y) => x.id.localeCompare(y.id, undefined, { numeric: true }))

  const tally = { paired: paired.length, fewer: 0, more: 0, same: 0 }
  for (const e of paired) {
    const d = (e.auto.cer ?? 0) - (e.forced.cer ?? 0)
    if (d > 0.001) tally.fewer++
    else if (d < -0.001) tally.more++
    else tally.same++
  }
  const list = paired.filter((e) => e.auto.hypothesis !== e.forced.hypothesis)
  const wrong = list.findIndex((e) => e.wrongLanguage)
  return { list, start: wrong >= 0 ? wrong : 0, tally }
}

const joinList = (items: string[]) => (items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)

/** One plain sentence that says what happened across the languages, without implying all improve. */
export function summarySentence(pairs: LanguagePair[]) {
  const by = (k: VerdictKind) => pairs.filter((p) => verdictOf(p).kind === k).map((p) => p.language)
  const parts: string[] = []
  if (by('much').length) parts.push(`helped a lot for ${joinList(by('much'))}`)
  if (by('some').length) parts.push(`helped a little for ${joinList(by('some'))}`)
  if (by('same').length) parts.push(`made no real difference for ${joinList(by('same'))}`)
  if (by('worse').length) parts.push(`made things worse for ${joinList(by('worse'))}`)
  return parts.length ? `Telling the AI the language ${joinList(parts)}.` : ''
}
