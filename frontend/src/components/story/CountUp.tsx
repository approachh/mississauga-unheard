import { useEffect, useRef, useState } from 'react'

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A number that counts up from zero the first time it scrolls into view.
 * Renders the real value by default (no JS, reduced motion, or stalled frames all show the true
 * number), and a timer snaps to the target if animation frames stop.
 */
export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString('en-CA'),
  duration = 1100,
}: {
  value: number
  format?: (n: number) => string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)
  const done = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el || done.current || reduced() || typeof IntersectionObserver === 'undefined') {
      setShown(value)
      return
    }
    let raf = 0
    let snap = 0
    // Fires slightly before the number enters the viewport, so the reset to 0 is never seen.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || done.current) return
        done.current = true
        io.disconnect()
        const t0 = performance.now()
        const tick = (now: number) => {
          const p = Math.min(1, (now - t0) / duration)
          setShown(p === 1 ? value : value * (1 - Math.pow(2, -10 * p)))
          if (p < 1) raf = requestAnimationFrame(tick)
        }
        setShown(0)
        raf = requestAnimationFrame(tick)
        snap = window.setTimeout(() => {
          cancelAnimationFrame(raf)
          setShown(value)
        }, duration + 200)
      },
      { rootMargin: '0px 0px 10% 0px' },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf)
      window.clearTimeout(snap)
      setShown(value)
    }
  }, [value, duration])

  return (
    <span ref={ref} className="tabular-nums">
      <span aria-hidden>{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}
