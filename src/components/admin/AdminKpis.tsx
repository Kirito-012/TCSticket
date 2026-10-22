import Link from 'next/link'
import { AlertTriangle, ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { getDashboardKpis } from '@/server/services/ticket.service'
import { getLocale, getT } from '@/i18n/server'
import { localeTag } from '@/i18n/config'

type Kpis = Awaited<ReturnType<typeof getDashboardKpis>>

type T = (text: string, params?: Record<string, string | number>) => string

type Tone = 'good' | 'bad' | 'neutral'

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-accent-strong',
  bad: 'text-danger',
  neutral: 'text-muted-strong',
}

const DAY_MS = 86_400_000

const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** "4 more than last week", "986 fewer than last week", "Same as last week". */
function weekCompare(now: number, before: number, higherIsGood: boolean | null, t: T) {
  const diff = now - before
  if (diff === 0) return { text: t('Same as last week'), Icon: Minus, tone: 'neutral' as Tone }
  const up = diff > 0
  const tone: Tone = higherIsGood === null ? 'neutral' : up === higherIsGood ? 'good' : 'bad'
  return {
    text: up
      ? t('{count} more than last week', { count: Math.abs(diff).toLocaleString() })
      : t('{count} fewer than last week', { count: Math.abs(diff).toLocaleString() }),
    Icon: up ? ArrowUpRight : ArrowDownRight,
    tone,
  }
}

/** 0.4 → "24 minutes", 20.2 → "20 hours", 75 → "3.1 days". */
function formatDuration(hours: number, t: T) {
  if (hours < 1) return t('{n} minutes', { n: Math.max(1, Math.round(hours * 60)) })
  if (hours < 48) return t('{n} hours', { n: Math.round(hours) })
  return t('{n} days', { n: (hours / 24).toFixed(1) })
}

/* ───────────────────────────── building blocks ───────────────────────────── */

const CARD = 'rounded-2xl border-2 border-border bg-surface p-4 sm:p-5'
const FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background'

/** A KPI card. With `href` the whole card is one big link; without, it holds its own links. */
function Card({
  label,
  href,
  children,
}: {
  label: string
  href?: string
  children: React.ReactNode
}) {
  const head = (
    <div className="flex items-center justify-between gap-2">
      <p className="text-base font-semibold text-muted-strong">{label}</p>
      {href && (
        <ArrowRight
          className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent-strong"
          strokeWidth={2.25}
        />
      )}
    </div>
  )
  if (href) {
    return (
      <Link
        href={href}
        className={cn(CARD, FOCUS, 'group block transition-colors hover:border-accent')}
      >
        {head}
        {children}
      </Link>
    )
  }
  return (
    <div className={CARD}>
      {head}
      {children}
    </div>
  )
}

/** "See them" link at the foot of a card that holds several links of its own. */
function SeeAll({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        FOCUS,
        'mt-3 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-accent-strong hover:underline',
      )}
    >
      {children}
      <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
    </Link>
  )
}

function Trend({
  now,
  before,
  higherIsGood,
  t,
}: {
  now: number
  before: number
  higherIsGood: boolean | null
  t: T
}) {
  const { text, Icon, tone } = weekCompare(now, before, higherIsGood, t)
  return (
    <p className={cn('flex items-center gap-1.5 text-sm font-semibold', TONE_TEXT[tone])}>
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2.5} />
      {text}
    </p>
  )
}

/**
 * 14 columns, oldest to newest — each one a link to that day's tickets. The last 7 (this week)
 * are full strength and the 7 before them (last week) are lighter, so the weeks compare at a
 * glance. One hue, no axes: the hero number carries the value, and hovering a column names it.
 */
