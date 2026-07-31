import { cn } from '@/lib/utils'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'

export function StatCard({
  label,
  value,
  delta,
  trend,
  icon,
  accent = 'accent',
}: {
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
  icon: React.ReactNode
  accent?: 'accent' | 'violet' | 'warning' | 'danger'
}) {
  const accentMap = {
    accent: 'text-accent-strong bg-accent-soft',
    violet: 'text-violet bg-violet-soft',
    warning: 'text-warning bg-warning-soft',
    danger: 'text-danger bg-danger-soft',
  }

  const isGood = trend === 'up'

  return (
    <div className="rounded-2xl border border-border bg-surface/60 p-5 backdrop-blur-sm transition-colors hover:bg-surface">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">{label}</p>
        <div
          className={cn('flex h-8 w-8 items-center justify-center rounded-lg', accentMap[accent])}
        >
          {icon}
        </div>
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-foreground">
        {value}
      </p>
      <div className="mt-2.5 flex items-center gap-1.5">
        <span
          className={cn(
            'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium',
            isGood ? 'bg-accent-soft text-accent-strong' : 'bg-danger-soft text-danger',
          )}
        >
          {isGood ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {delta}
        </span>
        <span className="text-xs text-muted">vs last week</span>
      </div>
    </div>
  )
}
