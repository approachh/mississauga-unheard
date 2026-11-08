import { ChevronDown } from 'lucide-react'
import { useId, useState, type ReactNode } from 'react'

/** Expandable section. Height animates via grid rows; closed content is inert (hidden from focus and screen readers). */
export function Disclosure({ title, summary, children, id }: { title: string; summary?: string; children: ReactNode; id?: string }) {
  const [open, setOpen] = useState(false)
  const bodyId = useId()
  return (
    <div id={id} className="scroll-mt-28 border-b border-rule">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="group flex w-full items-center justify-between gap-6 py-5 text-left"
        >
          <span>
            <span className="block text-[17px] font-semibold tracking-[-0.01em] group-hover:underline">{title}</span>
            {summary && <span className="mt-0.5 block text-[14px] text-ink-3">{summary}</span>}
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-ink-3 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${open ? 'rotate-180 text-ink' : ''}`}
            aria-hidden
          />
        </button>
      </h3>
      <div id={bodyId} className="disclosure-body" data-open={open} inert={!open}>
        <div>
          <div className="pb-8">{children}</div>
        </div>
      </div>
    </div>
  )
}
