import type { ReactNode } from 'react'

interface SectionProps {
  id?: string
  title: string
  description?: ReactNode
  action?: ReactNode
  children: ReactNode
}

/** Ruled section: heading on a full-width ink rule, no container box. */
export function Section({ id, title, description, action, children }: SectionProps) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className="scroll-mt-28">
      <header className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-t border-ink pt-4">
        <div className="max-w-[65ch]">
          <h2 id={id ? `${id}-h` : undefined} className="text-xl font-semibold tracking-[-0.015em]">
            {title}
          </h2>
          {description && <p className="mt-1 text-ink-3">{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}

/** Page title block for app pages. */
export function PageTitle({ title, lede }: { title: string; lede: ReactNode }) {
  return (
    <header className="max-w-[68ch]">
      <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.75rem]">{title}</h1>
      <p className="mt-3 text-[17px] leading-relaxed text-ink-2">{lede}</p>
    </header>
  )
}
