import { useCountUp } from '../../hooks/useCountUp'
import { int, pct } from '../../lib/format'

/** Shows the value, then counts smoothly whenever it changes. Screen readers get the final value only. */
export function AnimatedNumber({ value, format = 'int' }: { value: number; format?: 'int' | 'pct' }) {
  const v = useCountUp(value)
  const text = format === 'pct' ? pct(v) : int(Math.round(v))
  const final = format === 'pct' ? pct(value) : int(value)
  return (
    <>
      <span aria-hidden className="tabular-nums">
        {text}
      </span>
      <span className="sr-only">{final}</span>
    </>
  )
}