function WeekBars({
  values,
  color,
  noun,
  hrefFor,
  t,
  locale,
}: {
  values: number[]
  color: string
  noun: string
  t: T
  locale: string
  /** The Tickets page showing that day's tickets. */
  hrefFor: (isoDate: string) => string
}) {
  const max = Math.max(...values, 1)
  const today = new Date()
  const dayFormat = new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div>
      <div
        className="flex h-14 items-end gap-[3px]"
        role="group"
        aria-label={t(
          '{noun} per day over the last 14 days. Each column opens the tickets of that day.',
          { noun },
        )}
      >
        {values.map((v, i) => {
          const date = new Date(today.getTime() - (values.length - 1 - i) * DAY_MS)
          const thisWeek = i >= values.length - 7
          const height = v === 0 ? 3 : Math.max(8, (v / max) * 100)
          const text = `${dayFormat.format(date)}: ${v.toLocaleString()} ${noun}`
          return (
            <Link
              key={i}
              href={hrefFor(isoDay(date))}
              title={text}
              aria-label={text}
              className={cn(FOCUS, 'group/bar flex h-full flex-1 items-end rounded-t-md')}
            >
              <span
                className="block w-full rounded-t-[4px] transition-opacity group-hover/bar:!opacity-100"
                style={{
                  height: `${height}%`,
                  background: color,
                  opacity: v === 0 ? 0.3 : thisWeek ? 1 : 0.7,
                }}
              />
            </Link>
          )
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
        <span>{t('14 days ago')}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm opacity-70" style={{ background: color }} />
            {t('Last week')}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />
            {t('This week')}
          </span>
        </span>
      </div>
    </div>
  )
}

/** A progress ring with the percentage in the middle. */
function Ring({ percent, label }: { percent: number; label: string }) {
  const R = 46
  const C = 2 * Math.PI * R
  const clamped = Math.max(0, Math.min(100, percent))
  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0" role="img" aria-label={label}>
      <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-hover)" strokeWidth="12" />
      <circle
        cx="60"
        cy="60"
        r={R}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={`${(clamped / 100) * C} ${C}`}
        transform="rotate(-90 60 60)"
      />
      <text
        x="60"
        y="60"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize="26"
        fontWeight="700"
        fill="var(--foreground)"
      >
        {percent}%
      </text>
    </svg>
  )
}

