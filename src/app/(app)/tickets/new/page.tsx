import { Topbar } from '@/components/layout/Topbar'
import { Card } from '@/components/ui/Card'
import { NewTicketForm } from '@/components/tickets/NewTicketForm'
import { dbConnect } from '@/server/db/connect'
import { TicketTypeModel } from '@/server/db/models/ticket-type.model'
import { TicketPriorityModel } from '@/server/db/models/ticket-priority.model'
import { requireTicketScope } from '@/server/auth/session'
import { getSectorOptions } from '@/server/services/sector.service'

export default async function NewTicketPage() {
  const { scope } = await requireTicketScope()
  await dbConnect()
  const [types, priorities, sectors] = await Promise.all([
    TicketTypeModel.find({ isActive: true }).sort({ name: 1 }).lean(),
    TicketPriorityModel.find().sort({ order: 1 }).lean(),
    getSectorOptions(scope),
  ])

  return (
    <>
      <Topbar title="New ticket" description="Create a ticket for your team to work" />

      <main className="flex-1 px-4 py-6 sm:px-8 animate-fade-in">
        <Card className="mx-auto max-w-2xl p-6">
          <NewTicketForm
            types={types.map((t) => ({
              id: String(t._id),
              name: t.name,
              allowedPriorityIds: (t.allowedPriorityIds ?? []).map(String),
              defaultPriorityId: t.defaultPriorityId ? String(t.defaultPriorityId) : null,
            }))}
            priorities={priorities.map((p) => ({ id: String(p._id), name: p.name }))}
            sectors={sectors}
            sectorRequired={scope.kind === 'sectors'}
          />
        </Card>
      </main>
    </>
  )
}
