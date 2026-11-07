import { AlertTriangle, FileQuestion } from 'lucide-react'
import type { Dataset } from '../types/data'
import { Code } from './EmptyState'

interface DataIssuesProps {
  datasets: { label: string; file: string; ds: Dataset<unknown> }[]
}

/** Missing files, unreadable files and skipped rows. Sample state is shown by the shell banner. */
export function DataIssues({ datasets }: DataIssuesProps) {
  const items = datasets.flatMap(({ label, file, ds }) => {
    if (ds.status === 'missing')
      return [{ key: file, icon: FileQuestion, text: <>{label} not available yet. Waiting for <Code>{file}</Code>.</> }]
    if (ds.status === 'error')
      return [{ key: file, icon: AlertTriangle, text: <>Could not read <Code>{file}</Code>: {ds.error}</> }]
    if (ds.skipped > 0)
      return [
        {
          key: file,
          icon: AlertTriangle,
          text: (
            <>
              {ds.skipped} incomplete row{ds.skipped === 1 ? '' : 's'} in <Code>{file}</Code> skipped.
            </>
          ),
        },
      ]
    return []
  })
  if (!items.length) return null

  return (
    <ul className="space-y-1.5" role="status">
      {items.map(({ key, icon: Icon, text }) => (
        <li key={key} className="flex items-start gap-2.5 rounded-md border border-rule-2 bg-wash px-3.5 py-2.5 text-[14px] text-ink-2">
          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  )
}
