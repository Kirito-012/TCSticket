'use client'

import { useState, useTransition } from 'react'
import { Select } from '@/components/ui/Select'
import { updateTicketFieldAction } from '@/server/actions/ticket.actions'
import { friendlyStatusName } from '@/lib/plain-words'

type StatusOption = { id: string; name: string; color: string }

export function StatusSelect({
  ticketNumber,
  statusId,
  statuses,
  disabled,
  large = false,
}: {
  ticketNumber: number
  statusId: string | null
  statuses: StatusOption[]
  disabled: boolean
  /** Big, full-width selector — for the simple Admin/Manager screens. */
  large?: boolean
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
        className={`inline-flex items-center gap-1.5 rounded-full font-medium ${large ? 'px-3 py-1 text-base' : 'px-2 py-0.5 text-xs'}`}
        style={{ backgroundColor: `${current.color}22`, color: current.color }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: current.color }}
          aria-hidden
        />
        {friendlyStatusName(current.name)}
      </span>
    ) : null
  }

  return (
    <div className={large ? 'w-full' : undefined}>
      <Select
        value={value ?? ''}
        onChange={onChange}
        disabled={pending}
        variant={large ? undefined : 'pill'}
        size={large ? 'lg' : 'sm'}
        options={statuses.map((s) => ({
          value: s.id,
          label: friendlyStatusName(s.name),
          color: s.color,
        }))}
      />
    </div>
  )
}
