import { ArrowRight } from 'lucide-react'
import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { CensusModel } from '../../lib/census'
import { CountUp } from '../story/CountUp'
import { int } from '../../lib/format'
import type { CitywideLanguage } from '../../types/data'

const listNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))

/** Segments narrower than this share of the bar are too thin for an inline label. */
const LABEL_MIN = 0.075

/**
 * The opening finding as one proportional bar of home-speaker counts, split by whether the
 * reviewed datasets hold service-request recordings. Every segment is named by a readout
 * (hover, tap, focus, arrow keys) and by a linked legend, so thin segments stay identifiable.
 */
export function Discovery({ model, onSelect }: { model: CensusModel; onSelect: (l: CitywideLanguage) => void }) {
  const { uncovered, covered, assessed, notAssessed, uncoveredCountSum } = model
  const segments = [...uncovered, ...covered]
  const total = assessed.reduce((n, r) => n + r.home_speakers, 0) || 1

  const [active, setActive] = useState(0)
  const [engaged, setEngaged] = useState(false)
  const segRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Caret sits over the real centre of the active segment, measured so gaps don't skew it.
  const barRef = useRef<HTMLDivElement>(null)
  const [caret, setCaret] = useState<number | null>(null)
  useLayoutEffect(() => {
    const measure = () => {
      // Layout offsets (not getBoundingClientRect) so the draw-in scale animation can't skew them.
      const seg = segRefs.current[active]
      if (!seg) return
      setCaret(seg.offsetLeft + seg.offsetWidth / 2)
    }
    measure()
    const ro = new ResizeObserver(measure)
    if (barRef.current) ro.observe(barRef.current)
    return () => ro.disconnect()
  }, [active])

  const current = segments[active]
  const isMissing = active < uncovered.length
  const focus = (i: number) => {
    setActive(i)
    setEngaged(true)
  }
  const onKey = (e: KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? segments.length - 1 : null
    if (next === null) return
    e.preventDefault()
    const j = Math.max(0, Math.min(segments.length - 1, next))
    segRefs.current[j]?.focus()
  }

  const segment = (r: CitywideLanguage, i: number) => {
    const share = r.home_speakers / total
    const missing = i < uncovered.length
    const dim = engaged && i !== active
    return (
      <button
        key={r.language}
        ref={(el) => {
          segRefs.current[i] = el
        }}
        type="button"
        tabIndex={i === active ? 0 : -1}
        aria-label={`${r.language}: ${int(r.home_speakers)} home speakers, ${missing ? 'no' : 'has'} service-request recordings in the reviewed datasets`}
        aria-pressed={i === active}
        onMouseEnter={() => focus(i)}
        onFocus={() => focus(i)}
        onClick={() => focus(i)}
        onKeyDown={(e) => onKey(e, i)}
        style={{ flexGrow: r.home_speakers, flexBasis: 0, ['--i' as string]: i }}
        className={`grow-x relative min-w-[4px] overflow-hidden text-left outline-offset-2 transition-[opacity,transform] duration-200 ease-out first:rounded-l-md last:rounded-r-md ${
          missing ? 'bg-ink text-paper' : 'bg-rule-2 text-ink'
        } ${dim ? 'opacity-35' : ''} ${i === active && engaged ? 'z-10 -translate-y-0.5' : ''}`}
      >
        {share >= LABEL_MIN && (
          <span className="pointer-events-none absolute bottom-2 left-2 hidden text-[12px] leading-none font-medium sm:block">{r.language}</span>
        )}
      </button>
    )
  }

  return (
    <section aria-labelledby="discovery-h" className="space-y-14 sm:space-y-20">
      <div className="grid items-end gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:gap-14">
        <p className="reveal display-xl tabular-nums" aria-hidden>
          <CountUp value={uncovered.length} duration={700} />
          <span className="text-ink-3">/{assessed.length}</span>
        </p>
        <div className="reveal max-w-[36ch] space-y-4">
          <h2 id="discovery-h" className="lede font-semibold text-ink">
            {uncovered.length} of the {assessed.length} languages we checked have no recordings of everyday requests in the
            speech datasets we reviewed.
          </h2>
          <p className="text-[15px] leading-relaxed text-ink-3">
            A gap in test material, not proof that AI fails them, or that they were never tested elsewhere.
          </p>
        </div>
      </div>

      <figure className="reveal" onMouseLeave={() => setEngaged(false)}>
        {/* Readout: names the active segment; the caret slides to it */}
        <div className="relative pb-3.5" aria-live="polite">
          <div key={current.language} className="swap-in flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-[1.375rem] font-semibold tracking-[-0.02em]">{current.language}</span>
            <span className="text-[15px] tabular-nums text-ink-2">{int(current.home_speakers)} home speakers</span>
            <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
              <span className={`h-2 w-2 rounded-[2px] ${isMissing ? 'bg-ink' : 'bg-rule-2'}`} aria-hidden />
              {isMissing ? 'No service-request recordings' : 'Has service-request recordings'}
            </span>
            <button
              type="button"
              onClick={() => onSelect(current)}
              className="group ml-auto inline-flex items-center gap-1 text-[14px] font-medium text-ink hover:underline"
            >
              Explore {current.language}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
            </button>
          </div>
          <span
            aria-hidden
            className="select-indicator absolute bottom-1 h-0 w-0 -translate-x-1/2 border-x-[6px] border-t-[7px] border-x-transparent border-t-ink"
            style={{ left: caret ?? 0, opacity: caret === null ? 0 : 1 }}
          />
        </div>

        {/* The bar */}
        <div ref={barRef} className="relative flex h-20 gap-1.5 sm:h-28" role="group" aria-label="Home speakers of the languages we checked. Use arrow keys to move between languages.">
          <div className="flex gap-[2px]" style={{ flexGrow: uncoveredCountSum, flexBasis: 0 }}>
            {uncovered.map((r, i) => segment(r, i))}
          </div>
          <div className="flex gap-[2px]" style={{ flexGrow: total - uncoveredCountSum, flexBasis: 0 }}>
            {covered.map((r, i) => segment(r, uncovered.length + i))}
          </div>
        </div>

        {/* Linked legend: each group's names sit under its own part of the bar, in bar order */}
        <figcaption className="mt-3">
          <div className="flex gap-1.5">
            {[
              { label: 'No service-request recordings', items: uncovered, offset: 0, grow: uncoveredCountSum, strong: true },
              { label: 'Has recordings', items: covered, offset: uncovered.length, grow: total - uncoveredCountSum, strong: false },
            ].map((g) => (
              <div key={g.label} className="min-w-0" style={{ flexGrow: g.grow, flexBasis: 0 }}>
                <p className={`border-t pt-1.5 text-[12px] ${g.strong ? 'border-ink font-medium text-ink' : 'border-rule-2 text-ink-3'}`}>
                  {g.label} · {g.items.length}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-x-0.5 gap-y-0.5" aria-label={g.label}>
                  {g.items.map((r, k) => {
                    const i = g.offset + k
                    const on = i === active && engaged
                    return (
                      <li key={r.language}>
                        <button
                          type="button"
                          tabIndex={-1}
                          onMouseEnter={() => focus(i)}
                          onClick={() => focus(i)}
                          className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2 text-[13px] transition-colors duration-150 ${
                            on ? 'border-ink text-ink' : 'border-transparent text-ink-2 hover:text-ink'
                          }`}
                        >
                          <span className={`h-2 w-2 shrink-0 rounded-[2px] ${g.strong ? 'bg-ink' : 'bg-rule-2'}`} aria-hidden />
                          {r.language}
                          <span className="hidden tabular-nums text-ink-3 sm:inline">{compact(r.home_speakers)}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-8 max-w-[64ch] text-[13px] leading-relaxed text-ink-3">
            Width is home speakers. Hover or tap to explore. The {uncovered.length} languages without recordings add up to{' '}
            <strong className="font-semibold text-ink-2">{int(uncoveredCountSum)}</strong> home-speaker counts (a person
            can be counted twice).
            {notAssessed.length > 0 && ` Not checked: ${listNames(notAssessed.map((r) => r.language))}.`}
          </p>
        </figcaption>
      </figure>
    </section>
  )
}
