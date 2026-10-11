import Link from 'next/link'
import { CheckCircle2, ClipboardList, Layers, PartyPopper, UserX } from 'lucide-react'
import { AdminTaskCard } from '@/components/admin/AdminTaskCard'
import { AdminKpis } from '@/components/admin/AdminKpis'
import type { TicketListItemView } from '@/lib/ticket-view'

type UserOption = { id: string; name: string }

type Kpis = Parameters<typeof AdminKpis>[0]['kpis']

type Counts = { todo: number; done: number; unassigned: number; all: number; doneToday: number }

function Tile({
  href,
  label,
  value,
  icon,
  tone,
}: {
  href: string
  label: string
  value: number
  icon: React.ReactNode
  tone: string
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-4 rounded-2xl border-2 p-4 sm:flex-col sm:gap-1 sm:p-5 sm:text-center ${tone}`}
    >
      {icon}
      <div className="sm:mt-1">
        <p className="text-4xl font-bold leading-none text-foreground sm:text-5xl">
          {value.toLocaleString()}
        </p>
        <p className="mt-1 text-lg font-semibold text-foreground">{label}</p>
      </div>
    </Link>
  )
}

/**
 * Admin/Manager dashboard, top part: four big numbers, then the tickets nobody has been given yet,
 * each with a button to give it to someone. The map and charts sit right below (AdminOverview).
 */
export function AdminHome({
  counts,
  kpis,
  needsAssigning,
  users,
  canAssign,
}: {
  counts: Counts
  kpis: Kpis
  needsAssigning: TicketListItemView[]
  users: UserOption[]
  canAssign: boolean
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          href="/tickets?show=unassigned"
          label="Need someone"
          value={counts.unassigned}
          icon={<UserX className="h-9 w-9 shrink-0 text-warning" strokeWidth={2.25} />}
          tone="border-warning bg-warning-soft"
        />
        <Tile
          href="/tickets"
          label="To do"
          value={counts.todo}
          icon={<ClipboardList className="h-9 w-9 shrink-0 text-info" strokeWidth={2.25} />}
          tone="border-info bg-info-soft"
        />
        <Tile
          href="/tickets?show=done"
          label="Done today"
          value={counts.doneToday}
          icon={<CheckCircle2 className="h-9 w-9 shrink-0 text-accent-strong" strokeWidth={2.25} />}
          tone="border-accent bg-accent-soft"
        />
        <Tile
          href="/tickets?show=all"
          label="All tickets"
          value={counts.all}
          icon={<Layers className="h-9 w-9 shrink-0 text-violet" strokeWidth={2.25} />}
          tone="border-violet bg-violet-soft"
        />
      </div>

      <AdminKpis kpis={kpis} />

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-foreground">Tickets that need someone</h2>
        {needsAssigning.length === 0 ? (
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-8 text-center">
            <PartyPopper className="mx-auto h-12 w-12 text-accent-strong" strokeWidth={2} />
            <p className="mt-3 text-2xl font-bold text-foreground">Everything is handed out</p>
            <p className="mt-1 text-lg text-muted">Every open ticket has someone working on it.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {needsAssigning.map((task) => (
                <AdminTaskCard key={task.id} task={task} users={users} canAssign={canAssign} />
              ))}
            </div>
            {counts.unassigned > needsAssigning.length && (
              <Link
                href="/tickets?show=unassigned"
                className="flex min-h-14 items-center justify-center rounded-2xl bg-accent px-6 text-lg font-bold text-on-accent md:max-w-sm"
              >
                See all {counts.unassigned} that need someone
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  )
}
