import { agentLeaderboard } from '@/lib/mock-data'
import { Avatar } from '@/components/ui/Avatar'

export function AgentLeaderboard() {
  const max = Math.max(...agentLeaderboard.map((a) => a.resolved))

  return (
    <div className="space-y-4">
      {agentLeaderboard.map((a, i) => (
        <div key={a.person.name} className="flex items-center gap-3">
          <span className="w-4 shrink-0 text-xs font-semibold text-muted">{i + 1}</span>
          <Avatar person={a.person} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between">
              <span className="truncate text-sm font-medium text-muted-strong">
                {a.person.name}
              </span>
              <span className="ml-2 shrink-0 text-xs text-muted">{a.avgHrs}h avg</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.05]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-violet to-indigo-400"
                style={{ width: `${(a.resolved / max) * 100}%` }}
              />
            </div>
          </div>
          <span className="w-8 shrink-0 text-right text-sm font-semibold text-foreground">
            {a.resolved}
          </span>
        </div>
      ))}
    </div>
  )
}
