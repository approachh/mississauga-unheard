import { Clock } from 'lucide-react'
import { PageTitle, Section } from '../components/Section'

interface ComingSoonProps {
  title: string
  lede: string
  planned: string[]
  note?: string
}

/** Placeholder for pages scheduled for a later phase. */
export function ComingSoon({ title, lede, planned, note }: ComingSoonProps) {
  return (
    <div className="space-y-12">
      <PageTitle title={title} lede={lede} />
      <p className="inline-flex items-center gap-2 rounded-md border border-rule-2 bg-wash px-3 py-1.5 text-[13px] text-ink-2">
        <Clock className="h-3.5 w-3.5" aria-hidden />
        In development. Nothing on this page is live yet.
      </p>
      <Section title="Planned">
        <ol className="divide-y divide-rule border-b border-rule">
          {planned.map((p, i) => (
            <li key={p} className="grid grid-cols-[32px_1fr] py-3">
              <span className="text-ink-3">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
        {note && <p className="mt-4 max-w-[65ch] text-[14px] text-ink-3">{note}</p>}
      </Section>
    </div>
  )
}
