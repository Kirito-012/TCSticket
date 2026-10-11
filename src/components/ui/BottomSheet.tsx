'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

/** How long the slide takes, and the feel of it: quick start, soft landing (iOS-style). */
const SLIDE_MS = 320
const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)'
/** Dragging down past this share of the sheet's height — or flicking down fast — closes it. */
const DISMISS_FRACTION = 0.25
const DISMISS_VELOCITY = 0.5 // px per ms

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * A native-feeling bottom sheet for phones.
 *
 * - Slides up with the backdrop fading in; slides away when closed (reduced-motion: no animation).
 * - Drag it down by the grab handle / title — or by the content while it is scrolled to the top.
 *   It follows the finger; past a quarter of the way, or on a quick flick down, it closes; let go
 *   sooner and it springs back.
 * - Also closes with the X button, Escape, or a tap on the dark backdrop. All of these call
 *   `onClose`; the parent owns `open`, so it can also close the sheet itself (e.g. after applying).
 * - Locks page scroll while open, and is rendered into <body> so no ancestor can clip it.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  footer,
  titleRight,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** Pinned under the scrolling content (e.g. the Apply button). */
  footer?: React.ReactNode
  /** Extra controls on the title row, left of the close button. */
  titleRight?: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false) // in the page at all (stays while sliding out)
  const [shown, setShown] = useState(false) // slid in
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [panelHeight, setPanelHeight] = useState(600) // measured when a drag starts

  const panelRef = useRef<HTMLDivElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const drag = useRef({ startY: 0, lastY: 0, lastT: 0, velocity: 0, active: false })

  // Follow `open`: mount, then slide in on the next frames; or slide out, then unmount.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- mount first so the slide-in can start from off-screen
      setMounted(true)
      setDragY(0)
      // A short timer (not requestAnimationFrame, which browsers pause in hidden windows): long
      // enough for the off-screen sheet to be painted once, so the slide-in has somewhere to start.
      const timer = setTimeout(() => {
        void panelRef.current?.offsetHeight // flush styles so the transition runs from off-screen
        setShown(true)
      }, 24)
      return () => clearTimeout(timer)
    }
    setDragging(false)
    setShown(false)
    const timer = setTimeout(
      () => {
        setMounted(false)
        setDragY(0)
      },
      prefersReducedMotion() ? 0 : SLIDE_MS,
    )
    return () => clearTimeout(timer)
  }, [open])

  // Page scroll lock, Escape, and focus while the sheet is in the page.
  useEffect(() => {
    if (!mounted) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [mounted, onClose])

  /* ───────────── drag down to close ───────────── */

  function dragStart(y: number) {
    setPanelHeight(panelRef.current?.getBoundingClientRect().height ?? 600)
    drag.current = { startY: y, lastY: y, lastT: performance.now(), velocity: 0, active: true }
  }

  function dragMove(y: number) {
    const d = drag.current
    if (!d.active) return
    const dy = Math.max(0, y - d.startY) // only downwards; upwards does nothing
    const now = performance.now()
    if (now > d.lastT) d.velocity = (y - d.lastY) / (now - d.lastT)
    d.lastY = y
    d.lastT = now
    if (dy > 0) {
      setDragging(true)
      setDragY(dy)
    }
  }

  function dragEnd() {
    const d = drag.current
    if (!d.active) return
    d.active = false
    const farEnough = dragY > panelHeight * DISMISS_FRACTION
    const flicked = d.velocity > DISMISS_VELOCITY && dragY > 24
    setDragging(false)
    if (farEnough || flicked) onClose()
    else setDragY(0) // springs back (the transition is on again now)
  }

  // Grab handle + title: drag from here at any time.
  const handleDrag = {
    onPointerDown: (e: React.PointerEvent) => {
      try {
        e.currentTarget.setPointerCapture(e.pointerId)
      } catch {
        /* capture is a nicety; dragging still works without it */
      }
      dragStart(e.clientY)
    },
    onPointerMove: (e: React.PointerEvent) => dragMove(e.clientY),
    onPointerUp: () => dragEnd(),
    onPointerCancel: () => dragEnd(),
  }

  // Content: dragging down only takes over when the content is already scrolled to the top.
  const bodyDrag = {
    onTouchStart: (e: React.TouchEvent) => {
      if ((bodyRef.current?.scrollTop ?? 0) <= 0) dragStart(e.touches[0].clientY)
    },
    onTouchMove: (e: React.TouchEvent) => {
      const d = drag.current
      if (!d.active) return
      if ((bodyRef.current?.scrollTop ?? 0) > 0 && !dragging) {
        d.active = false // the user is scrolling the content, not dragging the sheet
        return
      }
      dragMove(e.touches[0].clientY)
    },
    onTouchEnd: () => dragEnd(),
    onTouchCancel: () => dragEnd(),
  }

  if (!mounted) return null

  const transition = dragging
    ? 'none'
    : `transform ${SLIDE_MS}ms ${EASE}, opacity ${SLIDE_MS}ms ease`
  const backdropOpacity = shown ? Math.max(0.2, 1 - (dragY / panelHeight) * 0.8) : 0

  return createPortal(
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-black/60"
        style={{
          opacity: backdropOpacity,
          transition: dragging ? 'none' : `opacity ${SLIDE_MS}ms ease`,
        }}
        onClick={onClose}
      />

      <div
        ref={panelRef}
        className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-3xl border-t-2 border-border-strong bg-background shadow-2xl will-change-transform motion-reduce:!transition-none"
        style={{
          transform: shown ? `translateY(${dragY}px)` : 'translateY(100%)',
          transition,
        }}
      >
        {/* grab handle + title — drag from here */}
        <div className="shrink-0 touch-none select-none px-5 pb-2 pt-3" {...handleDrag}>
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-border-strong" aria-hidden />
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-foreground">{title}</h2>
            <div className="flex items-center gap-2" onPointerDown={(e) => e.stopPropagation()}>
              {titleRight}
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label={`Close ${title.toLowerCase()}`}
                className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-surface-hover text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {/* scrolling body */}
        <div
          ref={bodyRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain"
          {...bodyDrag}
        >
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t-2 border-border bg-background px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
