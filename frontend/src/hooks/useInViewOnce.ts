import { useEffect, useRef, useState } from 'react'

/**
 * True once the element has scrolled into view, and it stays true. Used to play an entrance once.
 * Without IntersectionObserver the content is simply shown, so nothing is ever left hidden.
 */
export function useInViewOnce<T extends Element>(threshold = 0.3) {
  const ref = useRef<T>(null)
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === 'undefined')

  useEffect(() => {
    const el = ref.current
    if (!el || seen) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [seen, threshold])

  return [ref, seen] as const
}
