import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { int, pct } from '../lib/format'

export interface WardDatum {
  ward: number
  speakers: number
  /** Share of the ward's language-base population. */
  shareOfWard: number
  /** Value is a possibly spurious zero. */
  caution: boolean
}

/** Home speakers by ward. The three largest wards are set in ink; flagged zeros carry an E. */
export function WardChart({ data, language }: { data: WardDatum[]; language: string }) {
  const top = new Set([...data].sort((a, b) => b.speakers - a.speakers).slice(0, 3).map((d) => d.ward))
  // Round axis: 1-2-5 step series, four or five ticks from zero.
  const raw = Math.max(1, ...data.map((d) => d.speakers))
  const mag = 10 ** Math.floor(Math.log10(raw / 4))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => raw / s <= 5) ?? 10 * mag
  const max = Math.ceil(raw / step) * step
  const ticks = Array.from({ length: Math.round(max / step) + 1 }, (_, i) => i * step)

  return (
    <figure>
      <div className="h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 22, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke="var(--color-rule)" />
            <XAxis
              dataKey="ward"
              tickFormatter={(w: number) => `${w}`}
              tick={{ fill: 'var(--color-ink-2)', fontSize: 12 }}
              axisLine={{ stroke: 'var(--color-ink)' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, max]}
              ticks={ticks}
              tickFormatter={(v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : `${v}`)}
              tick={{ fill: 'var(--color-ink-3)', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip
              cursor={{ fill: 'var(--color-wash)' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const d = payload[0].payload as WardDatum
                return (
                  <div className="rounded-md border border-rule-2 bg-paper px-3 py-2.5 text-[13px] shadow-[0_4px_16px_rgb(0_0_0/0.08)]">
                    <p className="mb-1 font-semibold">Ward {d.ward}</p>
                    <p>
                      {int(d.speakers)} {language} home speakers
                    </p>
                    <p className="text-ink-3">{pct(d.shareOfWard)} of ward residents</p>
                    {d.caution && <p className="mt-1 text-ink-2">Zero may be a data gap. Use with caution.</p>}
                  </div>
                )
              }}
            />
            <Bar
              dataKey="speakers"
              isAnimationActive={false}
              shape={(props: unknown) => {
                // Bar and its label drawn together from the bar's own datum, so they cannot drift apart.
                const { x, y, width, height, payload } = props as { x: number; y: number; width: number; height: number; payload: WardDatum }
                const d = payload
                const cx = x + width / 2
                const isTop = top.has(d.ward)
                return (
                  <g>
                    {height > 0 && <rect x={x} y={y} width={width} height={height} rx={2} fill={isTop ? 'var(--color-ink)' : 'var(--color-rule-2)'} />}
                    {d.caution ? (
                      <>
                        <rect x={cx - 7} y={y - 32} width={14} height={14} rx={3} fill="#fff" stroke="var(--color-ink-3)" strokeDasharray="2 1.5" />
                        <text x={cx} y={y - 21.5} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--color-ink)">
                          E
                        </text>
                        <text x={cx} y={y - 6} textAnchor="middle" fontSize={11} fill="var(--color-ink-2)">
                          0
                        </text>
                      </>
                    ) : (
                      <text x={cx} y={y - 6} textAnchor="middle" fontSize={11} fill={isTop ? 'var(--color-ink)' : 'var(--color-ink-3)'} fontWeight={isTop ? 600 : 400}>
                        {d.speakers >= 1000 ? `${(d.speakers / 1000).toFixed(1)}k` : d.speakers}
                      </text>
                    )}
                  </g>
                )
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[12px] text-ink-3">
        <span>Ward. Three largest in ink.</span>
        <span>Home speakers of {language}, 2021 ward profile</span>
      </figcaption>
    </figure>
  )
}
