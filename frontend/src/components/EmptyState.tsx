import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  children?: ReactNode
}

export function EmptyState({ icon: Icon, title, children }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-1 rounded-md border border-dashed border-rule-2 bg-wash px-5 py-6">
      <Icon className="mb-2 h-[18px] w-[18px] text-ink-3" aria-hidden />
      <p className="font-medium">{title}</p>
      {children && <div className="max-w-[60ch] text-ink-3">{children}</div>}
    </div>
  )
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-md bg-wash ${className}`} />
}

export function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-[3px] bg-wash px-1 py-px font-mono text-[12px] text-ink">{children}</code>
}
