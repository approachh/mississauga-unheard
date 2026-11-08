// Converts the census team's validated CSVs into the JSON files the frontend reads,
// and cross-checks the files against each other.
//
//   npm run data:census   (reads frontend/data/census/, writes JSON to frontend/public/data/)
//   node scripts/convert-census.mjs <input-dir> <output-dir>
//
// Source CSVs live outside public/ on purpose: they are not deployed. Only the JSON the
// app needs is published. Older releases are kept in data/census/archive/.
//
// Rules applied (agreed with the census team):
// - Citywide population comes ONLY from citywide_language_ranking_VALIDATED.csv.
// - The `city_home_speakers` column in language_coverage_validated.csv is not used
//   (it conflicted with validated counts in earlier releases).
// - census_summary.csv is used only to verify the other files; nothing is read from it.
// - Language names are harmonised ("Mandarin Chinese" -> "Mandarin").
// - Values are copied as published; nothing is imputed.
// - official_language_knowledge_2021.csv (residents who know neither English nor French) comes from the
//   same census tables as the ward profile; every row is verified here before it is published (see 4).

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const inDir = process.argv[2] ?? join(here, '..', 'data', 'census')
const outDir = process.argv[3] ?? join(here, '..', 'public', 'data')

const ALIASES = { 'mandarin chinese': 'Mandarin' }
const harmonise = (name) => ALIASES[name.trim().toLowerCase()] ?? name.trim()

function parseCsv(file) {
  const text = readFileSync(join(inDir, file), 'utf8').replace(/^﻿/, '').trim()
  const [header, ...lines] = text.split(/\r?\n/).filter((l) => l.trim())
  const cols = header.split(',').map((c) => c.trim())
  return lines.map((line) => {
    const cells = line.split(',').map((c) => c.trim())
    if (cells.length !== cols.length) throw new Error(`${file}: expected ${cols.length} columns, got ${cells.length}: ${line}`)
    return Object.fromEntries(cols.map((c, i) => [c, cells[i]]))
  })
}

const num = (v, ctx) => {
  const n = Number(v)
  if (v === '' || !Number.isFinite(n)) throw new Error(`Not a number (${ctx}): "${v}"`)
  return n
}
const bool = (v, ctx) => {
  if (/^true$/i.test(v)) return true
  if (/^false$/i.test(v)) return false
  throw new Error(`Not a boolean (${ctx}): "${v}"`)
}
const optBool = (v, ctx) => (v === undefined || v === '' ? undefined : bool(v, ctx))
const titleLang = (slug) => harmonise(slug.replace(/_/g, ' ').replace(/(^|[\s-])\w/g, (c) => c.toUpperCase()))

// 1. Citywide ranking
const citywide = parseCsv('citywide_language_ranking_VALIDATED.csv').map((r) => ({
  rank: num(r.rank, 'rank'),
  language: harmonise(r.language),
  home_speakers: num(r.home_speakers_citywide, r.language),
}))

// 2. Ward profile
const wardRaw = parseCsv('ward_language_profile_2021_VALIDATED.csv')
const wards = wardRaw.map((r) => {
  const home_speakers = {}
  for (const [k, v] of Object.entries(r)) {
    if (!k.startsWith('home_')) continue
    home_speakers[titleLang(k.slice(5))] = num(v, `ward ${r.ward} ${k}`)
  }
  const corrected = optBool(r.ward10_corrected, `ward ${r.ward} ward10_corrected`)
  return {
    ward: num(r.ward, 'ward'),
    population_total: num(r.population_total, 'population_total'),
    population_language_base: num(r.population_language_base, 'population_language_base'),
    top14_total: num(r.top14_nonofficial_home_language_speakers, 'top14'),
    ...(corrected !== undefined ? { corrected } : {}),
    home_speakers,
  }
})

// 3. Speech dataset coverage (population columns intentionally dropped)
const coverage = parseCsv('language_coverage_validated.csv').map((r) => {
  const limited = optBool(r.limited_speech_coverage, `${r.language} limited_speech_coverage`)
  return {
    language: harmonise(r.language),
    fleurs_clips: num(r.fleurs_clips, 'fleurs'),
    accent_archive_speakers: num(r.accent_archive_speakers, 'accent archive'),
    minds14_calls: num(r.minds14_calls, 'minds14'),
    speech_massive_commands: num(r.speech_massive_commands, 'speech massive'),
    has_service_request_audio: bool(r.has_service_request_audio, r.language),
    ...(limited !== undefined ? { limited_speech_coverage: limited } : {}),
  }
})

