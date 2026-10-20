import { config } from 'dotenv'
config({ path: '.env.local' })

import bcrypt from 'bcryptjs'
import { randomBytes } from 'node:crypto'
import { dbConnect } from '../src/server/db/connect'
import { RoleModel } from '../src/server/db/models/role.model'
import { UserModel } from '../src/server/db/models/user.model'
import { REOPENED_STATUS } from '../src/server/reopened-status'
import { TicketStatusModel } from '../src/server/db/models/ticket-status.model'
import { TicketPriorityModel } from '../src/server/db/models/ticket-priority.model'
import { TicketTypeModel } from '../src/server/db/models/ticket-type.model'
import { getRealSectors } from '../src/server/sectors'
import { ROLES } from './role-definitions'
import { ensurePlacedUsers } from './placed-users'

const STATUSES = [
  { name: 'New', slug: 'new', color: '#818cf8', order: 0, isResolved: false, isDefault: true },
  { name: 'Open', slug: 'open', color: '#10b981', order: 1, isResolved: false, isDefault: false },
  {
    name: 'Pending',
    slug: 'pending',
    color: '#f59e0b',
    order: 2,
    isResolved: false,
    isDefault: false,
  },
  {
    name: 'Resolved',
    slug: 'resolved',
    color: '#34d399',
    order: 3,
    isResolved: true,
    isDefault: false,
  },
  {
    name: 'Closed',
    slug: 'closed',
    color: '#6b7280',
    order: 4,
    isResolved: true,
    isDefault: false,
  },
  REOPENED_STATUS,
]

const PRIORITIES = [
  { name: 'Low', slug: 'low', color: '#818cf8', order: 0, slaHours: 72, overdueAfterHours: 96 },
  {
    name: 'Normal',
    slug: 'normal',
    color: '#10b981',
    order: 1,
    slaHours: 24,
    overdueAfterHours: 36,
  },
  { name: 'High', slug: 'high', color: '#f59e0b', order: 2, slaHours: 8, overdueAfterHours: 12 },
  {
    name: 'Critical',
    slug: 'critical',
    color: '#f87171',
    order: 3,
    slaHours: 2,
    overdueAfterHours: 4,
  },
]

const TYPES = [
  { name: 'Issue', slug: 'issue' },
  { name: 'Question', slug: 'question' },
  { name: 'Task', slug: 'task' },
  // Created via POST /api/v1/tickets by the DroneSeva integration — see src/app/api/v1/tickets.
  { name: 'Garbage Detection', slug: 'garbage-detection' },
]

async function seed() {
  await dbConnect()
  const sectors = await getRealSectors(false)

  console.log('Seeding roles...')
  const roleDocs: Record<string, string> = {}
  for (const role of ROLES) {
    const doc = await RoleModel.findOneAndUpdate(
      { key: role.key },
      { $set: role },
      { upsert: true, returnDocument: 'after' },
    )
    roleDocs[role.key] = doc._id.toString()
  }

  console.log('Seeding statuses...')
  for (const status of STATUSES) {
    await TicketStatusModel.findOneAndUpdate(
      { slug: status.slug },
      { $set: status },
      { upsert: true },
    )
  }

  console.log('Seeding priorities...')
  const priorityIds: Record<string, string> = {}
  for (const priority of PRIORITIES) {
    const doc = await TicketPriorityModel.findOneAndUpdate(
      { slug: priority.slug },
      { $set: priority },
      { upsert: true, returnDocument: 'after' },
    )
    priorityIds[priority.slug] = doc._id.toString()
  }

  console.log('Seeding types...')
  for (const type of TYPES) {
    await TicketTypeModel.findOneAndUpdate(
      { slug: type.slug },
      {
        $set: {
          ...type,
          allowedPriorityIds: Object.values(priorityIds),
          defaultPriorityId: priorityIds.normal,
        },
      },
      { upsert: true },
    )
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@thecraftsync.local').toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'ChangeMe123!'

  console.log(`Seeding admin user (${adminEmail})...`)
  const passwordHash = await bcrypt.hash(adminPassword, 12)
  await UserModel.findOneAndUpdate(
    { email: adminEmail },
    {
      $set: {
        email: adminEmail,
        passwordHash,
        fullname: 'Admin',
        roleId: roleDocs.admin,
        isActive: true,
        deletedAt: null,
      },
    },
    { upsert: true },
  )

  // Service-account "reporter" for tickets auto-created via POST /api/v1/tickets (DroneSeva
  // integration). Never logs in — password is a random value that's discarded immediately.
  const botEmail = 'droneseva-bot@thecraftsync.local'
  console.log(`Seeding integration service account (${botEmail})...`)
  const botPasswordHash = await bcrypt.hash(randomBytes(32).toString('hex'), 12)
  const botUser = await UserModel.findOneAndUpdate(
    { email: botEmail },
    {
      $set: {
        email: botEmail,
        passwordHash: botPasswordHash,
        fullname: 'DroneSeva',
        roleId: roleDocs.agent,
        isActive: true,
        deletedAt: null,
      },
    },
    { upsert: true, returnDocument: 'after' },
  )

  const demoPassword = 'Surveyor123!'
  for (const sector of sectors) {
    // e.g. "BAHADRABAD-01" -> bahadrabad-01@droneseva.local
    const email = `${sector.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}@droneseva.local`
    await UserModel.findOneAndUpdate(
      { sectorKey: sector.key }, // match by sector, so a changed email never creates a duplicate
      {
        $set: {
          email,
          passwordHash: await bcrypt.hash(demoPassword, 12),
          fullname: `${sector.name} Surveyor`,
          title: 'Surveyor',
          roleId: roleDocs.agent,
          sectorKey: sector.key,
          isActive: true,
          deletedAt: null,
        },
      },
      { upsert: true },
    )
  }
  // One Zone Inspector per zone and one Nodal Manager per sector (never changes existing accounts).
  await ensurePlacedUsers({
    zoneInspectorRoleId: roleDocs.zoneinspector,
    nodalManagerRoleId: roleDocs.manager,
    sectorNames: new Map(sectors.map((x) => [x.sectorNo, x.name])),
    zonePassword: process.env.SEED_ZONE_PASSWORD ?? 'zone@123',
    nodalPassword: process.env.SEED_NODAL_PASSWORD ?? 'nodal@123',
    apply: true,
  })
  await UserModel.updateMany(
    { sectorKey: { $in: ['haridwar-north', 'haridwar-central', 'haridwar-south'] } },
    { $set: { sectorKey: null, isActive: false } },
  )

  console.log(
    `\nDone. Seeded 4 roles, 5 statuses, 4 priorities, 4 types, 1 admin user, 1 service account, and ${sectors.length} real sector surveyors, zone inspectors and nodal managers.`,
  )
  console.log(`Log in with: ${adminEmail} / ${adminPassword}`)
  console.log(
    `Demo password for the surveyors, zone inspectors and nodal managers: ${demoPassword}`,
  )
  console.log(`DroneSeva integration service-account id: ${botUser._id.toString()} (${botEmail})`)
  process.exit(0)
}

seed().catch((err) => {
  console.error(err)
  process.exit(1)
})
