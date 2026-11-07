import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { int, pct, titleCase } from '../lib/format'
import type { LanguageResult } from '../types/data'
import type { Metric } from './RankedTable'

interface ErrorRateChartProps {
  data: LanguageResult[]
  rankBy: Metric
  selected: string | null
  onSelect?: (code: string) => void
}

const WER_FILL = 'var(--color-proof)'
const CER_FILL = 'var(--color-proof-light)'

/** WER and CER side by side per language, ranked worst first. Axis starts at zero. */
export function ErrorRateChart({ data, rankBy, selected, onSelect }: ErrorRateChartProps) {
  const rows = [...data].sort((a, b) => b[rankBy] - a[rankBy]).map((d) => ({ ...d, name: titleCase(d.language) }))

  const max = Math.max(0.05, ...rows.flatMap((r) => [r.wer, r.cer]))
  const step = max <= 0.25 ? 0.05 : max <= 0.6 ? 0.1 : 0.2
  const top = Math.ceil(max / step) * step
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => +(i * step).toFixed(2))
  const height = Math.max(200, rows.length * 56 + 36)
  const dim = (code: string) => (selected && selected !== code ? 0.22 : 1)
  const click = (entry: unknown) => onSelect?.((entry as LanguageResult).language_code)

  return (
    <figure>
      <figcaption className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-ink-2">
        <Swatch color={WER_FILL} label="Word Error Rate" />
        <Swatch color={CER_FILL} label="Character Error Rate" />
        <span className="text-ink-3">Ranked by {rankBy.toUpperCase()}, highest first</span>
      </figcaption>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 52, bottom: 0, left: 0 }} barCategoryGap={12} barGap={2}>
            <CartesianGrid horizontal={false} stroke="var(--color-rule)" />
            <XAxis
              type="number"
              domain={[0, top]}
              ticks={ticks}
              tickFormatter={(v: number) => pct(v, 0)}
              tick={{ fill: 'var(--color-ink-3)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-ink)' }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={96}
              tick={(props: unknown) => {
                const p = props as { x: number; y: number; index: number }
                const r = rows[p.index]
                return (
                  <g transform={`translate(${p.x - 8},${p.y})`} opacity={dim(r.language_code) < 1 ? 0.45 : 1}>
                    <text textAnchor="end" dy={-1} fill="var(--color-ink)" fontSize={13} fontWeight={500}>
                      {r.name}
                    </text>
                    <text textAnchor="end" dy={14} fill="var(--color-ink-3)" fontSize={11}>
                      {int(r.clips_tested)} clips
                    </text>
                  </g>
                )
              }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: 'var(--color-wash)' }} content={<ChartTooltip />} />
            {(['wer', 'cer'] as const).map((m) => (
              <Bar
                key={m}
                dataKey={m}
                fill={m === 'wer' ? WER_FILL : CER_FILL}
                isAnimationActive={false}
                onClick={click}
                className={onSelect ? 'cursor-pointer' : undefined}
                label={{
                  position: 'right',
                  formatter: (v: unknown) => pct(Number(v)),
                  fill: 'var(--color-ink-2)',
                  fontSize: 11,
                }}
              >
                {rows.map((r) => (
                  <Cell key={r.language_code} fillOpacity={dim(r.language_code)} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} aria-hidden />
      {label}
    </span>
  )
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: LanguageResult & { name: string } }[] }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="min-w-40 rounded-md border border-rule-2 bg-paper px-3 py-2.5 text-[13px] shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
      <p className="mb-1.5 font-semibold">
        {d.name} <span className="font-mono text-[11px] font-normal text-ink-3">{d.language_code}</span>
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-0.5">
        <dt className="text-ink-3">WER</dt>
        <dd className="text-right font-medium">{pct(d.wer)}</dd>
        <dt className="text-ink-3">CER</dt>
        <dd className="text-right font-medium">{pct(d.cer)}</dd>
        <dt className="text-ink-3">Clips</dt>
        <dd className="text-right font-medium">{int(d.clips_tested)}</dd>
      </dl>
    </div>
  )
}
