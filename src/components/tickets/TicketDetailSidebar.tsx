'use client'

import { useState, useTransition } from 'react'
import { Loader2 } from 'lucide-react'
import { updateTicketFieldAction } from '@/server/actions/ticket.actions'
import { timeAgo } from '@/lib/utils'

type Option = { id: string; name: string }
type UserOption = { id: string; name: string }

export function TicketDetailSidebar({
  ticketNumber,
  statusId,
  assigneeId,
  priorityId,
  typeId,
  dueDate,
  statuses,
  priorities,
  types,
  users,
  canUpdate,
  canAssign,
}: {
  ticketNumber: number
  statusId: string | null
  assigneeId: string | null
  priorityId: string | null
  typeId: string | null
  dueDate: string | null
  statuses: Option[]
  priorities: Option[]
  types: Option[]
  users: UserOption[]
  canUpdate: boolean
  canAssign: boolean
}) {
  const [values, setValues] = useState({ statusId, assigneeId, priorityId, typeId, dueDate })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function update(field: string, value: string | null) {
    setValues((prev) => ({ ...prev, [field]: value }))
    setError(null)
    startTransition(async () => {
      try {
        await updateTicketFieldAction(ticketNumber, { [field]: value })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update')
      }
    })
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-xs text-danger">{error}</p>}
      {pending && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Loader2 className="h-3 w-3 animate-spin" /> Saving…
        </p>
      )}

      <Field label="Status">
        <select
          value={values.statusId ?? ''}
          disabled={!canUpdate}
          onChange={(e) => update('statusId', e.target.value)}
          className="h-9 w-full cursor-pointer rounded-lg border border-border-strong bg-white/[0.03] px-2.5 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Assignee">
        <select
          value={values.assigneeId ?? ''}
          disabled={!canAssign}
          onChange={(e) => update('assigneeId', e.target.value || null)}
          className="h-9 w-full cursor-pointer rounded-lg border border-border-strong bg-white/[0.03] px-2.5 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Unassigned</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Priority">
        <select
          value={values.priorityId ?? ''}
          disabled={!canUpdate}
          onChange={(e) => update('priorityId', e.target.value)}
          className="h-9 w-full cursor-pointer rounded-lg border border-border-strong bg-white/[0.03] px-2.5 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {priorities.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Type">
        <select
          value={values.typeId ?? ''}
          disabled={!canUpdate}
          onChange={(e) => update('typeId', e.target.value)}
          className="h-9 w-full cursor-pointer rounded-lg border border-border-strong bg-white/[0.03] px-2.5 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
        >
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Due date">
        <input
          type="date"
          disabled={!canUpdate}
          value={values.dueDate ? values.dueDate.slice(0, 10) : ''}
          onChange={(e) =>
            update('dueDate', e.target.value ? new Date(e.target.value).toISOString() : null)
          }
          className="h-9 w-full rounded-lg border border-border-strong bg-white/[0.03] px-2.5 text-sm text-foreground outline-none disabled:cursor-not-allowed disabled:opacity-60"
        />
        {values.dueDate && (
          <p className="mt-1 text-[11px] text-muted">Due {timeAgo(values.dueDate)}</p>
        )}
      </Field>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted/70">
        {label}
      </p>
      {children}
    </div>
  )
}
