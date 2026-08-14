import { Sidebar } from '@/components/layout/Sidebar'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import { requireTicketScope } from '@/server/auth/session'
import { countTicketsByStatus } from '@/server/services/ticket.service'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, forcedAssigneeId } = await requireTicketScope()
  const ticketCounts = await countTicketsByStatus(forcedAssigneeId)

  return (
    <SidebarProvider>
      <div className="flex min-h-screen">
        <Sidebar user={user} ticketCount={ticketCounts.total} />
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">{children}</div>
      </div>
    </SidebarProvider>
  )
}
