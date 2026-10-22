'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { Bell, CheckCheck, Ticket as TicketIcon, UserPlus } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { useLocale } from '@/i18n/client'
import { localeTag } from '@/i18n/config'
import { usePopoverPosition } from '@/lib/use-popover-position'
import { BottomSheet } from '@/components/ui/BottomSheet'
import {
  getNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/server/actions/notification.actions'
import type { NotificationItem } from '@/server/services/notification.service'
import { useT } from '@/i18n/client'

const POLL_INTERVAL_MS = 30_000
const MENU_MIN_WIDTH = 360

// Phones get a bottom sheet instead of a dropdown: a 360px menu cannot fit beside the bell on a
// 375px screen, and its text and rows are too small to tap.
const PHONE_QUERY = '(max-width: 639px)'
function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}
const isPhoneNow = () => window.matchMedia(PHONE_QUERY).matches

export function NotificationBell() {
  const t = useT()
  const locale = localeTag(useLocale())
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isPhone = useSyncExternalStore(subscribePhone, isPhoneNow, () => false)
  const position = usePopoverPosition(triggerRef, open && !isPhone, 'right')

  const refresh = useCallback(async () => {
    try {
      const data = await getNotificationsAction()
      setItems(data.items)
      setUnreadCount(data.unreadCount)
    } finally {
      setLoaded(true)
    }
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR/hydration guard before the portal can touch document.body, same pattern as ui/Select.tsx
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [refresh])

  useEffect(() => {
    if (open) refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open || isPhone) return // on phones the bottom sheet handles outside taps and Escape
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (
        triggerRef.current &&
        !triggerRef.current.contains(target) &&
        menuRef.current &&
        !menuRef.current.contains(target)
      ) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, isPhone])

  function handleMarkAllRead() {
    setItems((prev) => prev.map((i) => ({ ...i, read: true })))
    setUnreadCount(0)
    startTransition(async () => {
      await markAllNotificationsReadAction()
    })
  }

  function handleItemClick(item: NotificationItem) {
    setOpen(false)
    if (item.read) return
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)))
    setUnreadCount((prev) => Math.max(0, prev - 1))
    startTransition(async () => {
      await markNotificationReadAction(item.id)
    })
  }

  const menuMinWidth = position ? Math.max(position.minWidth, MENU_MIN_WIDTH) : undefined

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={t('Notifications')}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-12 w-16 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-muted-strong transition-colors hover:bg-white/[0.06] hover:text-foreground sm:h-10 sm:w-14"
      >
        <Bell
          className={cn(
            'h-5 w-5',
            loaded && unreadCount > 0 && 'animate-bell-ring text-foreground',
          )}
        />
        {loaded && unreadCount > 0 && (
          <span className="absolute -right-1 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold leading-none text-on-accent shadow-[0_0_6px_1px_rgba(16,185,129,0.8)]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {mounted &&
        open &&
        !isPhone &&
        position &&
        createPortal(
          <div
            ref={menuRef}
            style={{ ...position.style, minWidth: menuMinWidth }}
            className="z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-background-elevated shadow-lg"
          >
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 py-2.5">
              <p className="text-sm font-semibold text-foreground">{t('Notifications')}</p>
              <button
                type="button"
                disabled={isPending || unreadCount === 0}
                onClick={handleMarkAllRead}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-strong transition-colors hover:bg-white/[0.06] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                {t('Mark all as read')}
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-5 py-10 text-center">
                  <Bell className="h-5 w-5 text-muted" />
                  <p className="text-sm text-muted">
                    {loaded ? t("You're all caught up.") : t('Loading…')}
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => handleItemClick(item)}
                      className="group flex items-start gap-2.5 px-3.5 py-2.5 transition-colors hover:bg-white/[0.04]"
                    >
                      <div
                        className={cn(
                          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
                          item.type === 'account'
                            ? 'bg-warning/15 text-warning'
                            : 'bg-white/[0.05] text-muted-strong',
                        )}
                      >
                        {item.type === 'account' ? (
                          <UserPlus className="h-3.5 w-3.5" />
                        ) : (
                          <TicketIcon className="h-3.5 w-3.5" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {item.title}
                        </p>
                        <p className="truncate text-xs text-muted">{item.subtitle}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5 pt-0.5">
                        <span className="text-[11px] text-muted">
                          {timeAgo(item.createdAt, { locale, justNow: t('just now') })}
                        </span>
                        {!item.read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {isPhone && (
        <BottomSheet
          open={open}
          onClose={() => setOpen(false)}
          title={t('Notifications')}
          titleRight={
            <button
              type="button"
              disabled={isPending || unreadCount === 0}
              onClick={handleMarkAllRead}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-xl border-2 border-border-strong px-3 text-sm font-semibold text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="h-4 w-4" />
              {t('Mark all read')}
            </button>
          }
        >
          {items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-5 py-14 text-center">
              <Bell className="h-8 w-8 text-muted" />
              <p className="text-lg text-muted">{loaded ? "You're all caught up." : 'Loading…'}</p>
            </div>
          ) : (
            <ul className="divide-y divide-border pb-[max(1rem,env(safe-area-inset-bottom))]">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    onClick={() => handleItemClick(item)}
                    className={cn(
                      'flex min-h-[72px] items-start gap-3 px-5 py-3.5 active:bg-surface-hover',
                      !item.read && 'bg-accent-soft',
                    )}
                  >
                    <div
                      className={cn(
                        'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                        item.type === 'account'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-surface-hover text-muted-strong',
                      )}
                    >
                      {item.type === 'account' ? (
                        <UserPlus className="h-5 w-5" />
                      ) : (
                        <TicketIcon className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-base font-semibold text-foreground [overflow-wrap:anywhere]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted [overflow-wrap:anywhere]">
                        {item.subtitle}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2 pt-1">
                      <span className="text-sm text-muted">
                        {timeAgo(item.createdAt, { locale, justNow: t('just now') })}
                      </span>
                      {!item.read && (
                        <span
                          className="h-2.5 w-2.5 rounded-full bg-accent"
                          aria-label={t('Unread')}
                        />
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </BottomSheet>
      )}
    </>
  )
}
