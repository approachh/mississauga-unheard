import type { ReactNode } from 'react'

/** Ruled strip of key figures: ink rules top and bottom, hairlines between. */
export function KeyFigures({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 border-y border-ink lg:grid-cols-4">{children}</dl>
}

export function KeyFigure({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex flex-col-reverse justify-end border-rule px-0 py-4 odd:pr-4 even:border-l even:pl-4 lg:border-l lg:px-5 lg:first:border-l-0 lg:first:pl-0 [&:nth-child(n+3)]:border-t lg:[&:nth-child(n+3)]:border-t-0">
      <dt className="mt-2 text-[13px] text-ink-3">{label}</dt>
      <dd className="text-[28px] leading-none font-semibold tracking-[-0.02em]">{value}</dd>
    </div>
  )
}