/** A horizontal meter: how much of the whole is this part. */
function Meter({ part, whole, color }: { part: number; whole: number; color: string }) {
  const pct = whole === 0 ? 0 : Math.max(part > 0 ? 2 : 0, (part / whole) * 100)
  return (
    <div
      className="h-4 overflow-hidden rounded-full bg-surface-hover"
      role="img"
      aria-label={`${part.toLocaleString()} of ${whole.toLocaleString()}`}
    >
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

const AGE_GROUPS = [
  { key: 'today', label: 'Under a day', opacity: 0.68, pick: (a: Kpis['ages']) => a.today },
  { key: 'd1to3', label: '1 to 3 days', opacity: 0.8, pick: (a: Kpis['ages']) => a.oneToThree },
  { key: 'd3to7', label: '3 to 7 days', opacity: 0.92, pick: (a: Kpis['ages']) => a.threeToSeven },
  { key: 'over7', label: 'Over a week', opacity: 1, pick: (a: Kpis['ages']) => a.older },
] as const

/**
 * Open tickets split by how long they have waited — one hue, darker means older. Every segment
 * and every legend row opens the Tickets page filtered to that age.
 */
function AgeBar({ ages, t }: { ages: Kpis['ages']; t: T }) {
  const groups = AGE_GROUPS.map((g) => ({ ...g, value: g.pick(ages) }))
  const total = groups.reduce((n, g) => n + g.value, 0)

  return (
    <div>
      <div
        className="flex h-8 gap-0.5 overflow-hidden rounded-full bg-surface-hover"
        role="group"
        aria-label={t('Open tickets by how long they have waited. Each part opens those tickets.')}
      >
        {total > 0 &&
          groups
            .filter((g) => g.value > 0)
            .map((g) => (
              <Link
                key={g.key}
                href={`/tickets?age=${g.key}`}
                title={t('{label}: {count} tickets', {
                  label: t(g.label),
                  count: g.value.toLocaleString(),
                })}
                aria-label={t('{label}: {count} tickets', {
                  label: t(g.label),
                  count: g.value.toLocaleString(),
                })}
                className={cn(FOCUS, 'transition-[filter] hover:brightness-110')}
                style={{
                  flexGrow: g.value,
                  flexBasis: 0,
                  background: 'var(--warning)',
                  opacity: g.opacity,
                }}
              />
            ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
        {groups.map((g) => (
          <li key={g.key}>
            <Link
              href={`/tickets?age=${g.key}`}
              className={cn(
                FOCUS,
                'flex items-center gap-2 rounded-md px-1 py-1 text-sm hover:bg-surface-hover',
              )}
            >
              <span
                className="h-3 w-3 shrink-0 rounded-sm"
                style={{ background: 'var(--warning)', opacity: g.opacity }}
              />
              <span className="flex-1 text-muted-strong">{t(g.label)}</span>
              <span className="font-semibold text-foreground">{g.value.toLocaleString()}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ─────────────────────────────── the board ──────────────────────────────── */

/**
 * The dashboard's KPIs as graphics, and every graphic is a way in: tap a day's column to see that
 * day's tickets, tap a ring or the urgent meter to see the tickets behind it, tap an age segment
 * to see the tickets that have waited that long. The numbers stay as plain text beside each one.
 */
export async function AdminKpis({ kpis }: { kpis: Kpis }) {
  const t = await getT()
  const locale = localeTag(await getLocale())
  const handedOut =
    kpis.openTotal === 0 ? 100 : Math.round((kpis.openAssigned / kpis.openTotal) * 100)
  const finishedPct = kpis.allTotal === 0 ? 0 : Math.round((kpis.doneTotal / kpis.allTotal) * 100)
  const urgentShare =
    kpis.openTotal === 0 ? 0 : Math.round((kpis.urgentOpen / kpis.openTotal) * 100)

  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-foreground">{t('How we are doing')}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Card label={t('Finished this week')}>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-4xl font-bold leading-tight text-foreground">
              {kpis.finishedThisWeek.toLocaleString()}
            </p>
            <Trend now={kpis.finishedThisWeek} before={kpis.finishedLastWeek} higherIsGood t={t} />
          </div>
          <div className="mt-3">
            <WeekBars
              values={kpis.dailyFinished}
              color="var(--accent)"
              noun={t('finished')}
              hrefFor={(day) => `/tickets?show=done&day=finished:${day}`}
              t={t}
              locale={locale}
            />
          </div>
          {kpis.avgFinishHours !== null && (
            <p className="mt-3 text-sm text-muted">
              {t('A ticket takes about {time} to finish', {
                time: formatDuration(kpis.avgFinishHours, t),
              })}
            </p>
          )}
          <SeeAll href="/tickets?show=done">{t('See finished tickets')}</SeeAll>
        </Card>

        <Card label={t('New this week')}>
          <div className="mt-1 flex items-baseline justify-between gap-3">
            <p className="text-4xl font-bold leading-tight text-foreground">
              {kpis.newThisWeek.toLocaleString()}
            </p>
            <Trend now={kpis.newThisWeek} before={kpis.newLastWeek} higherIsGood={null} t={t} />
          </div>
          <div className="mt-3">
            <WeekBars
              values={kpis.dailyNew}
              color="var(--info)"
              noun={t('new tickets')}
              hrefFor={(day) => `/tickets?show=all&day=created:${day}`}
              t={t}
              locale={locale}
            />
          </div>
          <SeeAll href="/tickets?show=all&sort=newest">{t('See the newest tickets')}</SeeAll>
        </Card>

        <Card label={t('Handed out')} href="/tickets?show=unassigned">
          <div className="mt-2 flex items-center gap-4">
            <Ring
              percent={handedOut}
              label={t('{done} of {total} open tickets have someone', {
                done: kpis.openAssigned.toLocaleString(),
                total: kpis.openTotal.toLocaleString(),
              })}
            />
            <div>
              <p className="text-base text-muted-strong">
                {t('{done} of {total} open tickets have someone working on them', {
                  done: kpis.openAssigned.toLocaleString(),
                  total: kpis.openTotal.toLocaleString(),
                })}
              </p>
              <p className="mt-2 text-sm font-semibold text-accent-strong">
                {t('See the ones that need someone')}
              </p>
            </div>
          </div>
        </Card>

        <Card label={t('Finished overall')} href="/tickets?show=done">
          <div className="mt-2 flex items-center gap-4">
            <Ring
              percent={finishedPct}
              label={t('{done} of {total} tickets are finished', {
                done: kpis.doneTotal.toLocaleString(),
                total: kpis.allTotal.toLocaleString(),
              })}
            />
            <div>
              <p className="text-base text-muted-strong">
                {t('{done} of {total} tickets are finished', {
                  done: kpis.doneTotal.toLocaleString(),
                  total: kpis.allTotal.toLocaleString(),
                })}
              </p>
              <p className="mt-2 text-sm font-semibold text-accent-strong">
                {t('See the finished tickets')}
              </p>
            </div>
          </div>
        </Card>

        <Card label={t('Urgent and still open')} href="/tickets?urgent=1">
          <p className="mt-1 text-4xl font-bold leading-tight text-foreground">
            {kpis.urgentOpen.toLocaleString()}
          </p>
          <div className="mt-3">
            <Meter part={kpis.urgentOpen} whole={kpis.openTotal} color="var(--danger)" />
          </div>
          <p
            className={cn(
              'mt-2 flex items-center gap-1.5 text-sm',
              kpis.urgentOpen > 0 ? 'font-semibold text-danger' : 'text-muted',
            )}
          >
            {kpis.urgentOpen > 0 && (
              <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={2.5} />
            )}
            {t('{percent}% of open tickets are critical or high priority', {
              percent: urgentShare,
            })}
          </p>
        </Card>

        <Card label={t('How long open tickets have waited')}>
          <p className="mt-1 text-4xl font-bold leading-tight text-foreground">
            {kpis.waitingLong.toLocaleString()}
            <span className="ml-2 text-base font-semibold text-muted">
              {t('over {n} days', { n: kpis.waitingDays })}
            </span>
          </p>
          <div className="mt-3">
            <AgeBar ages={kpis.ages} t={t} />
          </div>
        </Card>
      </div>
    </section>
  )
}
