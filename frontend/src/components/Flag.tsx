import { FLAG_TEXT, type FlagKind } from '../lib/flags'

const CLS: Record<FlagKind, string> = { S: 'flag-s', C: 'flag-c', E: 'flag-e' }

/** Superscript provenance flag, resolved in the page's Notes. */
export function Flag({ kind }: { kind: FlagKind }) {
  return (
    <sup className={`flag ${CLS[kind]}`} title={FLAG_TEXT[kind]}>
      <span aria-hidden>{kind}</span>
      <span className="sr-only">({FLAG_TEXT[kind]})</span>
    </sup>
  )
}
