import type { CSSProperties, ReactNode } from 'react'
import type { DiffToken } from '../lib/diff'

/**
 * Said / Heard lines with proof-style marks.
 * Said:  substituted words underlined, missed words struck.
 * Heard: substituted words in red, inserted words tinted, a caret where a word went missing.
 */
export function ProofLines({ tokens, size = 'md' }: { tokens: DiffToken[]; size?: 'md' | 'lg' }) {
  // Stagger index for the draw-in animation: nth marked token in reading order.
  const order = tokens.map((_, i) => tokens.slice(0, i).filter((u) => u.kind !== 'equal').length)
  const idx = (i: number) => ({ '--i': order[i] }) as CSSProperties

  const said = tokens.map((t, i) => {
    if (t.ref === undefined) return null
    const cls = t.kind === 'replaced' ? 'mark-ref' : t.kind === 'missed' ? 'mark-del' : ''
    return (
      <span key={i}>
        <span className={cls} style={cls === 'mark-ref' ? idx(i) : undefined}>
          {t.ref}
        </span>{' '}
      </span>
    )
  })

  const heard = tokens.map((t, i) => {
    if (t.hyp === undefined)
      return <span key={i} className="mark-gap" title={`Not heard: ${t.ref}`} aria-label={`missing word: ${t.ref}`} role="img" />
    const cls = t.kind === 'replaced' ? 'mark-sub' : t.kind === 'extra' ? 'mark-ins' : ''
    return (
      <span key={i}>
        <span className={cls} style={cls ? idx(i) : undefined}>
          {t.hyp}
        </span>{' '}
      </span>
    )
  })

  const text = size === 'lg' ? 'text-[20px] leading-[1.6] sm:text-[22px]' : 'text-[16px] leading-[1.65]'
  return (
    <dl className={`grid grid-cols-[56px_minmax(0,1fr)] gap-x-4 gap-y-2 ${text}`}>
      <Label>Said</Label>
      <dd dir="auto">{said}</dd>
      <Label>Heard</Label>
      <dd dir="auto">{tokens.length ? heard : <span className="text-ink-3">(nothing)</span>}</dd>
    </dl>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <dt className="pt-[0.35em] text-[13px] leading-none font-medium text-ink-3">{children}</dt>
}

export function DiffLegend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-ink-2">
      <li>
        <span className="mark-sub">word</span> substituted
      </li>
      <li>
        <span className="mark-del">word</span> not heard
        <span className="mark-gap ml-1.5" aria-hidden />
      </li>
      <li>
        <span className="mark-ins">word</span> inserted
      </li>
    </ul>
  )
}
