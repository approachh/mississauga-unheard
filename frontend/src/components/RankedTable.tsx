import { ArrowDown, ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { int, pct, titleCase } from '../lib/format'
import type { LanguageResult } from '../types/data'
import { Flag } from './Flag'

export type Metric = 'wer' | 'cer'
type SortKey = 'language' | 'clips_tested' | Metric

interface RankedTableProps {
  rows: LanguageResult[]
  isSample: boolean
  /** Column that gets an inline bar (lengths true to value, from zero). */
  barMetric?: Metric
  initialSort?: Metric
  selected?: string | null
  onSelect?: (code: string) => void
  caption: string
}

export function RankedTable({ rows, isSample, barMetric, initialSort = 'wer', selected, onSelect, caption }: RankedTableProps) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: initialSort, dir: 'desc' })

  const sorted = [...rows].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    const c = typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)
    return sort.dir === 'asc' ? c : -c
  })
  const max = { wer: Math.max(...rows.map((r) => r.wer), 0.0001), cer: Math.max(...rows.map((r) => r.cer), 0.0001) }

  const setKey = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'language' ? 'asc' : 'desc' }))

  const head = (key: SortKey, label: string, align: 'left' | 'right') => {
    const active = sort.key === key
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={`py-2.5 font-medium ${align === 'right' ? 'pl-4 text-right' : 'pr-4 text-left'}`}
      >
        <button
          type="button"
          onClick={() => setKey(key)}
          className={`inline-flex items-center gap-1 rounded-sm text-[13px] ${active ? 'text-ink' : 'text-ink-3 hover:text-ink'} ${
            align === 'right' ? 'flex-row-reverse' : ''
          }`}
        >
          <span>
            {label}
            {isSample && key !== 'language' && <Flag kind="S" />}
          </span>
          {active ? (
            sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" aria-hidden /> : <ArrowDown className="h-3 w-3" aria-hidden />
          ) : (
            <span className="w-3" />
          )}
        </button>
      </th>
    )
  }

  const metricCell = (r: LanguageResult, m: Metric) => (
    <td className="py-2.5 pl-4 text-right">
      {barMetric === m ? (
        <span className="flex items-center justify-end gap-3">
          <span className="hidden h-2 w-full max-w-[220px] bg-wash sm:block" aria-hidden>
            <span className="block h-full bg-proof" style={{ width: `${(r[m] / max[m]) * 100}%` }} />
          </span>
          <span className="w-14 shrink-0 font-medium">{pct(r[m])}</span>
        </span>
      ) : (
        pct(r[m])
      )}
    </td>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-collapse text-[14px]">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-ink">
          <tr>
            {head('language', 'Language', 'left')}
            {head('clips_tested', 'Clips', 'right')}
            {head('wer', 'WER', 'right')}
            {head('cer', 'CER', 'right')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const isSel = selected === r.language_code
            return (
              <tr
                key={r.language_code}
                onClick={onSelect ? () => onSelect(r.language_code) : undefined}
                className={`border-b border-rule transition-colors duration-100 ${onSelect ? 'cursor-pointer hover:bg-wash' : ''} ${
                  isSel ? 'bg-wash' : ''
                } ${selected && !isSel ? 'text-ink-3' : ''}`}
              >
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  {onSelect ? (
                    <button
                      type="button"
                      aria-pressed={isSel}
                      onClick={(e) => {
                        e.stopPropagation()
                        onSelect(r.language_code)
                      }}
                      className={`rounded-sm text-left ${isSel ? 'font-semibold text-ink' : ''}`}
                    >
                      {titleCase(r.language)}
                    </button>
                  ) : (
                    titleCase(r.language)
                  )}
                  <span className="ml-2 font-mono text-[11px] text-ink-3">{r.language_code}</span>
                </th>
                <td className="py-2.5 pl-4 text-right text-ink-2">{int(r.clips_tested)}</td>
                {metricCell(r, 'wer')}
                {metricCell(r, 'cer')}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
