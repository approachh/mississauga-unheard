// Builds the Unheard Index: a relative accessibility-priority score for Mississauga's 11 wards.
//
//   npm run data:index   (reads frontend/data/speech/speech_results.csv and the census JSON in
//                         frontend/public/data/; writes frontend/public/data/unheard_index.json)
//
// Method (also written into the output so the page can cite it):
//
//   raw(w, m)   = Σ_l  share(w, l) × CER(l, m)
//   Index(w, m) = 100 × raw(w, m) / max_w raw(w, auto)
//
//   w      ward (1–11)
//   m      recognition mode: "auto" (language detected) or "forced" (language specified)
//   l      a home language with speech results in BOTH modes and a ward-level census count
//   share  home speakers of l in w / the ward's language-base population (2021 census)
//   CER    mean character error rate over the tested clips (plain CER, the same rule for every
//          language: output in the wrong script counts as an error). CER is used rather than WER
//          because WER is undefined for languages written without word spaces (Mandarin, Cantonese).
//
// Both modes share one scale (100 = highest ward under auto-detect), so the gap between them reads
// directly as what specifying the language recovers.
//
// The index is a relative priority ranking. It is NOT an estimate of how many people are
// misunderstood: CER is measured on read-aloud FLEURS sentences, not real service requests, and
// home-language counts can include the same person more than once.
//
// Uncertainty: clips are resampled with replacement within each language and mode (seeded, so the
// output is reproducible), giving a 95% interval for each ward's index and its rank range.
// Languages with fewer than SMALL_SAMPLE clips are flagged; the bootstrap understates their
// uncertainty.
//
// Languages without speech results are excluded from the score; the share of each ward's residents
// who speak them is reported separately.
//
// Experimental accessibility-weighted view (published next to the index, never in its place):
//
//   weighted(w, m) = 100 × raw(w, m) × p(w) / max_w [raw(w, auto) × p(w)]      p = share of the ward's
//                                                                              language base that knows
//                                                                              neither English nor French
//
// It asks "where do hard-to-recognise languages overlap with residents who have no English or French
// to fall back on?". It is a relative ranking, not an estimate of how many people the AI misunderstands:
// p is a ward average and is not broken down by language. Recent immigrants are not used.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { onlyDataset, parseCsv } from './lib/csv.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const speechDir = join(here, '..', 'data', 'speech')
const dataDir = join(here, '..', 'public', 'data')

const RESAMPLES = 2000
const SEED = 20211
const SMALL_SAMPLE = 20
const BASELINE = 'English'
const CAUTION_WARD = 10 // published zeros in Ward 10 are treated as unverified (see lib/census.ts)
const ALIASES = { 'mandarin chinese': 'Mandarin' }
const harmonise = (name) => ALIASES[name.trim().toLowerCase()] ?? name.trim()

// ---------------------------------------------------------------- inputs
// FLEURS only: accent recordings are a different test and must not enter the index.
const clips = onlyDataset(parseCsv(speechDir, 'speech_results.csv'), 'fleurs', 'speech_results.csv')
const wards = JSON.parse(readFileSync(join(dataDir, 'census_ward_languages.json'), 'utf8')).sort((a, b) => a.ward - b.ward)
const city = JSON.parse(readFileSync(join(dataDir, 'census_citywide_languages.json'), 'utf8'))
const officialRows = JSON.parse(readFileSync(join(dataDir, 'census_official_language.json'), 'utf8')).sort((a, b) => a.ward - b.ward)
if (officialRows.length !== 11) throw new Error('census_official_language.json must have 11 wards (run npm run data:census)')
const sourcePath = join(speechDir, 'source.json')
const source = existsSync(sourcePath) ? JSON.parse(readFileSync(sourcePath, 'utf8')) : null

