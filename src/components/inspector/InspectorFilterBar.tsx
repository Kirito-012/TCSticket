'use client'

import { useCallback, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, Check, SlidersHorizontal } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/client'
import {
  DEFAULT_INSPECTOR_FILTERS,
  activeFilterCount,
  inspectorHref,
  type InspectorFilters,
  type InspectorShow,
  type InspectorSort,
  type InspectorWhen,
} from '@/lib/inspector-filters'

const SORT_CHOICES: { key: InspectorSort; label: string }[] = [
  { key: 'urgent', label: 'Urgent first' },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
]

const WHEN_CHOICES: { key: InspectorWhen; label: string }[] = [
  { key: 'any', label: 'Any time' },
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
]

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 text-base font-bold',
        active
          ? 'border-accent bg-accent text-on-accent'
          : 'border-border-strong bg-surface text-muted-strong',
      )}
    >
      {children}
    </button>
  )
}

/**
 * Surveyor filters, kept simple: one big "Filter and sort" button that opens a bottom sheet
 * of big choices — how to sort, when the ticket arrived (or one exact day), urgent only. Choices
 * are collected and applied together with one "Show tickets" button. The sheet can be dragged
 * down to close. The badge shows how many filters are on, so an inspector can always see why
 * their list looks shorter.
 */
export function InspectorFilterBar({
  show,
  filters,
}: {
  show: InspectorShow
  filters: InspectorFilters
}) {
  const router = useRouter()
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<InspectorFilters>(filters)
  const close = useCallback(() => setOpen(false), [])
  const count = activeFilterCount(filters)

  function openSheet() {
    setDraft(filters) // always start from what the list is showing now
    setOpen(true)
  }

  function apply() {
    setOpen(false)
    startTransition(() => router.push(inspectorHref(show, draft)))
  }

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={cn(
          'flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-2xl border-2 px-5 text-lg font-bold',
          count > 0
            ? 'border-accent bg-accent-soft text-accent-strong'
            : 'border-border-strong bg-surface text-foreground',
          pending && 'opacity-60',
        )}
      >
        <SlidersHorizontal className="h-6 w-6" strokeWidth={2.25} />
        {t('Filter and sort')}
        {count > 0 && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-base font-bold text-on-accent">
            {count}
          </span>
        )}
        <span className="ml-auto text-base font-semibold text-muted">{t('Change')}</span>
      </button>

      <BottomSheet
        open={open}
        onClose={close}
        title={t('Filter and sort')}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setDraft(DEFAULT_INSPECTOR_FILTERS)}
              className="min-h-14 shrink-0 cursor-pointer rounded-2xl border-2 border-border-strong px-5 text-base font-bold text-foreground"
            >
              {t('Clear all')}
            </button>
            <button
              type="button"
              onClick={apply}
              className="min-h-14 flex-1 cursor-pointer rounded-2xl bg-accent px-5 text-lg font-bold text-on-accent"
            >
              {t('Show tickets')}
            </button>
          </div>
        }
      >
        <div className="space-y-6 px-5 py-4">
          <section>
            <h3 className="mb-2 text-base font-bold text-foreground">{t('Sort')}</h3>
            <div className="flex flex-wrap gap-2">
              {SORT_CHOICES.map((c) => (
                <Choice
                  key={c.key}
                  active={draft.sort === c.key}
                  onClick={() => setDraft((d) => ({ ...d, sort: c.key }))}
                >
                  {t(c.label)}
                </Choice>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 text-base font-bold text-foreground">{t('When did it arrive?')}</h3>
            <div className="flex flex-wrap gap-2">
              {WHEN_CHOICES.map((c) => (
                <Choice
                  key={c.key}
                  active={!draft.on && draft.when === c.key}
                  onClick={() => setDraft((d) => ({ ...d, when: c.key, on: '' }))}
                >
                  {t(c.label)}
                </Choice>
              ))}
            </div>
            <label className="mt-3 block">
              <span className="mb-1 flex items-center gap-2 text-base font-semibold text-muted-strong">
                <CalendarDays className="h-5 w-5" />
                {t('Or pick one day')}
              </span>
              <input
                type="date"
                value={draft.on}
                onChange={(e) => setDraft((d) => ({ ...d, on: e.target.value }))}
                className="h-12 w-full rounded-2xl border-2 border-border-strong bg-surface px-3 text-base text-foreground outline-none focus:border-accent"
              />
            </label>
          </section>

          {show === 'done' && (
            <section>
              <h3 className="mb-2 text-base font-bold text-foreground">{t('Verification')}</h3>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: 'any', label: 'Any' },
                    { key: 'yes', label: 'Verified' },
                    { key: 'no', label: 'Not verified' },
                  ] as const
                ).map((c) => (
                  <Choice
                    key={c.key}
                    active={draft.verified === c.key}
                    onClick={() => setDraft((d) => ({ ...d, verified: c.key }))}
                  >
                    {t(c.label)}
                  </Choice>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-base font-bold text-foreground">{t('Only')}</h3>
            <div className="flex flex-wrap gap-2">
              <Choice
                active={draft.urgentOnly}
                onClick={() => setDraft((d) => ({ ...d, urgentOnly: !d.urgentOnly }))}
              >
                {draft.urgentOnly && <Check className="h-4 w-4" strokeWidth={3} />}
                {t('Urgent tickets')}
              </Choice>
              {show === 'todo' && (
                <Choice
                  active={draft.reopenedOnly}
                  onClick={() => setDraft((d) => ({ ...d, reopenedOnly: !d.reopenedOnly }))}
                >
                  {draft.reopenedOnly && <Check className="h-4 w-4" strokeWidth={3} />}
                  {t('Reopened')}
                </Choice>
              )}
            </div>
          </section>
        </div>
      </BottomSheet>
    </>
  )
}
