'use client'

import { useState, useTransition } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { Search, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

type StatusCount = { slug: string; name: string; count: number }
type PriorityOption = { slug: string; name: string }

export function TicketsToolbar({
  statusCounts,
  total,
  priorities,
}: {
  statusCounts: StatusCount[]
  total: number
  priorities: PriorityOption[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()
  const [search, setSearch] = useState(searchParams.get('q') ?? '')

  const activeStatus = searchParams.get('status') ?? ''
  const activePriority = searchParams.get('priority') ?? ''
  const activeSort = searchParams.get('sort') ?? 'lastActivityAt'
  const activeDir = searchParams.get('dir') ?? 'desc'

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete('page') // any filter change resets pagination
    startTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => pushParams({ status: null })}
          className={cn(
            'inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
            activeStatus === ''
              ? 'bg-white/[0.08] text-foreground'
              : 'text-muted hover:bg-white/[0.04] hover:text-muted-strong',
          )}
        >
          All
          <span
            className={cn(
              'rounded-md px-1.5 py-0.5 text-[11px]',
              activeStatus === ''
                ? 'bg-accent-soft text-accent-strong'
                : 'bg-white/[0.05] text-muted',
            )}
          >
            {total}
          </span>
        </button>
        {statusCounts.map((s) => (
          <button
            key={s.slug}
            type="button"
            onClick={() => pushParams({ status: s.slug })}
            className={cn(
              'inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150',
              activeStatus === s.slug
                ? 'bg-white/[0.08] text-foreground'
                : 'text-muted hover:bg-white/[0.04] hover:text-muted-strong',
            )}
          >
            {s.name}
            <span
              className={cn(
                'rounded-md px-1.5 py-0.5 text-[11px]',
                activeStatus === s.slug
                  ? 'bg-accent-soft text-accent-strong'
                  : 'bg-white/[0.05] text-muted',
              )}
            >
              {s.count}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <form
          className="relative min-w-[240px] flex-1"
          onSubmit={(e) => {
            e.preventDefault()
            pushParams({ q: search || null })
          }}
        >
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by subject or description…"
            className="h-9 w-full rounded-lg border border-border bg-white/[0.03] pl-9 pr-3 text-sm text-foreground placeholder:text-muted/70 outline-none transition-colors focus:border-accent/40 focus:bg-white/[0.05]"
          />
        </form>

        <div className="relative">
          <select
            value={activePriority}
            onChange={(e) => pushParams({ priority: e.target.value || null })}
            className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-white/[0.02] pl-3 pr-8 text-sm font-medium text-muted-strong outline-none transition-colors hover:bg-white/[0.06] hover:text-foreground focus:border-accent/40"
          >
            <option value="">All priorities</option>
            {priorities.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        </div>

        <div className="relative">
          <select
            value={`${activeSort}:${activeDir}`}
            onChange={(e) => {
              const [sort, dir] = e.target.value.split(':')
              pushParams({ sort, dir })
            }}
            className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-white/[0.02] pl-3 pr-8 text-sm font-medium text-muted-strong outline-none transition-colors hover:bg-white/[0.06] hover:text-foreground focus:border-accent/40"
          >
            <option value="lastActivityAt:desc">Sort: Last updated</option>
            <option value="createdAt:desc">Sort: Newest</option>
            <option value="createdAt:asc">Sort: Oldest</option>
            <option value="number:desc">Sort: Ticket # (high–low)</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
        </div>
      </div>
    </div>
  )
}
