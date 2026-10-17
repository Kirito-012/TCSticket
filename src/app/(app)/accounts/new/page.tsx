import { Topbar } from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { NewAccountForm } from '@/components/accounts/NewAccountForm'
import { requireAbility } from '@/server/auth/session'
import * as userService from '@/server/services/user.service'
import { getSectorChoices } from '@/server/services/sector.service'

export default async function NewAccountPage() {
  await requireAbility({ action: 'create', subject: 'account' })

  const [rolesRaw, sectors] = await Promise.all([userService.listRoles(), getSectorChoices()])
  const roles = rolesRaw.map((r) => ({ id: String(r._id), key: r.key, name: r.name }))

  return (
    <>
      <Topbar title="New account" description="Add someone to your workspace" />

      <main className="flex-1 px-4 py-6 sm:px-8 animate-fade-in">
        <Card className="mx-auto max-w-xl p-6">
          <NewAccountForm roles={roles} sectors={sectors} />
        </Card>
      </main>
    </>
  )
}
