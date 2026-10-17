'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, ClipboardList, Users, LogOut, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { logout } from '@/server/actions/auth.actions'

const ICONS: Record<NavIcon, LucideIcon> = { home: Home, tasks: ClipboardList, people: Users }

export type NavIcon = 'home' | 'tasks' | 'people'
export type NavLink = { label: string; href: string; icon: NavIcon; badge?: number }

/**
 * The simple navigation: a few big, labelled buttons plus Log out. A bar at the bottom of the
 * screen on phones (thumb reach, no hidden menu), and a plain left column on larger screens.
 * Surveyors get Home + My tasks; Admins and Managers get Home + Tasks (+ People).
 */
export function SimpleNav({ name, links }: { name: string; links: NavLink[] }) {
  const pathname = usePathname()
  const LINKS = links

  return (
    <>
      {/* Phones: bottom bar */}
      <nav
        aria-label="Main"
        style={{ gridTemplateColumns: `repeat(${LINKS.length + 1}, minmax(0, 1fr))` }}
        className="fixed inset-x-0 bottom-0 z-40 grid border-t-2 border-border-strong bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {LINKS.map((link) => {
          const active = pathname?.startsWith(link.href)
          const Icon = ICONS[link.icon]
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                'relative flex min-h-[68px] flex-col items-center justify-center gap-1 text-base font-semibold',
                active ? 'bg-accent-soft text-accent-strong' : 'text-muted-strong',
              )}
            >
              <Icon className="h-6 w-6" strokeWidth={2.25} />
              {link.label}
              {link.badge ? (
                <span className="absolute right-[22%] top-2 rounded-full bg-danger px-1.5 text-xs font-bold text-white">
                  {link.badge}
                </span>
              ) : null}
            </Link>
          )
        })}
        <form action={logout} className="contents">
          <button
            type="submit"
            className="flex min-h-[68px] cursor-pointer flex-col items-center justify-center gap-1 text-base font-semibold text-muted-strong"
          >
            <LogOut className="h-6 w-6" strokeWidth={2.25} />
            Log out
          </button>
        </form>
      </nav>

      {/* Larger screens: left column */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r-2 border-border bg-surface lg:flex">
        <div className="px-6 py-6">
          <p className="text-xl font-bold text-foreground">TheCraftSync</p>
          <p className="mt-1 text-base text-muted">Hello, {name}</p>
        </div>
        <nav aria-label="Main" className="flex-1 space-y-2 px-4">
          {LINKS.map((link) => {
            const active = pathname?.startsWith(link.href)
            const Icon = ICONS[link.icon]
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3.5 text-lg font-semibold',
                  active
                    ? 'bg-accent-soft text-accent-strong'
                    : 'text-muted-strong hover:bg-surface-hover',
                )}
              >
                <Icon className="h-6 w-6" strokeWidth={2.25} />
                <span className="flex-1">{link.label}</span>
                {link.badge ? (
                  <span className="rounded-full bg-danger px-2 py-0.5 text-sm font-bold text-white">
                    {link.badge}
                  </span>
                ) : null}
              </Link>
            )
          })}
        </nav>
        <form action={logout} className="p-4">
          <button
            type="submit"
            className="flex w-full cursor-pointer items-center gap-3 rounded-xl border-2 border-border-strong px-4 py-3.5 text-lg font-semibold text-muted-strong hover:bg-surface-hover"
          >
            <LogOut className="h-6 w-6" strokeWidth={2.25} />
            Log out
          </button>
        </form>
      </aside>
    </>
  )
}
