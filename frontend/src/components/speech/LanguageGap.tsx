import { useEffect, useRef, useState } from 'react'
import { pct } from '../../lib/format'
import { unitOf, type LanguagePair } from '../../lib/compare'

const SLIDE = 'transition-[left,width] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
const delay = (row: number) => `${row * 90 + 120}ms`

/**
 * Every fully tested language on one axis: a dark dot where AI guesses, a blue dot where it is told,
 * joined by a line. A long line is a big difference; no line, no difference. The axis starts at zero.
 */
export function LanguageGap({ pairs }: { pairs: LanguagePair[] }) {
  // The dots start at zero and slide to their values once, when the chart first comes into view.
  // (Plain transitions rather than scroll-linked animation: they always end on the true values.)
  const listRef = useRef<HTMLUListElement>(null)
  const [shown, setShown] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = listRef.current
    if (!el || shown) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true)
          io.disconnect()
        }
      },
      { threshold: 0.3 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [shown])
  const max = Math.max(...pairs.flatMap((p) => [p.auto.cer, p.forced.cer]))
  const top = Math.max(0.05, Math.ceil(max * 20) / 20)
  const at = (v: number) => `${(v / top) * 100}%`

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 text-[14px] text-ink-2">
        <span className="inline-flex items-center gap-2.5">
          <span aria-hidden className="h-[18px] w-[18px] rounded-full bg-ink" /> AI guesses the language
        </span>
        <span className="inline-flex items-center gap-2.5">
          <span aria-hidden className="h-[10px] w-[10px] rounded-full bg-[rgb(46_126_172)] ring-[3px] ring-paper outline outline-1 outline-rule-2" /> AI is told the language
        </span>
      </div>

      <ul ref={listRef} className="mt-8">
        {pairs.map((p, i) => {
          const lo = Math.min(p.auto.cer, p.forced.cer)
          const hi = Math.max(p.auto.cer, p.forced.cer)
          return (
            <li key={p.code} className="grid items-center gap-x-8 gap-y-3 border-t border-rule py-6 sm:grid-cols-[8rem_minmax(0,1fr)_11rem]">
              <p className="text-[19px] font-semibold tracking-[-0.01em]">{p.language}</p>
              <div
                role="img"
                aria-label={`${p.language}: ${pct(p.auto.cer)} of ${unitOf(p.code)} wrong when AI guesses, ${pct(p.forced.cer)} when told the language`}
                className="relative mx-[9px] h-9"
              >
                <span aria-hidden className="absolute inset-x-[-9px] top-1/2 h-px bg-rule-2" />
                <span
                  aria-hidden
                  className={`${SLIDE} absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-ink/20`}
                  style={{ left: shown ? at(lo) : '0%', width: shown ? `calc(${at(hi)} - ${at(lo)})` : '0%', transitionDelay: delay(i) }}
                />
                <span
                  aria-hidden
                  className={`${SLIDE} absolute top-1/2 h-[18px] w-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink`}
                  style={{ left: shown ? at(p.auto.cer) : '0%', transitionDelay: delay(i) }}
                />
                <span
                  aria-hidden
                  className={`${SLIDE} absolute top-1/2 h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgb(46_126_172)] ring-[3px] ring-paper`}
                  style={{ left: shown ? at(p.forced.cer) : '0%', transitionDelay: delay(i) }}
                />
              </div>
              <p className="text-[15px] text-ink-2 tabular-nums sm:text-right">
                <span className="font-semibold text-ink">{pct(p.auto.cer)}</span> <span aria-hidden>→</span> <span className="sr-only">to</span>{' '}
                <span className="font-semibold text-[rgb(32_96_136)]">{pct(p.forced.cer)}</span>
              </p>
            </li>
          )
        })}
      </ul>
      <div aria-hidden className="mx-[9px] flex justify-between border-t border-rule pt-3 text-[12px] text-ink-3 sm:mr-[calc(11rem+2rem+9px)] sm:ml-[calc(8rem+2rem+9px)]">
        <span>0%</span>
        <span>{pct(top, 0)} wrong</span>
      </div>
    </div>
  )
}