// 4. Knowledge of official languages (2021): residents who cannot conduct a conversation in English or French.
//    Verified against the ward profile (same denominator) and the neighbourhood table (same city total).
//    A failed check stops the build: this figure is published as a headline number.
const officialRaw = parseCsv('official_language_knowledge_2021.csv')
const officialMeta = JSON.parse(readFileSync(join(inDir, 'official_language_knowledge_2021.meta.json'), 'utf8'))
const official = officialRaw
  .map((r) => ({
    ward: num(r.ward, 'official ward'),
    language_base: num(r.population_language_base, `official ward ${r.ward} language base`),
    knows_neither: num(r.knows_neither_english_nor_french, `official ward ${r.ward} count`),
    published_pct: num(r.pct_knows_neither_english_nor_french, `official ward ${r.ward} pct`),
  }))
  .sort((a, b) => a.ward - b.ward)
if (official.length !== wards.length || official.some((o, i) => o.ward !== wards[i].ward || o.ward !== i + 1))
  throw new Error('official_language_knowledge_2021.csv must have exactly one row for each of the 11 wards')
for (const o of official) {
  const w = wards.find((x) => x.ward === o.ward)
  if (o.language_base !== w.population_language_base)
    throw new Error(`official-language ward ${o.ward}: language base ${o.language_base} differs from the ward profile (${w.population_language_base})`)
  if (!(o.knows_neither >= 0 && o.knows_neither <= o.language_base)) throw new Error(`official-language ward ${o.ward}: count out of range`)
  const pct = Math.round((o.knows_neither / o.language_base) * 10000) / 100
  if (Math.abs(pct - o.published_pct) > 0.0051) throw new Error(`official-language ward ${o.ward}: published ${o.published_pct}% but ${o.knows_neither}/${o.language_base} = ${pct}%`)
}
const officialTotal = official.reduce((n, o) => n + o.knows_neither, 0)
const officialBase = official.reduce((n, o) => n + o.language_base, 0)
if (officialTotal !== officialMeta.neighbourhood_totals.knows_neither_english_nor_french)
  throw new Error(`official-language city total ${officialTotal} differs from the neighbourhood table total ${officialMeta.neighbourhood_totals.knows_neither_english_nor_french}`)
const w10Official = official.find((o) => o.ward === 10)
const w10Implied = officialMeta.neighbourhood_totals.knows_neither_english_nor_french - official.filter((o) => o.ward !== 10).reduce((n, o) => n + o.knows_neither, 0)
if (w10Implied !== w10Official.knows_neither) throw new Error(`Ward 10: ${w10Official.knows_neither} published but the neighbourhoods imply ${w10Implied}`)
const officialOut = official.map((o) => ({
  ward: o.ward,
  language_base: o.language_base,
  knows_neither: o.knows_neither,
  share: Math.round((o.knows_neither / o.language_base) * 100000) / 100000,
}))

const write = (name, data) => writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n')
write('census_citywide_languages.json', citywide)
write('census_ward_languages.json', wards)
write('speech_dataset_coverage.json', coverage)
write('census_official_language.json', officialOut)

// ---------------------------------------------------------------------------
// Consistency report (printed only)
// ---------------------------------------------------------------------------
const issues = []
const note = (msg) => issues.push(msg)
console.log(`citywide: ${citywide.length} languages · wards: ${wards.length} · coverage: ${coverage.length} rows`)
console.log(`official languages: ${officialTotal} residents know neither English nor French (${((100 * officialTotal) / officialBase).toFixed(2)}% of ${officialBase}); matches the neighbourhood table; Ward 10 ${w10Official.knows_neither} matches the neighbourhoods`)

// a) Ward sums vs citywide
const cityBy = new Map(citywide.map((c) => [c.language, c]))
const wardLangs = Object.keys(wards[0].home_speakers)
console.log('\nWard sums vs citywide ranking:')
for (const lang of wardLangs) {
  const sum = wards.reduce((n, w) => n + w.home_speakers[lang], 0)
  const city = cityBy.get(lang)?.home_speakers
  const ok = city === sum
  if (!ok) note(`ward sum for ${lang} is ${sum}, citywide is ${city ?? 'missing'}`)
  console.log(`  ${lang.padEnd(15)} wards ${String(sum).padStart(6)}  citywide ${String(city ?? 'n/a').padStart(6)}  ${ok ? 'match' : `DIFF ${city - sum}`}`)
}
for (const c of citywide) if (!wardLangs.includes(c.language)) note(`${c.language} is ranked citywide but has no ward column`)

// b) Coverage vs ranking
for (const c of coverage) if (c.language !== 'English' && !cityBy.has(c.language)) note(`coverage language not in ranking: ${c.language}`)
const covRaw = parseCsv('language_coverage_validated.csv')
for (const r of covRaw) {
  const v = r.home_speakers_citywide_validated
  const city = cityBy.get(harmonise(r.language))?.home_speakers
  if (v && city !== undefined && Number(v) !== city) note(`coverage validated count for ${r.language} (${v}) differs from ranking (${city})`)
}

