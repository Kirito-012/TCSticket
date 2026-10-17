import { config } from 'dotenv'
config({ path: '.env.local' })

import { dbConnect } from '../src/server/db/connect'
import { TicketModel } from '../src/server/db/models/ticket.model'
import { UserModel } from '../src/server/db/models/user.model'
import { RoleModel } from '../src/server/db/models/role.model'
import { findSector } from '../src/server/sectors'

async function main() {
  await dbConnect()
  // New tickets go to the sector's Surveyor (role "agent"), not its Nodal Manager.
  const surveyorRole = await RoleModel.findOne({ key: 'agent' }).select('_id').lean()
  const tickets = await TicketModel.find({
    $or: [
      { 'location.latitude': { $ne: null }, 'location.longitude': { $ne: null } },
      { issue: /Location:\s*<\/?[^>]*>\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?/i },
    ],
  })
    .select('_id number location issue')
    .lean()

  let updated = 0
  let outside = 0
  for (const ticket of tickets) {
    const locationMatch = ticket.issue.match(
      /Location:\s*<\/?[^>]*>\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i,
    )
    const latitude = ticket.location?.latitude ?? (locationMatch ? Number(locationMatch[1]) : null)
    const longitude =
      ticket.location?.longitude ?? (locationMatch ? Number(locationMatch[2]) : null)
    if (typeof latitude !== 'number' || typeof longitude !== 'number') continue

    const sector = await findSector(latitude, longitude)
    if (!sector) {
      outside++
      continue
    }

    const assignee = await UserModel.findOne({
      sectorKey: sector.key,
      roleId: surveyorRole?._id,
      isActive: true,
      deletedAt: null,
    })
      .select('_id')
      .lean()

    await TicketModel.updateOne(
      { _id: ticket._id },
      {
        $set: {
          sectorKey: sector.key,
          assigneeId: assignee?._id ?? null,
          location: { latitude, longitude },
        },
      },
    )
    updated++
    console.log(`#${ticket.number} -> ${sector.name} (${sector.key})`)
  }

  console.log(JSON.stringify({ checked: tickets.length, updated, outside }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
