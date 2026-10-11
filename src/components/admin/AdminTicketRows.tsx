'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Loader2, UserCheck, X } from 'lucide-react'
import { AssigneeDropdown } from '@/components/tickets/AssigneeDropdown'
import { StatusSelect } from '@/components/tickets/StatusSelect'
import { Select } from '@/components/ui/Select'
import { cn, timeAgo } from '@/lib/utils'
import { isDone, isUrgent, plainTitle } from '@/lib/plain-words'
import { bulkAssignTicketsAction } from '@/server/actions/ticket.actions'
import type { TicketListItemView } from '@/lib/ticket-view'

type UserOption = { id: string; name: string }
type StatusOption = { id: string; name: string; color: string }

const NOBODY = '__nobody__'

// Checkbox, #, title, urgency, status, assignee, updated — only as a row on wide screens.
const ROW_GRID =
  'lg:grid lg:grid-cols-[28px_64px_minmax(0,1fr)_84px_150px_230px_72px] lg:items-center lg:gap-3'

/**
 * Compact list of tickets for Admins and Managers who work through many at a time: change the
 * status or assignee right in the row, or tick several and give them all to one person.
 */
export function AdminTicketRows({
  tickets,
  users,
  statuses,
  sectorNames,
  canAssign,
  canUpdate,
}: {
  tickets: TicketListItemView[]
  users: UserOption[]
  statuses: StatusOption[]
  sectorNames: Record<string, string>
  canAssign: boolean
  canUpdate: boolean
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [person, setPerson] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, startTransition] = useTransition()

  const allSelected = tickets.length > 0 && tickets.every((t) => selected.has(t.number))

  function toggle(number: number) {
    setMessage(null)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(number)) next.delete(number)
      else next.add(number)
      return next
    })
  }

  function toggleAll() {
    setMessage(null)
    setSelected(allSelected ? new Set() : new Set(tickets.map((t) => t.number)))
  }

  function assignSelected() {
    if (!person) return
    const numbers = [...selected]
    const label =
      person === NOBODY ? 'nobody' : (users.find((u) => u.id === person)?.name ?? 'that person')
    startTransition(async () => {
      const result = await bulkAssignTicketsAction(numbers, person === NOBODY ? null : person)
      if (result.error) {
        setMessage({ ok: false, text: result.error })
        return
      }
      setSelected(new Set())
      setPerson('')
      setMessage({
        ok: true,
        text: `Done — ${result.changed} ticket${result.changed === 1 ? '' : 's'} now assigned to ${label}.`,
      })
      router.refresh()
    })
  }

  return (
    <div className="space-y-3">
      {message && (
        <div
          role="status"
          className={cn(
            'rounded-2xl border-2 px-4 py-3 text-base font-semibold',
            message.ok
              ? 'border-accent bg-accent-soft text-accent-strong'
              : 'border-danger bg-danger-soft text-danger',
          )}
        >
          {message.text}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border-2 border-border-strong bg-surface">
        {/* Column headings (wide screens) */}
        <div
          className={cn(
            'hidden border-b-2 border-border bg-surface-hover px-4 py-3 text-sm font-semibold text-muted',
            ROW_GRID,
            'lg:grid',
          )}
        >
          {canAssign ? (
            <input
              type="checkbox"
              aria-label="Select all tickets on this page"
              checked={allSelected}
              onChange={toggleAll}
              className="h-5 w-5 cursor-pointer accent-[var(--accent)]"
            />
          ) : (
            <span />
          )}
          <span>#</span>
          <span>Ticket</span>
          <span>Urgency</span>
          <span>Status</span>
          <span>Who does this?</span>
          <span className="text-right">Updated</span>
        </div>

        <ul className="divide-y divide-border">
          {tickets.map((t) => {
            const urgent = !done(t) && isUrgent(t.priority)
            return (
              <li
                key={t.id}
                className={cn(
                  'flex flex-col gap-3 px-4 py-4',
                  ROW_GRID,
                  selected.has(t.number) && 'bg-accent-soft',
                )}
              >
                <div className="flex items-start gap-3 lg:contents">
                  {canAssign ? (
                    <label className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center lg:h-auto lg:w-auto">
                      <span className="sr-only">Select ticket #{t.number}</span>
                      <input
                        type="checkbox"
                        checked={selected.has(t.number)}
                        onChange={() => toggle(t.number)}
                        className="h-5 w-5 cursor-pointer accent-[var(--accent)]"
                      />
                    </label>
                  ) : (
                    <span className="hidden lg:block" />
                  )}
                  <span className="hidden font-mono text-sm text-muted lg:block">#{t.number}</span>
                  <Link href={`/tickets/${t.number}`} className="min-w-0 flex-1 lg:flex-none">
                    <p className="text-base font-semibold text-foreground [overflow-wrap:anywhere]">
                      <span className="font-mono text-sm text-muted lg:hidden">#{t.number} </span>
                      {plainTitle(t.subject)}
                    </p>
                    {t.sectorKey && (
                      <p className="mt-0.5 text-sm text-muted">
                        {sectorNames[t.sectorKey] ?? t.sectorKey}
                      </p>
                    )}
                  </Link>
                </div>

                <div className="flex flex-wrap items-center gap-2 pl-11 lg:contents lg:pl-0">
                  <div>
                    {urgent ? (
                      <span className="rounded-full bg-danger px-3 py-1 text-sm font-semibold text-white">
                        Urgent
                      </span>
                    ) : (
                      <span className="hidden text-sm text-muted lg:inline">—</span>
                    )}
                  </div>
                  <div>
                    <StatusSelect
                      ticketNumber={t.number}
                      statusId={t.statusId}
                      statuses={statuses}
                      disabled={!canUpdate}
                    />
                  </div>
                  <div className="min-w-0">
                    <AssigneeDropdown
                      ticketNumber={t.number}
                      assignee={t.assignee}
                      users={users}
                      disabled={!canAssign}
                    />
                  </div>
                  <span className="text-sm text-muted lg:text-right">{timeAgo(t.updatedAt)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      </div>

      {/* Bulk bar: appears as soon as one ticket is ticked. */}
      {selected.size > 0 && canAssign && (
        <div className="sticky bottom-24 z-30 rounded-2xl border-2 border-accent bg-surface p-4 shadow-lg lg:bottom-4">
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-lg font-bold text-foreground">
              <UserCheck className="h-6 w-6 text-accent-strong" />
              {selected.size} selected
            </p>
            <div className="w-full sm:w-72">
              <Select
                size="lg"
                value={person}
                onChange={setPerson}
                placeholder="Give them to…"
                options={[
                  { value: NOBODY, label: 'Nobody (take them off)' },
                  ...users.map((u) => ({ value: u.id, label: u.name })),
                ]}
              />
            </div>
            <button
              type="button"
              onClick={assignSelected}
              disabled={!person || pending}
              className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg bg-accent px-5 text-base font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
              )}
              Assign
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="inline-flex h-12 cursor-pointer items-center gap-2 rounded-lg border border-border-strong px-4 text-base font-semibold text-muted-strong hover:bg-surface-hover sm:ml-auto"
            >
              <X className="h-5 w-5" />
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function done(t: TicketListItemView) {
  return isDone(t.status)
}
