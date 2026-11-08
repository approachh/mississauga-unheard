import type { ReactNode } from 'react'
import { FLAG_TEXT, type FlagKind } from '../lib/flags'
import { Flag } from './Flag'

interface NotesProps {
  flags: FlagKind[]
  sources: { label: string; value: ReactNode }[]
  children?: ReactNode
}

/** Statistical-release style footnotes: symbol legend, sources, method notes. */
export function Notes({ flags, sources, children }: NotesProps) {
  return (
    <footer id="notes" className="scroll-mt-28 border-t border-ink pt-5 text-[13px] leading-relaxed text-ink-2">
      <h2 className="mb-3 text-[13px] font-semibold text-ink">Notes</h2>
      <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
        {flags.length > 0 && (
          <dl className="space-y-1.5">
            {flags.map((f) => (
              <div key={f} className="flex gap-2">
                <dt className="-mt-0.5 shrink-0">
                  <Flag kind={f} />
                </dt>
                <dd>
                  {FLAG_TEXT[f]}.
                  {f === 'S' && ' Loaded from a *.sample.json file; replaced automatically when the real file is added.'}
                  {f === 'C' && ' Official figures come from the analysis pipeline.'}
                  {f === 'E' &&
                    ' A zero reported for Ward 10 may be a gap in the source data, not evidence that no speakers live there.'}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <dl className="space-y-1.5">
          {sources.map((s) => (
            <div key={s.label} className="grid grid-cols-[96px_1fr] gap-3">
              <dt className="text-ink-3">{s.label}</dt>
              <dd>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
      {children && <div className="mt-4 max-w-[70ch]">{children}</div>}
    </footer>
  )
}
