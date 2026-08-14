import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import { requireTicketScope } from '@/server/auth/session'
import { countTicketsByStatus } from '@/server/services/ticket.service'
import { listPendingUsers } from '@/server/services/user.service'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ability, forcedAssigneeId } = await requireTicketScope()
  const canApproveAccounts = ability.can('update', 'account')
  const [ticketCounts, pendingUsers] = await Promise.all([
    countTicketsByStatus(forcedAssigneeId),
    canApproveAccounts ? listPendingUsers() : Promise.resolve([]),
  ])

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar
          user={user}
          ticketCount={ticketCounts.total}
          pendingAccountsCount={pendingUsers.length}
        />
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">{children}</div>
      </div>
    </SidebarProvider>
  )
}
