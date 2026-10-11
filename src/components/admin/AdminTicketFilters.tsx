'use client'

import { useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AlertTriangle, CalendarDays, LayoutGrid, List } from 'lucide-react'
import { Select } from '@/components/ui/Select'
import { DATE_PRESETS, activeDatePreset } from '@/lib/date-presets'
import { cn } from '@/lib/utils'

export type SectorOption = { value: string; label: string }

const SORTS = [
  { value: 'activity', label: 'Latest activity' },
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
]

/**
 * The inline filter rows for wider screens (phones use the "Filters" bottom sheet instead — see
 * AdminFilterSheet): sector, urgent only, sort, cards or list, and a date row with quick choices
 * or a custom From and To. (The dates mean the day a ticket arrived — or, on the Done tab, the
 * day it was finished.) Everything lives in the address, so a filtered view can be bookmarked or
 * shared, and Back works.
 */
export function AdminTicketFilters({
  sectors,
  sector,
  urgent,
  sort,
  view,
  from,
  to,
}: {
  sectors: SectorOption[]
  sector: string
  urgent: boolean
  sort: string
  view: 'cards' | 'list'
  from: string
  to: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()

  function push(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    params.delete('page') // any filter change goes back to page 1
    const qs = params.toString()
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  const hasDates = Boolean(from || to)
  const activePreset = activeDatePreset(from, to)

  return (
    <div className={cn('hidden space-y-3 transition-opacity sm:block', pending && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-64">
          <Select
            size="lg"
            value={sector}
            onChange={(v) => push({ sector: v || null })}
            placeholder="All sectors"
            options={[{ value: '', label: 'All sectors' }, ...sectors]}
          />
        </div>

        <button
          type="button"
          aria-pressed={urgent}
          onClick={() => push({ urgent: urgent ? null : '1' })}
          className={cn(
            'inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg border px-4 text-base font-semibold transition-colors',
            urgent
              ? 'border-danger bg-danger text-white'
              : 'border-border-strong text-muted-strong hover:bg-surface-hover',
          )}
        >
          <AlertTriangle className="h-5 w-5" />
          Urgent only
        </button>

        <div className="w-52">
          <Select
            size="lg"
            value={sort}
            onChange={(v) => push({ sort: v === 'activity' ? null : v })}
            options={SORTS}
          />
        </div>

        <div
          role="group"
          aria-label="How to show tickets"
          className="ml-auto inline-flex h-12 overflow-hidden rounded-lg border border-border-strong"
        >
          {(
            [
              { key: 'cards', label: 'Cards', icon: LayoutGrid },
              { key: 'list', label: 'List', icon: List },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={view === key}
              onClick={() => push({ view: key === 'cards' ? null : key })}
              className={cn(
                'inline-flex cursor-pointer items-center gap-2 px-4 text-base font-semibold transition-colors',
                view === key
                  ? 'bg-accent text-on-accent'
                  : 'text-muted-strong hover:bg-surface-hover',
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by date">
        <span className="mr-1 inline-flex items-center gap-2 text-base font-semibold text-muted-strong">
          <CalendarDays className="h-5 w-5" />
          Date
        </span>

        <button
          type="button"
          aria-pressed={!hasDates}
          onClick={() => push({ from: null, to: null })}
          className={cn(
            'inline-flex h-12 cursor-pointer items-center rounded-lg border px-4 text-base font-semibold transition-colors',
            !hasDates
              ? 'border-accent bg-accent text-on-accent'
              : 'border-border-strong text-muted-strong hover:bg-surface-hover',
          )}
        >
          Any date
        </button>

        {DATE_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            aria-pressed={activePreset?.label === p.label}
            onClick={() => push({ from: p.from(), to: p.to() })}
            className={cn(
              'inline-flex h-12 cursor-pointer items-center rounded-lg border px-4 text-base font-semibold transition-colors',
              activePreset?.label === p.label
                ? 'border-accent bg-accent text-on-accent'
                : 'border-border-strong text-muted-strong hover:bg-surface-hover',
            )}
          >
            {p.label}
          </button>
        ))}

        <label className="flex items-center gap-2 text-base font-semibold text-muted-strong">
          From
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => push({ from: e.target.value || null })}
            className="h-12 rounded-lg border border-border-strong bg-surface px-3 text-base text-foreground outline-none focus:border-accent"
          />
        </label>
        <label className="flex items-center gap-2 text-base font-semibold text-muted-strong">
          To
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => push({ to: e.target.value || null })}
            className="h-12 rounded-lg border border-border-strong bg-surface px-3 text-base text-foreground outline-none focus:border-accent"
          />
        </label>
      </div>
    </div>
  )
}
