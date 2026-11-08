import { useEffect, useRef, useState } from 'react'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Shows `target` immediately on first render, then animates from the previous value to each
 * new target with an exponential ease-out. Data integrity first: if frames stall (background
 * tab, headless capture), a timer snaps to the real value, so a stale number never persists.
 */
export function useCountUp(target: number, duration = 650) {
  const [value, setValue] = useState(target)
  const current = useRef(target)

  useEffect(() => {
    if (prefersReducedMotion() || current.current === target) {
      current.current = target
      setValue(target)
      return
    }
    const start = current.current
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / duration)
      const v = p === 1 ? target : start + (target - start) * (1 - Math.pow(2, -10 * p))
      current.current = v
      setValue(v)
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const snap = window.setTimeout(() => {
      cancelAnimationFrame(raf)
      current.current = target
      setValue(target)
    }, duration + 150)
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(snap)
      current.current = target
    }
  }, [target, duration])

  return value
}
