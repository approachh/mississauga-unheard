import type { CitywideLanguage, LanguageResult, OfficialLanguageWard, SpeechCoverage, WardProfile } from '../types/data'
import { langKey } from './language'
import { inMode, PRIMARY_MODE } from './speech'

/** Ward whose published zeros are treated as unverified. */
export const CAUTION_WARD = 10
export const isCaution = (ward: number, value: number) => ward === CAUTION_WARD && value === 0

/** Languages that were zero in Ward 10 before the November 2026 correction. */
export const WARD10_PREVIOUS_ZEROS = ['Mandarin', 'Punjabi', 'Polish', 'Tagalog', 'Vietnamese']

/**
 * Share of a ward's residents who speak a language at home.
 * Denominator: population_language_base, per the census Data Dictionary.
 */
export const shareOfWard = (speakers: number, ward: WardProfile) =>
  ward.population_language_base > 0 ? speakers / ward.population_language_base : 0

export interface CensusModel {
  ranking: CitywideLanguage[]
  wards: WardProfile[]
  /** join key -> language name as used in the ward file */
  wardName: Map<string, string>
  coverageBy: Map<string, SpeechCoverage>
  /** Published (non-sample) speech results only. */
  speechBy: Map<string, LanguageResult>
  assessed: CitywideLanguage[]
  uncovered: CitywideLanguage[]
  covered: CitywideLanguage[]
  notAssessed: CitywideLanguage[]
  /** Sum of home-speaker counts across the uncovered language categories (not unique people). */
  uncoveredCountSum: number
}

export function buildModel(
  city: CitywideLanguage[],
  wardRows: WardProfile[],
  coverage: SpeechCoverage[],
  speech: LanguageResult[],
  speechIsSample: boolean,
): CensusModel {
  const ranking = [...city].sort((a, b) => a.rank - b.rank)
  const wards = [...wardRows].sort((a, b) => a.ward - b.ward)
  const wardName = new Map<string, string>()
  for (const w of wards) for (const name of Object.keys(w.home_speakers)) wardName.set(langKey(name), name)
  const coverageBy = new Map(coverage.map((c) => [langKey(c.language), c]))
  // One result per language: the headline (auto-detect) mode, published data only.
  const speechBy = new Map(speechIsSample ? [] : inMode(speech, PRIMARY_MODE).map((s) => [langKey(s.language), s]))

  const assessed = ranking.filter((r) => coverageBy.has(langKey(r.language)))
  const uncovered = assessed.filter((r) => !coverageBy.get(langKey(r.language))!.has_service_request_audio)
  const covered = assessed.filter((r) => coverageBy.get(langKey(r.language))!.has_service_request_audio)
  const notAssessed = ranking.filter((r) => !coverageBy.has(langKey(r.language)))

  return {
    ranking,
    wards,
    wardName,
    coverageBy,
    speechBy,
    assessed,
    uncovered,
    covered,
    notAssessed,
    uncoveredCountSum: uncovered.reduce((n, r) => n + r.home_speakers, 0),
  }
}

export interface WardPoint {
  ward: number
  speakers: number
  share: number
  caution: boolean
  corrected: boolean
}

/** One language across all wards. Empty when the ward profile lacks the language. */
export function wardSeries(model: CensusModel, language: string): WardPoint[] {
  const name = model.wardName.get(langKey(language))
  if (!name) return []
  return model.wards.map((w) => {
    const n = w.home_speakers[name] ?? 0
    return { ward: w.ward, speakers: n, share: shareOfWard(n, w), caution: isCaution(w.ward, n), corrected: w.corrected === true }
  })
}

/** Most spoken home languages in one ward, across all profiled languages. */
export function topLanguagesInWard(ward: WardProfile, n = 3) {
  return Object.entries(ward.home_speakers)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([language, speakers]) => ({ language, speakers, share: shareOfWard(speakers, ward) }))
}

/**
 * Residents who cannot conduct a conversation in English or French (2021 census), per ward and citywide.
 * The citywide share uses the summed language bases, the same denominator as each ward's own share.
 */
export interface OfficialModel {
  wards: OfficialLanguageWard[]
  byWard: Map<number, OfficialLanguageWard>
  total: number
  base: number
  share: number
  /** 1 = highest share of residents without English or French. */
  rankByShare: Map<number, number>
  topShare: OfficialLanguageWard
}

export function buildOfficial(rows: OfficialLanguageWard[]): OfficialModel | null {
  if (rows.length !== 11) return null // a partial table would give a wrong city total
  const wards = [...rows].sort((a, b) => a.ward - b.ward)
  const total = wards.reduce((n, w) => n + w.knows_neither, 0)
  const base = wards.reduce((n, w) => n + w.language_base, 0)
  const ranked = [...wards].sort((a, b) => b.share - a.share)
  return {
    wards,
    byWard: new Map(wards.map((w) => [w.ward, w])),
    total,
    base,
    share: base > 0 ? total / base : 0,
    rankByShare: new Map(ranked.map((w, i) => [w.ward, i + 1])),
    topShare: ranked[0],
  }
}
