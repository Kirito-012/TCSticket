'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, ExternalLink, FileText, Loader2, Minus, Plus, X } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { UploadStamp } from '@/components/tickets/UploadStamp'
import { cn } from '@/lib/utils'
import { useT } from '@/i18n/client'

type Props = {
  /** The ticket number — the report is fetched from /api/tickets/:number/report. */
  number: number
  name: string
  bytes: number
  uploadedAt: string | null
  /** Label above the buttons. */
  title?: string
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`

/**
 * The detection report (PDF) on a ticket: a card with "View report" — which opens the pages in a
 * popup right on the page, full-screen on phones — and "Download". The pages are drawn by the page
 * itself (pdf.js), because phone browsers often cannot show a PDF inside a popup.
 */
export function ReportViewer({ number, name, bytes, uploadedAt, title }: Props) {
  const t = useT()
  const shownTitle = title ?? t('Detection report')
  const [open, setOpen] = useState(false)
  const reportUrl = `/api/tickets/${number}/report`

  return (
    <div className="rounded-2xl border-2 border-border-strong bg-surface p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-danger/15 text-danger">
          <FileText className="h-6 w-6" strokeWidth={2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-bold text-foreground">{shownTitle}</p>
          <p className="text-base text-muted [overflow-wrap:anywhere]">
            PDF{bytes > 0 && ` · ${formatSize(bytes)}`}
          </p>
          {uploadedAt && <UploadStamp at={uploadedAt} label={t('Added')} className="mt-2" />}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-accent px-4 text-lg font-bold text-on-accent transition-opacity hover:opacity-90"
        >
          <FileText className="h-5 w-5" strokeWidth={2.25} />
          {t('View report')}
        </button>
        <a
          href={`${reportUrl}?download=1`}
          download={name}
          className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 border-border-strong px-4 text-lg font-bold text-foreground transition-colors hover:bg-surface-hover"
        >
          <Download className="h-5 w-5" strokeWidth={2.25} />
          {t('Download')}
        </a>
      </div>

      {open && (
        <ReportPopup
          reportUrl={reportUrl}
          downloadUrl={`${reportUrl}?download=1`}
          name={name}
          title={shownTitle}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}

const ZOOM_STEPS = [1, 1.5, 2, 3]

function ReportPopup({
  reportUrl,
  downloadUrl,
  name,
  title,
  onClose,
}: {
  reportUrl: string
  downloadUrl: string
  name: string
  title: string
  onClose: () => void
}) {
  const t = useT()
  const scrollRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const canvases = useRef<(HTMLCanvasElement | null)[]>([])
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  const [width, setWidth] = useState(0) // width of the page area, so pages fit the screen
  const [currentPage, setCurrentPage] = useState(1)
  const [rendered, setRendered] = useState(0)
  const [zoomIndex, setZoomIndex] = useState(0)
  const zoom = ZOOM_STEPS[zoomIndex]

  // Page scroll lock, Escape, and focus while the popup is open.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // Load the PDF once.
  useEffect(() => {
    let cancelled = false
    let task: { destroy: () => Promise<void> } | null = null
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs'
        const loading = pdfjs.getDocument({ url: reportUrl })
        task = loading
        const loaded = await loading.promise
        if (!cancelled) setDoc(loaded)
      } catch (err) {
        console.error('Report viewer: could not open the PDF', err)
        if (!cancelled) setError(true)
      }
    })()
    return () => {
      cancelled = true
      void task?.destroy() // frees the file and the worker's memory
    }
  }, [reportUrl])

  // Track the width of the page area (it changes when a phone is turned).
  const measure = useCallback(() => {
    const el = scrollRef.current
    if (el) setWidth(Math.floor(el.clientWidth))
  }, [])
  useEffect(() => {
    measure()
    const el = scrollRef.current
    if (!el) return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [measure])

  // Draw the pages (again when the width changes). A new pass cancels the one still running and
  // waits for it to stop, because two passes must never draw on the same canvas.
  const pass = useRef<{ cancel: () => void; done: Promise<void> } | null>(null)
  useEffect(() => {
    if (!doc || width === 0) return
    const previous = pass.current
    previous?.cancel()

    let cancelled = false
    let currentTask: { cancel: () => void } | null = null
    const run = (async () => {
      await previous?.done
      if (cancelled) return
      setRendered(0)
      const target = Math.max(240, width - 24) * zoom // a little breathing room at the sides
      const ratio = Math.min(window.devicePixelRatio || 1, 2.5)
      for (let n = 1; n <= doc.numPages; n++) {
        if (cancelled) return
        const page = await doc.getPage(n)
        const base = page.getViewport({ scale: 1 })
        const viewport = page.getViewport({ scale: target / base.width })
        const canvas = canvases.current[n - 1]
        const context = canvas?.getContext('2d')
        if (!canvas || !context || cancelled) continue
        canvas.width = Math.floor(viewport.width * ratio)
        canvas.height = Math.floor(viewport.height * ratio)
        canvas.style.width = `${Math.floor(viewport.width)}px`
        canvas.style.height = `${Math.floor(viewport.height)}px`
        const task = page.render({
          canvas,
          canvasContext: context,
          viewport,
          transform: ratio !== 1 ? [ratio, 0, 0, ratio, 0, 0] : undefined,
        })
        currentTask = task
        await task.promise
        if (!cancelled) setRendered(n)
      }
    })().catch((err) => {
      if (cancelled) return // a cancelled drawing is expected, not an error
      console.error('Report viewer: could not draw a page', err)
      setError(true)
    })

    pass.current = {
      cancel: () => {
        cancelled = true
        currentTask?.cancel()
      },
      done: run,
    }
    return () => pass.current?.cancel()
  }, [doc, width, zoom])

  // Which page is in view (for the "Page 2 of 5" label).
  useEffect(() => {
    const root = scrollRef.current
    if (!doc || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setCurrentPage(Number((visible.target as HTMLElement).dataset.page))
      },
      { root, threshold: [0.25, 0.5, 0.75] },
    )
    root.querySelectorAll('[data-page]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [doc])

  const pages = doc ? Array.from({ length: doc.numPages }, (_, i) => i + 1) : []

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-background md:items-center md:justify-center md:bg-black/70 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-background md:max-w-4xl md:flex-none md:rounded-2xl md:border-2 md:border-border-strong md:shadow-2xl md:h-[90dvh]">
        <header className="flex shrink-0 items-center gap-2 border-b-2 border-border bg-surface px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
          <FileText className="hidden h-6 w-6 shrink-0 text-danger sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold text-foreground">{title}</h2>
            {doc && (
              <p className="text-sm text-muted">
                {t('Page {page} of {total}', { page: currentPage, total: doc.numPages })}
              </p>
            )}
          </div>
          <a
            href={downloadUrl}
            download={name}
            aria-label={t('Download the report')}
            className="inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-xl border-2 border-border-strong px-3 text-base font-bold text-foreground hover:bg-surface-hover"
          >
            <Download className="h-5 w-5" />
            <span className="hidden sm:inline">{t('Download')}</span>
          </a>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t('Close the report')}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-surface-hover text-foreground"
          >
            <X className="h-6 w-6" />
          </button>
        </header>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-auto overscroll-contain bg-surface-hover px-3 py-3 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          {error ? (
            <div className="mx-auto flex max-w-sm flex-col items-center gap-4 py-16 text-center">
              <p className="text-lg font-semibold text-foreground">
                {t('The report could not be shown here.')}
              </p>
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-accent px-5 text-lg font-bold text-on-accent"
              >
                <ExternalLink className="h-5 w-5" />
                {t('Open in a new tab')}
              </a>
            </div>
          ) : (
            <>
              {(!doc || rendered === 0) && (
                <div className="flex items-center justify-center gap-3 py-16 text-lg text-muted">
                  <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
                  {t('Loading the report…')}
                </div>
              )}
              <div
                className={cn(
                  'flex flex-col gap-3',
                  zoom > 1 ? 'w-max items-start' : 'items-center',
                )}
              >
                {pages.map((n) => (
                  <div
                    key={n}
                    data-page={n}
                    className={cn(
                      'overflow-hidden rounded-lg bg-white shadow-md',
                      zoom === 1 && 'max-w-full',
                    )}
                  >
                    <canvas
                      ref={(el) => {
                        canvases.current[n - 1] = el
                      }}
                      className="block"
                      aria-label={`Page ${n}`}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {doc && !error && (
          <div
            className="absolute bottom-4 right-4 flex items-center rounded-full bg-black/80 text-white shadow-lg"
            style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
          >
            <button
              type="button"
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
              disabled={zoomIndex === 0}
              aria-label={t('Zoom out')}
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full disabled:opacity-40"
            >
              <Minus className="h-5 w-5" />
            </button>
            <span className="min-w-12 text-center text-sm font-bold" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <button
              type="button"
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              aria-label={t('Zoom in')}
              className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-full disabled:opacity-40"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