if (wards.length !== 11) throw new Error(`Expected 11 wards, found ${wards.length}`)
const censusLanguages = Object.keys(wards[0].home_speakers)
for (const [i, w] of wards.entries()) {
  if (officialRows[i].ward !== w.ward || officialRows[i].language_base !== w.population_language_base)
    throw new Error(`Ward ${w.ward}: official-language file does not match the ward profile (run npm run data:census)`)
  if (!(w.population_language_base > 0)) throw new Error(`Ward ${w.ward}: no language-base population`)
  const keys = Object.keys(w.home_speakers)
  if (keys.length !== censusLanguages.length || !censusLanguages.every((l) => keys.includes(l)))
    throw new Error(`Ward ${w.ward}: language list differs from Ward ${wards[0].ward}`)
}

// Clip-level CER per language and mode. Failed calls (no CER) are dropped and counted.
const MODES = ['auto', 'forced']
const byLang = new Map() // language -> { auto: {cer: [], neutral: [], mismatch: []}, forced: ... }
let dropped = 0
for (const r of clips) {
  const cer = Number(r.cer)
  if (r.cer === '' || !Number.isFinite(cer) || !MODES.includes(r.mode)) {
    dropped++
    continue
  }
  const lang = harmonise(r.language)
  if (!byLang.has(lang)) byLang.set(lang, Object.fromEntries(MODES.map((m) => [m, { cer: [], neutral: [], mismatch: [] }])))
  const slot = byLang.get(lang)[r.mode]
  slot.cer.push(cer)
  slot.neutral.push(r.cer_script_neutral === '' ? cer : Number(r.cer_script_neutral))
  slot.mismatch.push(/^true$/i.test(r.language_mismatch) ? 1 : 0)
}

const hasBoth = (l) => MODES.every((m) => byLang.get(l)?.[m].cer.length > 0)
const tested = censusLanguages.filter(hasBoth)
const untested = censusLanguages.filter((l) => !hasBoth(l))
const speechOnly = [...byLang.keys()].filter((l) => l !== BASELINE && !censusLanguages.includes(l))
if (!tested.length) throw new Error('No language has speech results in both modes and a ward-level census count')

// ---------------------------------------------------------------- calculation
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]
const round = (x, d = 4) => Math.round(x * 10 ** d) / 10 ** d

const share = (w, l) => w.home_speakers[l] / w.population_language_base
/** raw[wardIndex] for one set of per-language error rates */
const rawScores = (err) => wards.map((w) => tested.reduce((s, l) => s + share(w, l) * err[l], 0))
const errOf = (m, field = 'cer') => Object.fromEntries(tested.map((l) => [l, mean(byLang.get(l)[m][field])]))
const ranksOf = (scores) => {
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0])
  const rank = new Array(scores.length)
  order.forEach(([, i], r) => (rank[i] = r + 1))
  return rank
}

const point = Object.fromEntries(MODES.map((m) => [m, rawScores(errOf(m))]))
const scaleRef = Math.max(...point.auto)
const scaled = (raw) => (100 * raw) / scaleRef

// Experimental view: each ward's score times its share of residents with no English or French.
const noOfficial = officialRows.map((o) => o.share)
const weigh = (raw) => raw.map((r, i) => r * noOfficial[i])
const wPoint = Object.fromEntries(MODES.map((m) => [m, weigh(point[m])]))
const wScaleRef = Math.max(...wPoint.auto)
const wScaled = (raw) => (100 * raw) / wScaleRef

// Seeded bootstrap (mulberry32)
let seed = SEED
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const resampleMean = (v) => {
  let s = 0
  for (let i = 0; i < v.length; i++) s += v[Math.floor(rand() * v.length)]
  return s / v.length
}
const boot = Object.fromEntries(MODES.map((m) => [m, { idx: wards.map(() => []), rank: wards.map(() => []), widx: wards.map(() => []), wrank: wards.map(() => []) }]))
for (let b = 0; b < RESAMPLES; b++) {
  for (const m of MODES) {
    const err = Object.fromEntries(tested.map((l) => [l, resampleMean(byLang.get(l)[m].cer)]))
    const raw = rawScores(err)
    const rank = ranksOf(raw)
    raw.forEach((r, i) => {
      boot[m].idx[i].push(scaled(r))
      boot[m].rank[i].push(rank[i])
    })
    const wRaw = weigh(raw)
    const wRank = ranksOf(wRaw)
    wRaw.forEach((r, i) => {
      boot[m].widx[i].push(wScaled(r))
      boot[m].wrank[i].push(wRank[i])
    })
  }
}
const interval = (v) => {
  const s = [...v].sort((a, b) => a - b)
  return [quantile(s, 0.025), quantile(s, 0.975)]
}

