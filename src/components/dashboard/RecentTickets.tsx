import Link from 'next/link'
import { ChevronRight, MessageSquare } from 'lucide-react'
import { tickets } from '@/lib/mock-data'
import { PriorityBadge, StatusBadge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'

export function RecentTickets() {
  return (
    <div className="divide-y divide-border">
      {tickets.slice(0, 6).map((t) => (
        <Link
          key={t.id}
          href={`/tickets/${t.number}`}
          className="group flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-white/[0.025]"
        >
          <span className="w-14 shrink-0 font-mono text-xs text-muted">#{t.number}</span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{t.subject}</p>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
              <span className="text-xs text-muted">{t.group}</span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="hidden items-center gap-1 text-xs text-muted sm:flex">
              <MessageSquare className="h-3.5 w-3.5" />
              {t.comments}
            </div>
            <span className="hidden w-14 shrink-0 text-right text-xs text-muted md:block">
              {t.updatedAt}
            </span>
            <Avatar
              person={t.assignee ?? { name: 'Unassigned', initials: '—', color: '#3f3f46' }}
              size="sm"
            />
            <ChevronRight className="h-4 w-4 text-muted/50 transition-transform group-hover:translate-x-0.5 group-hover:text-muted" />
          </div>
        </Link>
      ))}
    </div>
  )
}
