export type DiffKind = 'equal' | 'missed' | 'extra' | 'replaced'

export interface DiffToken {
  kind: DiffKind
  /** Word from the reference (absent for pure insertions). */
  ref?: string
  /** Word from the AI transcript (absent for pure deletions). */
  hyp?: string
}

const normalise = (w: string) => w.toLowerCase().replace(/[\p{P}\p{S}]/gu, '')

const tokenise = (s: string) => s.split(/\s+/).filter((w) => normalise(w).length > 0)

const stripMarks = (w: string) => normalise(w).normalize('NFD').replace(/\p{M}/gu, '')

/** Character similarity 0..1, used only to break ties between equally short alignments. */
function similarity(x: string, y: string): number {
  const a = stripMarks(x)
  const b = stripMarks(y)
  if (!a.length && !b.length) return 1
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length)
}

/**
 * Word-level Levenshtein alignment between reference and hypothesis, the alignment behind WER.
 * Case and punctuation are ignored. Among alignments with the same number of edits, the one
 * pairing the most similar words as substitutions wins (so "médico" pairs with "medico").
 * Note: scripts without spaces (e.g. Chinese) tokenise as one word; use CER there.
 */
export function diffWords(reference: string, hypothesis: string): DiffToken[] {
  const a = tokenise(reference)
  const b = tokenise(hypothesis)
  const n = a.length
  const m = b.length
  const EPS = 1 / (4 * (n + m + 1)) // tie-break weight; never outweighs one real edit

  const cost: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const same = normalise(a[i - 1]) === normalise(b[j - 1])
      const sub = same ? 0 : 1 + EPS * (1 - similarity(a[i - 1], b[j - 1]))
      cost[i][j] = Math.min(cost[i - 1][j - 1] + sub, cost[i - 1][j] + 1, cost[i][j - 1] + 1)
    }
  }

  const out: DiffToken[] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const same = normalise(a[i - 1]) === normalise(b[j - 1])
      const sub = same ? 0 : 1 + EPS * (1 - similarity(a[i - 1], b[j - 1]))
      if (Math.abs(cost[i][j] - (cost[i - 1][j - 1] + sub)) < 1e-9) {
        out.push({ kind: same ? 'equal' : 'replaced', ref: a[i - 1], hyp: b[j - 1] })
        i--
        j--
        continue
      }
    }
    if (i > 0 && Math.abs(cost[i][j] - (cost[i - 1][j] + 1)) < 1e-9) {
      out.push({ kind: 'missed', ref: a[--i] })
    } else {
      out.push({ kind: 'extra', hyp: b[--j] })
    }
  }
  return out.reverse()
}

/**
 * Character Error Rate: character edit distance / reference length, after lowercasing,
 * removing punctuation and collapsing whitespace. Null when the reference is empty.
 */
export function charErrorRate(reference: string, hypothesis: string): number | null {
  const prep = (s: string) => [...s.toLowerCase().replace(/[\p{P}\p{S}]/gu, '').replace(/\s+/g, ' ').trim()]
  const a = prep(reference)
  const b = prep(hypothesis)
  if (!a.length) return null
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length] / a.length
}

export interface DiffSummary {
  substitutions: number
  deletions: number
  insertions: number
  refWords: number
  errors: number
  /** (S + D + I) / N; null when the reference is empty. */
  wer: number | null
}

export function summarise(tokens: DiffToken[]): DiffSummary {
  const substitutions = tokens.filter((t) => t.kind === 'replaced').length
  const deletions = tokens.filter((t) => t.kind === 'missed').length
  const insertions = tokens.filter((t) => t.kind === 'extra').length
  const refWords = tokens.filter((t) => t.ref !== undefined).length
  const errors = substitutions + deletions + insertions
  return { substitutions, deletions, insertions, refWords, errors, wer: refWords ? errors / refWords : null }
}
