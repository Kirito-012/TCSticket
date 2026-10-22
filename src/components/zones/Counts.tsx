import { cn } from '@/lib/utils'
import { getT } from '@/i18n/server'

/** One small labelled number on a zone / sector card. Quiet when it is zero, loud when it needs action. */
export function CountPill({
  label,
  value,
  tone = 'plain',
}: {
  label: string
  value: number
  tone?: 'plain' | 'warning' | 'danger'
}) {
  const hot = value > 0 && tone !== 'plain'
  return (
    <div
      className={cn(
        'min-w-0 rounded-xl border-2 px-2 py-2 text-center',
        hot && tone === 'warning' && 'border-warning bg-warning-soft',
        hot && tone === 'danger' && 'border-danger bg-danger-soft',
        !hot && 'border-border bg-surface',
      )}
    >
      <p
        className={cn(
          'text-2xl font-bold leading-none',
          hot && tone === 'warning' && 'text-warning',
          hot && tone === 'danger' && 'text-danger',
          !hot && 'text-foreground',
        )}
      >
        {value.toLocaleString()}
      </p>
      <p className="mt-1 text-sm font-semibold leading-tight text-muted [overflow-wrap:anywhere]">
        {label}
      </p>
    </div>
  )
}

/** How much of the work is finished, as a bar and a sentence. */
export async function DoneBar({ done, total }: { done: number; total: number }) {
  const t = await getT()
  const percent = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t('Finished')}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <p className="mt-1.5 text-sm text-muted">
        {total === 0
          ? t('No tickets yet')
          : t('{done} of {total} done ({percent}%)', {
              done: done.toLocaleString(),
              total: total.toLocaleString(),
              percent,
            })}
      </p>
    </div>
  )
}
