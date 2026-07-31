'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table'
import { MessageSquare } from 'lucide-react'
import { DynamicBadge, Tag } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { cn, timeAgo } from '@/lib/utils'
import type { TicketListItemView } from '@/lib/ticket-view'

const UNASSIGNED = { name: 'Unassigned', initials: '—', color: '#3f3f46' }

export function TicketsTable({ tickets }: { tickets: TicketListItemView[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const allSelected = tickets.length > 0 && selected.size === tickets.length

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(tickets.map((t) => t.id)))
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const columns = useMemo<ColumnDef<TicketListItemView>[]>(
    () => [
      { id: 'select', header: '', size: 40 },
      { id: 'number', header: 'ID', size: 64 },
      { id: 'subject', header: 'Subject' },
      { id: 'requester', header: 'Requester', size: 160 },
      { id: 'priority', header: 'Priority', size: 112 },
      { id: 'status', header: 'Status', size: 96 },
      { id: 'assignee', header: 'Assignee', size: 112 },
      { id: 'updatedAt', header: 'Updated', size: 80 },
    ],
    [],
  )

  const table = useReactTable({
    data: tickets,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
  })

  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
        <p className="text-sm font-medium text-foreground">No tickets match these filters</p>
        <p className="text-xs text-muted">Try clearing filters or search a different term.</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs text-muted">
            <th className="w-10 px-4 py-3">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select all tickets"
                className="h-4 w-4 cursor-pointer rounded border-border-strong bg-transparent accent-emerald-500"
              />
            </th>
            {table
              .getHeaderGroups()[0]
              .headers.slice(1)
              .map((header) => (
                <th
                  key={header.id}
                  className={cn('px-2 py-3 font-medium', header.id === 'updatedAt' && 'text-right')}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tickets.map((t) => {
            const isSelected = selected.has(t.id)
            return (
              <tr
                key={t.id}
                className={cn(
                  'group transition-colors',
                  isSelected ? 'bg-accent-soft/40' : 'hover:bg-white/[0.025]',
                )}
              >
                <td className="px-4 py-3.5">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(t.id)}
                    aria-label={`Select ticket #${t.number}`}
                    className="h-4 w-4 cursor-pointer rounded border-border-strong bg-transparent accent-emerald-500"
                  />
                </td>
                <td className="px-2 py-3.5 font-mono text-xs text-muted">#{t.number}</td>
                <td className="px-2 py-3.5">
                  <Link href={`/tickets/${t.number}`} className="block max-w-md">
                    <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:text-accent-strong">
                      {t.subject}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted">{t.preview}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      {t.tags.map((tag) => (
                        <Tag key={tag.id}>{tag.name}</Tag>
                      ))}
                      {t.comments > 0 && (
                        <span className="ml-1 flex items-center gap-1 text-[11px] text-muted">
                          <MessageSquare className="h-3 w-3" /> {t.comments}
                        </span>
                      )}
                    </div>
                  </Link>
                </td>
                <td className="px-2 py-3.5">
                  <div className="flex items-center gap-2">
                    <Avatar
                      person={
                        t.owner
                          ? { name: t.owner.name, initials: t.owner.initials, color: '#9ca3af' }
                          : UNASSIGNED
                      }
                      size="sm"
                    />
                    <span className="truncate text-xs text-muted-strong">
                      {t.owner?.name ?? 'Unknown'}
                    </span>
                  </div>
                </td>
                <td className="px-2 py-3.5">
                  {t.priority && <DynamicBadge label={t.priority.name} color={t.priority.color} />}
                </td>
                <td className="px-2 py-3.5">
                  {t.status && (
                    <DynamicBadge label={t.status.name} color={t.status.color} dot={false} />
                  )}
                </td>
                <td className="px-2 py-3.5">
                  <Avatar
                    person={
                      t.assignee
                        ? { name: t.assignee.name, initials: t.assignee.initials, color: '#10b981' }
                        : UNASSIGNED
                    }
                    size="sm"
                  />
                </td>
                <td className="px-2 py-3.5 text-right text-xs text-muted">
                  {timeAgo(t.updatedAt)}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
