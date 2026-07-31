import { Topbar } from '@/components/layout/Topbar'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatCard } from '@/components/dashboard/StatCard'
import { VolumeChart } from '@/components/dashboard/VolumeChart'
import { PriorityBreakdown } from '@/components/dashboard/PriorityBreakdown'
import { TopGroups } from '@/components/dashboard/TopGroups'
import { RecentTickets } from '@/components/dashboard/RecentTickets'
import { AgentLeaderboard } from '@/components/dashboard/AgentLeaderboard'
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  TrendingUp,
  Users2,
  Trophy,
} from 'lucide-react'
import Link from 'next/link'

export default function DashboardPage() {
  return (
    <>
      <Topbar
        title="Dashboard"
        description="Here's what's happening across your workspace today"
        primaryAction={{ label: 'New ticket', href: '/tickets/new' }}
      />

      <main className="flex-1 space-y-6 px-8 py-6 animate-fade-in">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Open tickets"
            value="102"
            delta="+8.2%"
            trend="up"
            icon={<Inbox className="h-4 w-4" />}
            accent="accent"
          />
          <StatCard
            label="Avg. first response"
            value="18m"
            delta="-12%"
            trend="up"
            icon={<Clock className="h-4 w-4" />}
            accent="violet"
          />
          <StatCard
            label="Resolved today"
            value="47"
            delta="+5.4%"
            trend="up"
            icon={<CheckCircle2 className="h-4 w-4" />}
            accent="accent"
          />
          <StatCard
            label="SLA at risk"
            value="6"
            delta="+2"
            trend="down"
            icon={<AlertTriangle className="h-4 w-4" />}
            accent="danger"
          />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Volume chart */}
          <Card className="xl:col-span-2">
            <CardHeader
              icon={<TrendingUp className="h-4 w-4" />}
              title="Ticket volume"
              subtitle="Created vs. resolved, last 7 days"
              action={
                <div className="flex items-center gap-4 pt-1 text-xs">
                  <span className="flex items-center gap-1.5 text-muted-strong">
                    <span className="h-2 w-2 rounded-full bg-accent-strong" /> Created
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-strong">
                    <span className="h-2 w-2 rounded-full bg-violet" /> Resolved
                  </span>
                </div>
              }
            />
            <div className="px-3 pb-3 pt-2">
              <VolumeChart />
            </div>
          </Card>

          {/* Priority breakdown */}
          <Card>
            <CardHeader
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Priority breakdown"
              subtitle="Currently open tickets"
            />
            <div className="px-5 pb-5 pt-4">
              <PriorityBreakdown />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          {/* Recent tickets */}
          <Card className="xl:col-span-2">
            <CardHeader
              icon={<Inbox className="h-4 w-4" />}
              title="Recent activity"
              subtitle="Latest updates across all queues"
              action={
                <Link
                  href="/tickets"
                  className="flex shrink-0 items-center gap-1 pt-1 text-xs font-medium text-accent-strong transition-colors hover:text-accent"
                >
                  View all <ArrowUpRight className="h-3 w-3" />
                </Link>
              }
            />
            <div className="mt-3">
              <RecentTickets />
            </div>
          </Card>

          <div className="space-y-6">
            {/* Top groups */}
            <Card>
              <CardHeader
                icon={<Users2 className="h-4 w-4" />}
                title="Top groups"
                subtitle="By ticket volume"
              />
              <div className="px-5 pb-5 pt-4">
                <TopGroups />
              </div>
            </Card>

            {/* Agent leaderboard */}
            <Card>
              <CardHeader
                icon={<Trophy className="h-4 w-4" />}
                title="Top agents"
                subtitle="Resolved this week"
              />
              <div className="px-5 pb-5 pt-4">
                <AgentLeaderboard />
              </div>
            </Card>
          </div>
        </div>
      </main>
    </>
  )
}
