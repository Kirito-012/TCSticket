import { Topbar } from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { AccountsTable } from '@/components/accounts/AccountsTable'
import { PendingApprovals } from '@/components/accounts/PendingApprovals'
import { requireAbility } from '@/server/auth/session'
import * as userService from '@/server/services/user.service'

export default async function AccountsPage() {
  const { ability } = await requireAbility({ action: 'read', subject: 'account' })
  const canEdit = ability.can('update', 'account')

  const [usersRaw, pendingRaw, rolesRaw] = await Promise.all([
    userService.listUsers(),
    canEdit ? userService.listPendingUsers() : Promise.resolve([]),
    userService.listRoles(),
  ])

  const users = usersRaw.map((u) => {
    const role = u.roleId as unknown as { _id: unknown; key: string; name: string } | null
    return {
      id: String(u._id),
      fullname: u.fullname,
      email: u.email,
      roleId: role ? String(role._id) : '',
      roleName: role?.name ?? 'Unknown',
      isActive: u.isActive,
      createdAt: new Date(u.createdAt as Date).toISOString(),
    }
  })
  const pending = pendingRaw.map((u) => {
    const role = u.roleId as unknown as { key: string; name: string } | null
    return {
      id: String(u._id),
      fullname: u.fullname,
      email: u.email,
      roleName: role?.name ?? 'Unknown',
      requestedAt: new Date(u.createdAt as Date).toISOString(),
    }
  })
  const roles = rolesRaw.map((r) => ({ id: String(r._id), name: r.name }))

  return (
    <>
      <Topbar
        title="Accounts"
        description={`${users.length} people in your workspace`}
        primaryAction={canEdit ? { label: 'New account', href: '/accounts/new' } : undefined}
      />

      <main className="flex-1 px-8 py-6 animate-fade-in">
        {canEdit && <PendingApprovals users={pending} />}

        <Card>
          <AccountsTable users={users} roles={roles} canEdit={canEdit} />
        </Card>
      </main>
    </>
  )
}