const rank = Object.fromEntries(MODES.map((m) => [m, ranksOf(point[m])]))
const wRank = Object.fromEntries(MODES.map((m) => [m, ranksOf(wPoint[m])]))
const neutralRank = Object.fromEntries(MODES.map((m) => [m, ranksOf(rawScores(errOf(m, 'neutral')))]))

// ---------------------------------------------------------------- output
const cityBase = wards.reduce((n, w) => n + w.population_language_base, 0)
const citySum = (langs) => wards.reduce((n, w) => n + langs.reduce((s, l) => s + w.home_speakers[l], 0), 0)
const citySpeakers = new Map(city.map((c) => [harmonise(c.language), c.home_speakers]))
const baseline = byLang.get(BASELINE)

const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: {
    speech: {
      file: 'analysis/outputs/speech_results.csv',
      ...(source ? { ref: source.ref, commit: source.commit } : {}),
      dataset: 'FLEURS read speech',
      clips_used: tested.reduce((n, l) => n + MODES.reduce((k, m) => k + byLang.get(l)[m].cer.length, 0), 0),
      clips_dropped: dropped,
    },
    census: 'census_ward_languages.json (2021 ward language profile); census_official_language.json (2021 knowledge of official languages)',
  },
  method: {
    metric: 'cer',
    formula: 'Index(w, m) = 100 × Σ share(w, l) × CER(l, m) / max over wards of the auto-detect score',
    share_denominator: 'population_language_base',
    scale_reference: { mode: 'auto', ward: wards[point.auto.indexOf(scaleRef)].ward, raw: round(scaleRef, 6) },
    bootstrap: { resamples: RESAMPLES, seed: SEED, interval: 0.95 },
    small_sample_threshold: SMALL_SAMPLE,
  },
  weighted_method: {
    formula: 'Weighted(w, m) = 100 × Index raw(w, m) × p(w) / max over wards of the auto-detect weighted score, where p(w) = residents who know neither English nor French / language-base population',
    caveat: 'Experimental. A relative ranking, not an estimate of how many people are misunderstood by AI: p is a ward-wide share, not broken down by language, and counts are rounded to 5.',
    scale_reference: { mode: 'auto', ward: wards[wPoint.auto.indexOf(wScaleRef)].ward },
  },
  baseline: baseline
    ? { language: BASELINE, clips: baseline.auto.cer.length, cer: Object.fromEntries(MODES.map((m) => [m, round(mean(baseline[m].cer))])) }
    : null,
  languages: tested
    .map((l) => {
      const d = byLang.get(l)
      return {
        language: l,
        clips: d.auto.cer.length,
        small_sample: d.auto.cer.length < SMALL_SAMPLE,
        citywide_speakers: citySpeakers.get(l) ?? null,
        cer: Object.fromEntries(MODES.map((m) => [m, round(mean(d[m].cer))])),
        cer_ci: Object.fromEntries(MODES.map((m) => [m, d[m].cer.length > 1 ? interval(Array.from({ length: RESAMPLES }, () => resampleMean(d[m].cer))).map((x) => round(x)) : null])),
        cer_script_neutral: Object.fromEntries(MODES.map((m) => [m, round(mean(d[m].neutral))])),
        pct_language_mismatch: Object.fromEntries(MODES.map((m) => [m, round(100 * mean(d[m].mismatch), 1)])),
      }
    })
    .sort((a, b) => b.cer.auto - a.cer.auto),
  untested: untested.map((l) => ({ language: l, citywide_speakers: citySpeakers.get(l) ?? null })).sort((a, b) => (b.citywide_speakers ?? 0) - (a.citywide_speakers ?? 0)),
  coverage: {
    tested_share: round(citySum(tested) / cityBase),
    untested_share: round(citySum(untested) / cityBase),
    note: 'Sums of home-language counts over the language-base population; one person can be counted twice.',
  },
  wards: wards.map((w, i) => {
    const contrib = (m) => {
      const err = errOf(m)
      return tested
        .map((l) => ({ language: l, part: share(w, l) * err[l] }))
        .sort((a, b) => b.part - a.part)
        .slice(0, 3)
        .map((c) => ({ language: c.language, share_of_score: round(c.part / point[m][i], 3) }))
    }
    return {
      ward: w.ward,
      language_base: w.population_language_base,
      index: Object.fromEntries(MODES.map((m) => [m, round(scaled(point[m][i]), 1)])),
      index_ci: Object.fromEntries(MODES.map((m) => [m, interval(boot[m].idx[i]).map((x) => round(x, 1))])),
      rank: Object.fromEntries(MODES.map((m) => [m, rank[m][i]])),
      rank_range: Object.fromEntries(MODES.map((m) => [m, interval(boot[m].rank[i])])),
      rank_script_neutral: Object.fromEntries(MODES.map((m) => [m, neutralRank[m][i]])),
      drivers: Object.fromEntries(MODES.map((m) => [m, contrib(m)])),
      tested_share: round(tested.reduce((s, l) => s + share(w, l), 0)),
      untested_share: round(untested.reduce((s, l) => s + share(w, l), 0)),
      untested_unconfirmed_zero: w.ward === CAUTION_WARD ? untested.filter((l) => w.home_speakers[l] === 0) : [],
      no_official_count: officialRows[i].knows_neither,
      no_official_share: round(noOfficial[i], 5),
      weighted: {
        index: Object.fromEntries(MODES.map((m) => [m, round(wScaled(wPoint[m][i]), 1)])),
        index_ci: Object.fromEntries(MODES.map((m) => [m, interval(boot[m].widx[i]).map((x) => round(x, 1))])),
        rank: Object.fromEntries(MODES.map((m) => [m, wRank[m][i]])),
        rank_range: Object.fromEntries(MODES.map((m) => [m, interval(boot[m].wrank[i])])),
      },
    }
  }),
}

