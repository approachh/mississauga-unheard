import type { ReactNode } from 'react'

/** Page-width container. Chapters are full-bleed; their content sits in this. */
export function Container({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-5 sm:px-8 ${className}`}>{children}</div>
}

type Tone = 'paper' | 'ink' | 'wash'

const TONES: Record<Tone, string> = {
  paper: 'bg-paper text-ink',
  ink: 'bg-ink text-paper',
  wash: 'bg-wash text-ink',
}

/**
 * A full-bleed chapter of the story: one idea, generous room.
 * `ink` chapters invert the palette; use `text-white/60` for secondary text inside them.
 */
export function Chapter({
  tone = 'paper',
  size = 'l',
  id,
  label,
  children,
  className = '',
}: {
  tone?: Tone
  size?: 'm' | 'l' | 'xl'
  id?: string
  label?: string
  children: ReactNode
  className?: string
}) {
  const pad = size === 'xl' ? 'py-28 sm:py-44' : size === 'l' ? 'py-24 sm:py-36' : 'py-16 sm:py-24'
  return (
    <section id={id} aria-label={label} className={`scroll-mt-14 ${TONES[tone]} ${pad} ${className}`}>
      <Container>{children}</Container>
    </section>
  )
}

/** A huge number with a short caption. The number is the visual. */
export function BigStat({
  value,
  label,
  flag,
  tone = 'paper',
  size = 'l',
}: {
  value: ReactNode
  label: ReactNode
  flag?: ReactNode
  tone?: 'paper' | 'ink'
  size?: 'l' | 'xl'
}) {
  return (
    <div className="reveal">
      <p className={`${size === 'xl' ? 'display-xl' : 'display-l'} tabular-nums`}>
        {value}
        {flag}
      </p>
      <p className={`mt-4 max-w-[30ch] text-[17px] leading-snug sm:text-[19px] ${tone === 'ink' ? 'text-white/60' : 'text-ink-2'}`}>{label}</p>
    </div>
  )
}

/** Splits text into words that rise in one after another (screen readers read the whole phrase). */
export function Words({ text, offset = 0, base = 0 }: { text: string; offset?: number; base?: number }) {
  return (
    <>
      <span className="sr-only">{text}</span>
      <span aria-hidden>
        {text.split(' ').map((w, i) => (
          <span key={i} className="word-in" style={{ ['--w' as string]: offset + i, ['--base' as string]: `${base}ms` }}>
            {w}
            {i < text.split(' ').length - 1 ? ' ' : ''}
          </span>
        ))}
      </span>
    </>
  )
}

/** Deterministic pseudo-random so the waveform looks organic but renders identically every time. */
const rand = (i: number) => {
  const x = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return x - Math.floor(x)
}

/**
 * The VOXELO waveform motif. Bars breathe slowly; `misheard` bars are proof red,
 * echoing the logo's last bar. Purely decorative.
 */
export function Waveform({
  bars = 56,
  misheard = [],
  tone = 'paper',
  className = '',
  animated = true,
}: {
  bars?: number
  misheard?: number[]
  tone?: 'paper' | 'ink'
  className?: string
  animated?: boolean
}) {
  const red = new Set(misheard)
  return (
    <div aria-hidden className={`flex h-24 items-center gap-[3px] sm:h-32 ${className}`}>
      {Array.from({ length: bars }, (_, i) => {
        const envelope = Math.sin((i / (bars - 1)) * Math.PI) * 0.75 + 0.25
        const h = Math.max(0.12, envelope * (0.45 + rand(i) * 0.55))
        return (
          <span
            key={i}
            className={`${animated ? 'wave-bar' : ''} block flex-1 rounded-full ${red.has(i) ? 'bg-proof' : tone === 'ink' ? 'bg-white/80' : 'bg-ink'}`}
            style={{ height: `${h * 100}%`, ['--d' as string]: (rand(i + 100) * 2.6).toFixed(2) }}
          />
        )
      })}
    </div>
  )
}
