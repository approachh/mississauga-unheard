// Shared helpers for the data scripts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/** RFC 4180 CSV parser: quoted fields, escaped quotes, commas and newlines inside quotes. */
export function parseCsv(inDir, file) {
  const text = readFileSync(join(inDir, file), 'utf8').replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (c === '"') {
        quoted = false
      } else {
        field += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((v) => v !== '')) rows.push(row)
      row = []
    } else {
      field += c
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  const [header, ...data] = rows
  return data.map((r, n) => {
    if (r.length !== header.length) throw new Error(`${file} row ${n + 2}: ${r.length} fields, expected ${header.length}`)
    return Object.fromEntries(header.map((h, i) => [h.trim(), r[i]]))
  })
}

/**
 * The speech evaluation covers several datasets in the same files (FLEURS: speakers reading their own
 * language; Speech Accent Archive: English read with an accent). Every script keeps to ONE dataset, so
 * accent recordings can never be counted as language-recognition results or enter the Unheard Index.
 * Rows without a dataset column (older files) count as FLEURS.
 */
export function onlyDataset(rows, dataset, label = 'rows') {
  const kept = rows.filter((r) => (r.dataset || 'fleurs') === dataset)
  const other = new Map()
  for (const r of rows) {
    const d = r.dataset || 'fleurs'
    if (d !== dataset) other.set(d, (other.get(d) ?? 0) + 1)
  }
  if (other.size) console.log(`  ${label}: using ${kept.length} ${dataset} rows; ignoring ${[...other].map(([d, n]) => `${n} ${d}`).join(', ')}`)
  return kept
}
