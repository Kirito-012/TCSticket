import { SimpleNav, type NavLink } from '@/components/layout/SimpleNav'
import { LiveRefresh } from '@/components/layout/LiveRefresh'
import { cn } from '@/lib/utils'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import { requireTicketScope } from '@/server/auth/session'
import { countTicketsByStatus } from '@/server/services/ticket.service'
import { listPendingUsers } from '@/server/services/user.service'
import { personShortName } from '@/lib/plain-words'
import { getT } from '@/i18n/server'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ability, scope } = await requireTicketScope()
  const t = await getT()
  const canApproveAccounts = ability.can('update', 'account')
  // Surveyors (only ever see their own tickets) get the simple, big-text, light version of the
  // app. Admins, Zone Inspectors and Nodal Managers get the same simple navigation and screens in
  // the dark theme.
  const isInspector = scope.kind === 'own'
  const [ticketCounts, pendingUsers] = await Promise.all([
    countTicketsByStatus(scope),
    canApproveAccounts ? listPendingUsers() : Promise.resolve([]),
  ])

  const todoCount = ticketCounts.byStatus
    .filter((s) => s.slug !== 'resolved' && s.slug !== 'closed')
    .reduce((sum, s) => sum + s.count, 0)
  const roleLabel =
    {
      agent: t('Surveyor'),
      zoneinspector: t('Zone Inspector'),
      manager: t('Nodal Manager'),
      admin: t('Admin'),
    }[user.roleKey ?? ''] ?? user.roleName
  const firstName = personShortName(user.name || user.email || '') || 'there'

  const links: NavLink[] = isInspector
    ? [
        { label: t('Home'), href: '/dashboard', icon: 'home' },
        { label: t('My tickets'), href: '/tickets', icon: 'tasks', badge: todoCount },
      ]
    : [
        { label: t('Dashboard'), href: '/dashboard', icon: 'home' },
        { label: t('Tickets'), href: '/tickets', icon: 'tasks', badge: todoCount },
        ...(ability.can('read', 'account')
          ? [
              {
                label: t('People'),
                href: '/accounts',
                icon: 'people' as const,
                badge: pendingUsers.length,
              },
            ]
          : []),
      ]

  return (
    <SidebarProvider simple light={isInspector}>
      <div className={cn('flex min-h-screen', isInspector && 'simple-ui')}>
        <LiveRefresh />
        <SimpleNav name={firstName} roleLabel={roleLabel} links={links} />
        <div className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-0 lg:pl-64">{children}</div>
      </div>
    </SidebarProvider>
  )
}
