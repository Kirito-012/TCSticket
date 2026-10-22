'use client'

import { useCallback, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CalendarDays, Check, LayoutGrid, List, SlidersHorizontal } from 'lucide-react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { DATE_PRESETS, activeDatePreset } from '@/lib/date-presets'
import { cn } from '@/lib/utils'
import type { SectorOption } from '@/components/admin/AdminTicketFilters'
import { useT } from '@/i18n/client'

type Draft = {
  sector: string
  urgent: boolean
  verify: '' | 'verified' | 'unverified'
  /** Only the Done and All tabs have finished tickets to check. */
  showVerify: boolean
  status: string
  sort: 'activity' | 'newest' | 'oldest'
  view: 'cards' | 'list'
  from: string
  to: string
}

const SORTS: { key: Draft['sort']; label: string }[] = [
  { key: 'activity', label: 'Latest activity' },
  { key: 'newest', label: 'Newest first' },
  { key: 'oldest', label: 'Oldest first' },
]

const FIELD =
  'h-12 w-full rounded-xl border-2 border-border-strong bg-surface px-3 text-base text-foreground outline-none focus:border-accent'

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
        'inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 px-4 text-base font-semibold',
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
 * The phone way to filter the Tickets list: one "Filters" button (with a badge counting what is
 * on) that opens a bottom sheet holding every filter in plain sections. Choices are collected and
 * applied together with one "Show results" button, so the list reloads once, not after every tap.
 * The sheet itself (slide, drag-down-to-close) is the shared BottomSheet. Wide screens use the
 * inline filter row instead.
 */
