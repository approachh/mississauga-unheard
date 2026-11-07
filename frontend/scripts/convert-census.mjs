// Converts the census team's validated CSVs into the JSON files the frontend reads.
//
//   npm run data:census            (reads and writes frontend/public/data/)
//   node scripts/convert-census.mjs <input-dir> <output-dir>
//
// Rules applied (agreed with the census team):
// - Citywide population comes ONLY from citywide_language_ranking_VALIDATED.csv.
// - The older `city_home_speakers` column in language_coverage_validated.csv conflicts
//   with validated counts and is dropped. So is its duplicate validated column.
// - Language names are harmonised ("Mandarin Chinese" -> "Mandarin").
// - Values are copied as published; nothing is imputed (Ward 10 zeros stay zero and are
//   flagged in the UI).

import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const inDir = process.argv[2] ?? join(here, '..', 'public', 'data')
const outDir = process.argv[3] ?? inDir

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

// 1. Citywide ranking
const citywide = parseCsv('citywide_language_ranking_VALIDATED.csv').map((r) => ({
  rank: num(r.rank, 'rank'),
  language: harmonise(r.language),
  home_speakers: num(r.home_speakers_citywide, r.language),
}))

// 2. Ward profile
const wards = parseCsv('ward_language_profile_2021_VALIDATED.csv').map((r) => {
  const home_speakers = {}
  for (const [k, v] of Object.entries(r)) {
    if (!k.startsWith('home_')) continue
    const name = harmonise(k.slice(5).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
    home_speakers[name] = num(v, `ward ${r.ward} ${k}`)
  }
  return {
    ward: num(r.ward, 'ward'),
    population_total: num(r.population_total, 'population_total'),
    population_language_base: num(r.population_language_base, 'population_language_base'),
    top14_total: num(r.top14_nonofficial_home_language_speakers, 'top14'),
    home_speakers,
  }
})

// 3. Speech dataset coverage (population columns intentionally dropped)
const coverage = parseCsv('language_coverage_validated.csv').map((r) => ({
  language: harmonise(r.language),
  fleurs_clips: num(r.fleurs_clips, 'fleurs'),
  accent_archive_speakers: num(r.accent_archive_speakers, 'accent archive'),
  minds14_calls: num(r.minds14_calls, 'minds14'),
  speech_massive_commands: num(r.speech_massive_commands, 'speech massive'),
  has_service_request_audio: bool(r.has_service_request_audio, r.language),
}))

const write = (name, data) => writeFileSync(join(outDir, name), JSON.stringify(data, null, 2) + '\n')
write('census_citywide_languages.json', citywide)
write('census_ward_languages.json', wards)
write('speech_dataset_coverage.json', coverage)

// Reconciliation report (printed, not written)
console.log(`citywide: ${citywide.length} languages · wards: ${wards.length} · coverage: ${coverage.length} rows`)
const cityBy = new Map(citywide.map((c) => [c.language, c.home_speakers]))
for (const lang of Object.keys(wards[0].home_speakers)) {
  const sum = wards.reduce((n, w) => n + w.home_speakers[lang], 0)
  const city = cityBy.get(lang)
  console.log(`  ${lang.padEnd(12)} wards ${String(sum).padStart(6)}  citywide ${String(city ?? 'n/a').padStart(6)}  ${city === sum ? 'match' : `diff ${city - sum}`}`)
}
for (const c of coverage) if (c.language !== 'English' && !cityBy.has(c.language)) console.log(`  coverage language not in citywide ranking: ${c.language}`)
