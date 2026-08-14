'use client'

import { useState, useTransition } from 'react'
import { updateTicketFieldAction } from '@/server/actions/ticket.actions'

type StatusOption = { id: string; name: string; color: string }

export function StatusSelect({
  ticketNumber,
  statusId,
  statuses,
  disabled,
}: {
  ticketNumber: number
  statusId: string | null
  statuses: StatusOption[]
  disabled: boolean
}) {
  const [value, setValue] = useState(statusId)
  const [pending, startTransition] = useTransition()
  const current = statuses.find((s) => s.id === value)

  function onChange(next: string) {
    setValue(next)
    startTransition(async () => {
      try {
        await updateTicketFieldAction(ticketNumber, { statusId: next })
      } catch {
        setValue(statusId)
      }
    })
  }

  if (disabled) {
    return current ? (
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium"
        style={{ backgroundColor: `${current.color}22`, color: current.color }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: current.color }}
          aria-hidden
        />
        {current.name}
      </span>
    ) : null
  }

  return (
    <select
      value={value ?? ''}
      disabled={pending}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 cursor-pointer rounded-full border-0 py-0 pl-2 pr-6 text-xs font-medium outline-none ring-1 ring-inset ring-white/10 disabled:cursor-wait disabled:opacity-60"
      style={{
        backgroundColor: current ? `${current.color}22` : undefined,
        color: current?.color,
      }}
    >
      {statuses.map((s) => (
        <option key={s.id} value={s.id} className="bg-background-elevated text-foreground">
          {s.name}
        </option>
      ))}
    </select>
  )
}
