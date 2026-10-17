import { MapPinOff } from 'lucide-react'
import { Topbar } from '@/components/layout/Topbar'

/** Shown to a Zone Inspector or Nodal Manager whose account has not been given a zone / sector yet. */
export function NotPlaced({ what }: { what: 'zone' | 'sector' }) {
  return (
    <>
      <Topbar title="Dashboard" />
      <main className="flex-1 px-4 py-6 animate-fade-in sm:px-8">
        <div className="mx-auto max-w-xl rounded-2xl border-2 border-border-strong bg-surface p-8 text-center">
          <MapPinOff className="mx-auto h-12 w-12 text-warning" strokeWidth={2} />
          <p className="mt-3 text-2xl font-bold text-foreground">No {what} yet</p>
          <p className="mt-2 text-lg text-muted">
            Your account has not been given a {what}, so there is nothing to show. Please ask an
            Admin to set it for you.
          </p>
        </div>
      </main>
    </>
  )
}
