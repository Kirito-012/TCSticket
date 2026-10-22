import { AlertTriangle, Flame, Inbox, TrendingUp, Users2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { VolumeChart } from '@/components/dashboard/VolumeChart'
import { PriorityBreakdown } from '@/components/dashboard/PriorityBreakdown'
import { WorkloadByAssignee } from '@/components/dashboard/WorkloadByAssignee'
import { ActivityFeed } from '@/components/dashboard/ActivityFeed'
import { GarbageHeatmap } from '@/components/dashboard/GarbageHeatmap'
import type { getDashboardData } from '@/server/services/ticket.service'
import { getT } from '@/i18n/server'

type DashboardData = Awaited<ReturnType<typeof getDashboardData>>

/**
 * The bigger picture for Admins and Managers, on the dashboard itself: where the garbage is (map
 * and sector counts), how tickets are flowing, how urgent they are, who is carrying the load and
 * what just happened. Sits below the numbers and the "needs someone" list.
 */
export async function AdminOverview({
  data,
  canFilter,
}: {
  data: DashboardData
  canFilter: boolean
}) {
  const t = await getT()
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader
          icon={<Flame className="h-4 w-4" />}
          title={t('Garbage hotspots')}
          subtitle={t('Tickets by sector — tap a sector on the map')}
        />
        <div className="pt-4">
          <GarbageHeatmap sectors={data.sectors} canFilter={canFilter} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={<TrendingUp className="h-4 w-4" />}
            title={t('Ticket volume')}
            subtitle={t('Created vs. resolved, last 7 days')}
            action={
              <div className="flex items-center gap-4 pt-1 text-xs">
                <span className="flex items-center gap-1.5 text-muted-strong">
                  <span className="h-2 w-2 rounded-full bg-accent-strong" /> {t('Created')}
                </span>
                <span className="flex items-center gap-1.5 text-muted-strong">
                  <span className="h-2 w-2 rounded-full bg-violet" /> {t('Resolved')}
                </span>
              </div>
            }
          />
          <div className="px-3 pb-3 pt-2">
            <VolumeChart data={data.ticketVolume} />
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<AlertTriangle className="h-4 w-4" />}
            title={t('How urgent')}
            subtitle={t('Open tickets by priority')}
          />
          <div className="px-5 pb-5 pt-4">
            <PriorityBreakdown data={data.priorityBreakdown} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            icon={<Inbox className="h-4 w-4" />}
            title={t('Recent activity')}
            subtitle={t('What just happened')}
          />
          <div className="mt-3">
            <ActivityFeed items={data.recentActivity} />
          </div>
        </Card>

        <Card>
          <CardHeader
            icon={<Users2 className="h-4 w-4" />}
            title={t('Who has how many')}
            subtitle={t('Open tickets per person')}
          />
          <div className="px-5 pb-5 pt-4">
            <WorkloadByAssignee data={data.workloadByAssignee} />
          </div>
        </Card>
      </div>
    </div>
  )
}