export function AdminFilterSheet({
  sectors,
  statuses,
  current,
}: {
  sectors: SectorOption[]
  /** The statuses to choose from (already limited to the current tab). */
  statuses: { value: string; label: string }[]
  current: Draft
}) {
  const t = useT()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(current)

  const close = useCallback(() => setOpen(false), [])

  const activeCount =
    Number(current.sector !== '') +
    Number(current.urgent) +
    Number(current.verify !== '') +
    Number(current.status !== '') +
    Number(current.sort !== 'activity') +
    Number(current.from !== '' || current.to !== '') +
    Number(current.view !== 'cards')

  function openSheet() {
    setDraft(current) // always start from what the page is showing now
    setOpen(true)
  }

  function apply() {
    const params = new URLSearchParams(searchParams.toString())
    const set = (key: string, value: string | null) =>
      value ? params.set(key, value) : params.delete(key)
    set('sector', draft.sector || null)
    set('urgent', draft.urgent ? '1' : null)
    set('verify', draft.verify || null)
    set('status', draft.status || null)
    set('sort', draft.sort === 'activity' ? null : draft.sort)
    set('view', draft.view === 'cards' ? null : draft.view)
    set('from', draft.from || null)
    set('to', draft.to || null)
    params.delete('page')
    const qs = params.toString()
    setOpen(false)
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname))
  }

  function clearDraft() {
    setDraft({
      sector: '',
      urgent: false,
      verify: '',
      showVerify: current.showVerify,
      status: '',
      sort: 'activity',
      view: 'cards',
      from: '',
      to: '',
    })
  }

  const preset = activeDatePreset(draft.from, draft.to)
  const hasDates = Boolean(draft.from || draft.to)

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        className={cn(
          'flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 px-4 text-base font-bold',
          activeCount > 0
            ? 'border-accent bg-accent-soft text-accent-strong'
            : 'border-border-strong bg-surface text-foreground',
          pending && 'opacity-60',
        )}
      >
        <SlidersHorizontal className="h-5 w-5" strokeWidth={2.25} />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-accent px-2.5 py-0.5 text-sm font-bold text-on-accent">
            {activeCount}
          </span>
        )}
      </button>

      <BottomSheet
        open={open}
        onClose={close}
        title={t('Filters')}
        footer={
          <div className="flex gap-3">
            <button
              type="button"
              onClick={clearDraft}
              className="min-h-14 shrink-0 cursor-pointer rounded-2xl border-2 border-border-strong px-5 text-base font-bold text-foreground"
            >
              {t('Clear all')}
            </button>
            <button
              type="button"
              onClick={apply}
              className="min-h-14 flex-1 cursor-pointer rounded-2xl bg-accent px-5 text-lg font-bold text-on-accent"
            >
              {t('Show results')}
            </button>
          </div>
        }
      >
        <div className="space-y-6 px-5 py-4">
          <section>
            <h3 className="mb-2 text-base font-bold text-foreground">{t('Sector')}</h3>
            <select
              value={draft.sector}
              onChange={(e) => setDraft((d) => ({ ...d, sector: e.target.value }))}
              className={FIELD}
            >
              <option value="">{t('All sectors')}</option>
              {sectors.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </section>

          {statuses.length > 0 && (
            <section>
              <h3 className="mb-2 text-base font-bold text-foreground">{t('Status')}</h3>
              <div className="flex flex-wrap gap-2">
                <Choice
                  active={draft.status === ''}
                  onClick={() => setDraft((d) => ({ ...d, status: '' }))}
                >
                  {t('Any status')}
                </Choice>
                {statuses.map((s) => (
                  <Choice
                    key={s.value}
                    active={draft.status === s.value}
                    onClick={() => setDraft((d) => ({ ...d, status: s.value }))}
                  >
                    {s.label}
                  </Choice>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-base font-bold text-foreground">{t('Show only')}</h3>
            <Choice
              active={draft.urgent}
              onClick={() => setDraft((d) => ({ ...d, urgent: !d.urgent }))}
            >
              {draft.urgent && <Check className="h-4 w-4" strokeWidth={3} />}
              {t('Urgent tickets')}
            </Choice>
          </section>

          {draft.showVerify && (
            <section>
              <h3 className="mb-2 text-base font-bold text-foreground">{t('Verification')}</h3>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { key: '', label: 'All' },
                    { key: 'verified', label: 'Verified' },
                    { key: 'unverified', label: 'Not verified' },
                  ] as const
                ).map(({ key, label }) => (
                  <Choice
                    key={label}
                    active={draft.verify === key}
                    onClick={() => setDraft((d) => ({ ...d, verify: key }))}
                  >
                    {t(label)}
                  </Choice>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-2 text-base font-bold text-foreground">{t('Sort')}</h3>
            <div className="flex flex-wrap gap-2">
              {SORTS.map((s) => (
                <Choice
                  key={s.key}
                  active={draft.sort === s.key}
                  onClick={() => setDraft((d) => ({ ...d, sort: s.key }))}
                >
                  {t(s.label)}
                </Choice>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-2 flex items-center gap-2 text-base font-bold text-foreground">
              <CalendarDays className="h-5 w-5 text-muted-strong" />
              {t('Date')}
            </h3>
            <div className="flex flex-wrap gap-2">
              <Choice
                active={!hasDates}
                onClick={() => setDraft((d) => ({ ...d, from: '', to: '' }))}
              >
                {t('Any date')}
              </Choice>
              {DATE_PRESETS.map((p) => (
                <Choice
                  key={p.label}
                  active={preset?.label === p.label}
                  onClick={() => setDraft((d) => ({ ...d, from: p.from(), to: p.to() }))}
                >
                  {t(p.label)}
                </Choice>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-muted-strong">
                {t('From')}
                <input
                  type="date"
                  value={draft.from}
                  max={draft.to || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                  className={cn(FIELD, 'mt-1')}
                />
              </label>
              <label className="block text-sm font-semibold text-muted-strong">
                {t('To')}
                <input
                  type="date"
                  value={draft.to}
                  min={draft.from || undefined}
                  onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                  className={cn(FIELD, 'mt-1')}
                />
              </label>
            </div>
            <p className="mt-2 text-sm text-muted">
              {t('Dates are the day a ticket arrived (on the Done tab, the day it was finished).')}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-bold text-foreground">{t('Show tickets as')}</h3>
            <div className="flex gap-2">
              <Choice
                active={draft.view === 'cards'}
                onClick={() => setDraft((d) => ({ ...d, view: 'cards' }))}
              >
                <LayoutGrid className="h-5 w-5" />
                {t('Cards')}
              </Choice>
              <Choice
                active={draft.view === 'list'}
                onClick={() => setDraft((d) => ({ ...d, view: 'list' }))}
              >
                <List className="h-5 w-5" />
                {t('List')}
              </Choice>
            </div>
          </section>
        </div>
      </BottomSheet>
    </>
  )
}