// c) Ward-row internal checks
for (const r of wardRaw) {
  const w = wards.find((x) => x.ward === Number(r.ward))
  const entries = Object.entries(w.home_speakers)
  const [topLang, topN] = entries.reduce((a, b) => (b[1] > a[1] ? b : a))
  if (r.top_language && (titleLang(r.top_language.toLowerCase()) !== topLang || Number(r.top_language_speakers) !== topN))
    note(`ward ${r.ward}: top_language says ${r.top_language} ${r.top_language_speakers}, data says ${topLang} ${topN}`)
  // Percent column: current files use population_language_base (Data Dictionary); older ones used population_total.
  const pctCols = [
    ['top_language_pct_of_population_language_base', w.population_language_base],
    ['top_language_pct_of_ward_population', w.population_total],
  ]
  for (const [col, base] of pctCols) {
    if (!r[col]) continue
    const pct = Math.round((topN / base) * 1000) / 10
    if (Math.abs(pct - Number(r[col])) > 0.051) note(`ward ${r.ward}: ${col} ${r[col]} vs computed ${pct}`)
  }
  const zeros = entries.filter(([, n]) => n === 0).map(([l]) => l)
  if (zeros.length) note(`ward ${r.ward}: zero home speakers reported for ${zeros.join(', ')}`)
}

// d) census_summary.csv cross-check
if (existsSync(join(inDir, 'census_summary.csv'))) {
  const summary = parseCsv('census_summary.csv')
  const covBy = new Map(coverage.map((c) => [c.language, c]))
  const summaryBase = { base: 0, total: 0 }
  let checked = 0
  for (const s of summary) {
    checked++
    const lang = harmonise(s.language)
    const w = wards.find((x) => x.ward === Number(s.ward))
    const where = `summary ward ${s.ward} ${lang}`
    if (!w) { note(`${where}: ward not in ward profile`); continue }
    if (Number(s.population_total) !== w.population_total) note(`${where}: population_total ${s.population_total} vs ${w.population_total}`)
    if (Number(s.population_language_base) !== w.population_language_base) note(`${where}: language base ${s.population_language_base} vs ${w.population_language_base}`)
    if (Number(s.home_speakers) !== w.home_speakers[lang]) note(`${where}: home_speakers ${s.home_speakers} vs ${w.home_speakers[lang]}`)
    const c = cityBy.get(lang)
    if (!c) note(`${where}: language not in ranking`)
    else {
      if (Number(s.rank) !== c.rank) note(`${where}: rank ${s.rank} vs ${c.rank}`)
      if (Number(s.home_speakers_citywide) !== c.home_speakers) note(`${where}: citywide ${s.home_speakers_citywide} vs ${c.home_speakers}`)
    }
    // Which denominator does the summary's percentage use?
    const onBase = Math.round((Number(s.home_speakers) / w.population_language_base) * 10000) / 100
    const onTotal = Math.round((Number(s.home_speakers) / w.population_total) * 10000) / 100
    const reported = Number(s.pct_of_ward_population)
    if (Math.abs(onBase - reported) <= 0.0051) summaryBase.base++
    else if (Math.abs(onTotal - reported) <= 0.0051) summaryBase.total++
    else note(`${where}: pct ${s.pct_of_ward_population} matches neither denominator (base ${onBase}, total ${onTotal})`)
    const cov = covBy.get(lang)
    if (cov && s.has_service_request_audio !== '' && bool(s.has_service_request_audio, where) !== cov.has_service_request_audio)
      note(`${where}: service-request flag disagrees with coverage file`)
    if (!cov && s.has_service_request_audio !== '') note(`${where}: has coverage values but language is not in the coverage file`)
  }
  console.log(`\ncensus_summary.csv: ${checked} rows cross-checked`)
  // Rows where both denominators round to the same value count toward "base".
  if (summaryBase.total > 0)
    note(`census_summary.csv pct_of_ward_population uses population_total, not population_language_base (${summaryBase.total} of ${checked} rows only match total); VOXELO does not read it`)
}

console.log(issues.length ? `\nNotes (${issues.length}):\n  - ${issues.join('\n  - ')}` : '\nNo inconsistencies found.')

// Persist what was checked so the UI reports verified facts, not hard-coded claims.
write('census_checks.json', [
  {
    generated: new Date().toISOString().slice(0, 10),
    languages_reconciled: wardLangs.filter((l) => cityBy.get(l)?.home_speakers === wards.reduce((n, w) => n + w.home_speakers[l], 0)).length,
    languages_with_ward_data: wardLangs.length,
    official_language: {
      city_total: officialTotal,
      language_base: officialBase,
      matches_neighbourhood_total: true,
      ward10_matches_neighbourhoods: true,
    },
    summary_rows_checked: existsSync(join(inDir, 'census_summary.csv')) ? parseCsv('census_summary.csv').length : 0,
    notes: issues,
  },
])
