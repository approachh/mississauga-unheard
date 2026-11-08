import { useEffect, useState, type ReactNode } from 'react'
import type { DiffToken } from '../../lib/diff'
import { titleCase } from '../../lib/format'
import { Flag } from '../Flag'
import { Waveform } from './Story'

export interface LiveExample {
  id: string
  language: string
  tokens: DiffToken[]
}

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

// Mark styles tuned for the dark card (proof red, lightened for contrast on ink).
const SAID: Record<DiffToken['kind'], string> = {
  equal: '',
  replaced: 'underline decoration-[#ff6b5e] decoration-2 underline-offset-[5px]',
  missed: 'text-[#ff8a80] line-through decoration-[#ff6b5e] decoration-2',
  extra: '',
}
const HEARD: Record<DiffToken['kind'], string> = {
  equal: '',
  replaced: 'text-[#ff8a80] underline decoration-[#ff6b5e] decoration-2 underline-offset-[5px]',
  missed: '',
  extra: 'rounded bg-[#ff6b5e]/25 px-1 text-[#ffb3ab]',
}

/**
 * Hero demo: cycles through example transcripts. The said line types in word by word,
 * then the heard line, with every mistake marked. Static under reduced motion.
 */
export function LiveTranscript({ examples, isSample }: { examples: LiveExample[]; isSample: boolean }) {
  const [index, setIndex] = useState(0)
  const ex = examples[index % Math.max(1, examples.length)]

  const said = ex ? ex.tokens.filter((t) => t.ref !== undefined) : []
  const heardBase = said.length * 70 + 450

  useEffect(() => {
    if (examples.length < 2 || reduced()) return
    const hold = heardBase + ex.tokens.length * 70 + 3800
    const t = window.setTimeout(() => setIndex((i) => (i + 1) % examples.length), hold)
    return () => window.clearTimeout(t)
  }, [index, examples.length, heardBase, ex])

  return (
    <figure className="relative overflow-hidden rounded-[28px] bg-ink p-7 text-paper shadow-[0_30px_80px_-30px_rgb(0_0_0/0.45)] sm:p-10">
      <figcaption className="flex items-center justify-between gap-4 text-[13px] text-white/55">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff6b5e] opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#ff6b5e]" />
          </span>
          Live transcript
        </span>
        {ex && (
          <span key={ex.id} className="swap-in">
            {titleCase(ex.language)}
            {isSample && <Flag kind="S" />}
          </span>
        )}
      </figcaption>

      <Waveform bars={36} tone="ink" misheard={[7, 8, 21, 29]} className="mt-6 !h-14 sm:!h-16" />

      {ex ? (
        <div key={ex.id} className="mt-8 min-h-[9.5rem] space-y-5 text-[clamp(1.25rem,2.1vw,1.625rem)] leading-snug" dir="auto">
          <Line label="Said">
            {said.map((t, i) => (
              <span key={i} className="word-in" style={{ ['--w' as string]: i }}>
                <span className={SAID[t.kind]}>{t.ref}</span>&nbsp;
              </span>
            ))}
          </Line>
          <Line label="Heard">
            {ex.tokens.map((t, i) =>
              t.hyp === undefined ? (
                <span key={i} className="word-in mx-1 inline-block h-[0.55em] w-[0.55em] rotate-45 border-r-2 border-b-2 border-[#ff6b5e] align-middle" style={{ ['--w' as string]: i, ['--base' as string]: `${heardBase}ms` }} aria-label={`missing: ${t.ref}`} role="img" />
              ) : (
                <span key={i} className="word-in" style={{ ['--w' as string]: i, ['--base' as string]: `${heardBase}ms` }}>
                  <span className={HEARD[t.kind]}>{t.hyp}</span>&nbsp;
                </span>
              ),
            )}
          </Line>
        </div>
      ) : (
        <p className="mt-8 text-white/60">Examples appear once transcripts are published.</p>
      )}

      {examples.length > 1 && (
        <div className="mt-8 flex gap-1.5" role="tablist" aria-label="Examples">
          {examples.map((e, i) => (
            <button
              key={e.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Example ${i + 1}: ${titleCase(e.language)}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? 'w-8 bg-paper' : 'w-1.5 bg-white/30 hover:bg-white/60'}`}
            />
          ))}
        </div>
      )}
    </figure>
  )
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3">
      <span className="pt-[0.45em] text-[12px] font-medium tracking-wide text-white/45 uppercase">{label}</span>
      <p>{children}</p>
    </div>
  )
}