writeFileSync(join(dataDir, 'unheard_index.json'), JSON.stringify(out, null, 2) + '\n')

// ---------------------------------------------------------------- report
console.log(`Unheard Index: ${tested.length} tested languages, ${untested.length} untested, ${out.source.speech.clips_used} clips${dropped ? `, ${dropped} dropped` : ''}`)
if (speechOnly.length) console.log(`  Speech results without ward data (not scored): ${speechOnly.join(', ')}`)
console.log(`  Untested: ${untested.join(', ')}  (${(100 * out.coverage.untested_share).toFixed(1)}% of residents, counts may overlap)`)
console.log('  ward  auto (95%)          forced (95%)        rank  range  untested   | experimental weighted (auto): score  rank  range')
for (const w of [...out.wards].sort((a, b) => a.rank.auto - b.rank.auto))
  console.log(
    `  ${String(w.ward).padStart(4)}  ${w.index.auto.toFixed(1).padStart(5)} (${w.index_ci.auto.join('–').padEnd(11)})  ${w.index.forced.toFixed(1).padStart(5)} (${w.index_ci.forced.join('–').padEnd(11)})  ${String(w.rank.auto).padStart(4)}  ${w.rank_range.auto.join('–').padEnd(5)}  ${(100 * w.untested_share).toFixed(1)}%   | ${w.weighted.index.auto.toFixed(1).padStart(5)}  ${String(w.weighted.rank.auto).padStart(4)}  ${w.weighted.rank_range.auto.join('–')}`,
  )
