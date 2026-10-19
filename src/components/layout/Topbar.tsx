'use client'

import Link from 'next/link'
import { Search, Plus, Menu } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/Button'
import { useSidebar } from '@/components/layout/SidebarContext'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher'
import { useT } from '@/i18n/client'
import { cn } from '@/lib/utils'

export function Topbar({
  title,
  description,
  primaryAction,
}: {
  title: string
  description?: string
  primaryAction?: { label: string; icon?: React.ReactNode; href?: string }
}) {
  const { setOpen, simple, light } = useSidebar()
  const t = useT()

  // Surveyors: just the page name, big and plain. No menu button (they have the bottom
  // bar), no search, no bell, no "New ticket".
  if (simple) {
    return (
      <header className="sticky top-0 z-30 flex min-h-16 items-center gap-3 border-b-2 border-border bg-surface px-4 py-3 sm:px-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold leading-tight text-foreground sm:text-2xl">{title}</h1>
          {description && (
            <p className="mt-0.5 text-base text-muted [overflow-wrap:anywhere]">{description}</p>
          )}
        </div>
        {/* The light (Surveyor) look keeps just the title. Admins and Managers also get the
            notification bell and one big action button. */}
        {/* Phones have no side column, so the language picker lives in the header there. */}
        <LanguageSwitcher className="lg:hidden" />
        {!light && <ThemeToggle />}
        {!light && <NotificationBell />}
        {!light && primaryAction?.href && (
          <Link
            href={primaryAction.href}
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-base font-bold text-on-accent sm:px-5"
          >
            <Plus className="h-5 w-5" strokeWidth={2.5} />
            <span className="max-sm:sr-only">{primaryAction.label}</span>
          </Link>
        )}
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:gap-4 sm:px-8">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t('Open menu')}
        className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-border text-muted-strong transition-colors hover:bg-white/[0.06] hover:text-foreground lg:hidden"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold text-foreground">{title}</h1>
        {description && <p className="truncate text-xs text-muted">{description}</p>}
      </div>

      <label className="relative hidden w-72 shrink-0 sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="search"
          placeholder={t('Search tickets, people…')}
          className="h-9 w-full rounded-lg border border-border bg-white/[0.03] pl-9 pr-3 text-sm text-foreground placeholder:text-muted/70 outline-none transition-colors focus:border-accent/40 focus:bg-white/[0.05]"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-medium text-muted">
          ⌘K
        </kbd>
      </label>

      <LanguageSwitcher className="max-sm:hidden" />
      <NotificationBell />

      {primaryAction &&
        (primaryAction.href ? (
          <Link
            href={primaryAction.href}
            aria-label={primaryAction.label}
            className={cn(buttonVariants({ size: 'md' }), 'shrink-0 max-sm:w-9 max-sm:px-0')}
          >
            {primaryAction.icon ?? <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">{primaryAction.label}</span>
          </Link>
        ) : (
          <Button size="md" className="shrink-0">
            {primaryAction.icon ?? <Plus className="h-4 w-4" />}
            {primaryAction.label}
          </Button>
        ))}
    </header>
  )
}
