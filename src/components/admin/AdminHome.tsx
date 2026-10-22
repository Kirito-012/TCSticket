import Link from 'next/link'
import {
  CheckCircle2,
  ClipboardList,
  Layers,
  PartyPopper,
  RotateCcw,
  ShieldCheck,
  ShieldQuestion,
  UserX,
} from 'lucide-react'
import { AdminTaskCard } from '@/components/admin/AdminTaskCard'
import { AdminKpis } from '@/components/admin/AdminKpis'
import type { TicketListItemView } from '@/lib/ticket-view'
import { getT } from '@/i18n/server'

type UserOption = { id: string; name: string }

type Kpis = Parameters<typeof AdminKpis>[0]['kpis']

type Counts = {
  todo: number
  done: number
  unassigned: number
  all: number
  doneToday: number
  reopened: number
  verified: number
  unverified: number
}

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
      className={`flex min-w-0 flex-col items-center gap-1 rounded-2xl border-2 p-3 text-center sm:p-5 ${tone}`}
    >
      {icon}
      <div className="mt-1 min-w-0">
        <p className="text-3xl font-bold leading-none text-foreground sm:text-5xl">
          {value.toLocaleString()}
        </p>
        <p className="mt-1 text-base font-semibold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-lg">
          {label}
        </p>
      </div>
    </Link>
  )
}

/**
 * Admin/Manager dashboard, top part: four big numbers, then the tickets nobody has been given yet,
 * each with a button to give it to someone. The map and charts sit right below (AdminOverview).
 */
export async function AdminHome({
  counts,
  kpis,
  needsAssigning,
  users,
  canAssign,
  extra,
}: {
  counts: Counts
  kpis: Kpis
  needsAssigning: TicketListItemView[]
  users: UserOption[]
  canAssign: boolean
  /** Shown between the numbers and the "needs someone" list (zone cards, sector cards, a team). */
  extra?: React.ReactNode
}) {
  const t = await getT()
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile
          href="/tickets?show=unassigned"
          label={t('Need someone')}
          value={counts.unassigned}
          icon={<UserX className="h-9 w-9 shrink-0 text-warning" strokeWidth={2.25} />}
          tone="border-warning bg-warning-soft"
        />
        <Tile
          href="/tickets"
          label={t('To do')}
          value={counts.todo}
          icon={<ClipboardList className="h-9 w-9 shrink-0 text-info" strokeWidth={2.25} />}
          tone="border-info bg-info-soft"
        />
        <Tile
          href="/tickets?show=done"
          label={t('Done today')}
          value={counts.doneToday}
          icon={<CheckCircle2 className="h-9 w-9 shrink-0 text-accent-strong" strokeWidth={2.25} />}
          tone="border-accent bg-accent-soft"
        />
        <Tile
          href="/tickets?show=all"
          label={t('All tickets')}
          value={counts.all}
          icon={<Layers className="h-9 w-9 shrink-0 text-violet" strokeWidth={2.25} />}
          tone="border-violet bg-violet-soft"
        />
      </div>

      <section aria-label={t('Drone re-check')} className="space-y-2">
        <h2 className="text-lg font-bold text-foreground">{t('Drone re-check')}</h2>
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <Tile
            href="/tickets?status=reopened"
            label={t('Reopened')}
            value={counts.reopened}
            icon={<RotateCcw className="h-9 w-9 shrink-0 text-danger" strokeWidth={2.25} />}
            tone="border-danger bg-danger-soft"
          />
          <Tile
            href="/tickets?show=done&verify=unverified"
            label={t('Not verified')}
            value={counts.unverified}
            icon={<ShieldQuestion className="h-9 w-9 shrink-0 text-warning" strokeWidth={2.25} />}
            tone="border-warning bg-warning-soft"
          />
          <Tile
            href="/tickets?show=done&verify=verified"
            label={t('Verified')}
            value={counts.verified}
            icon={
              <ShieldCheck className="h-9 w-9 shrink-0 text-accent-strong" strokeWidth={2.25} />
            }
            tone="border-accent bg-accent-soft"
          />
        </div>
      </section>

      <AdminKpis kpis={kpis} />

      {extra}

      <section className="space-y-3">
        <h2 className="text-xl font-bold text-foreground">{t('Tickets that need someone')}</h2>
        {needsAssigning.length === 0 ? (
          <div className="rounded-2xl border-2 border-border-strong bg-surface p-8 text-center">
            <PartyPopper className="mx-auto h-12 w-12 text-accent-strong" strokeWidth={2} />
            <p className="mt-3 text-2xl font-bold text-foreground">
              {t('Everything is handed out')}
            </p>
            <p className="mt-1 text-lg text-muted">
              {t('Every open ticket has someone working on it.')}
            </p>
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
                {t('See all {count} that need someone', { count: counts.unassigned })}
              </Link>
            )}
          </>
        )}
      </section>
    </div>
  )
}
