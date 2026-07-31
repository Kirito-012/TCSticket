import { topGroups } from '@/lib/mock-data'

export function TopGroups() {
  return (
    <div className="space-y-3.5">
      {topGroups.map((g) => (
        <div key={g.name}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-muted-strong">{g.name}</span>
            <span className="text-xs text-muted">{g.count} tickets</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong"
              style={{ width: `${g.share * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
