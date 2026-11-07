import { useEffect, useState } from 'react'
import type { Dataset } from '../types/data'

const initial: Dataset<never> = { status: 'loading', data: [], isSample: false, skipped: 0 }

/** Loads a dataset once on mount. `loader` must be a stable module-level function. */
export function useDataset<T>(loader: () => Promise<Dataset<T>>): Dataset<T> {
  const [state, setState] = useState<Dataset<T>>(initial)

  useEffect(() => {
    let cancelled = false
    loader().then((d) => {
      if (!cancelled) setState(d)
    })
    return () => {
      cancelled = true
    }
  }, [loader])

  return state
}
