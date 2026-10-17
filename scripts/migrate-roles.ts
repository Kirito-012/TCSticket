/**
 * One-time move to the four-role setup (Admin / Zone Inspector / Nodal Manager / Surveyor).
 *
 *   pnpm tsx scripts/migrate-roles.ts            # preview only: prints what it WOULD change
 *   pnpm tsx scripts/migrate-roles.ts --apply    # does it
 *
 * What it does:
 *  1. Updates the roles: adds "Zone Inspector", renames "agent" to "Surveyor", and gives the Nodal
 *     Manager and Zone Inspector their zone / sector limited access.
 *  2. Moves the people of the old separate "Surveyor" role (if there is one) into the Surveyor role,
 *     then removes that old role.
 *  3. Renames the sector field workers from "NAME-01 Zone Inspector" to "NAME-01 Surveyor".
 *  4. Creates the missing accounts: one Zone Inspector per zone and one Nodal Manager per sector.
 *
 * It never changes an existing account's email or password, and it creates nothing that already
 * exists, so running it twice is harmless. Admin accounts are not touched.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { dbConnect } from '../src/server/db/connect'
import { RoleModel } from '../src/server/db/models/role.model'
import { UserModel } from '../src/server/db/models/user.model'
import { getRealSectors } from '../src/server/sectors'
import { ROLES } from './role-definitions'
import { ensurePlacedUsers } from './placed-users'

const APPLY = process.argv.includes('--apply')
// Demo passwords for the accounts this creates. Change them after the first login.
const ZONE_PASSWORD = process.env.SEED_ZONE_PASSWORD ?? 'zone@123'
const NODAL_PASSWORD = process.env.SEED_NODAL_PASSWORD ?? 'nodal@123'

async function main() {
  console.log(
    APPLY ? 'APPLYING changes.\n' : 'PREVIEW only — nothing is written. Add --apply to do it.\n',
  )
  await dbConnect()

  // 1. roles
  const roleIds: Record<string, string> = {}
  for (const role of ROLES) {
    const existing = await RoleModel.findOne({ key: role.key }).lean()
    console.log(
      `role ${role.key}: ${existing ? `"${existing.name}" -> "${role.name}"` : `create "${role.name}"`}`,
    )
    if (APPLY) {
      const doc = await RoleModel.findOneAndUpdate(
        { key: role.key },
        { $set: role },
        { upsert: true, returnDocument: 'after' },
      )
      roleIds[role.key] = doc!._id.toString()
    } else if (existing) {
      roleIds[role.key] = existing._id.toString()
    }
  }

  // 2. the old separate "Surveyor" role
  const legacy = await RoleModel.findOne({ key: 'surveyor' }).lean()
  if (legacy) {
    const people = await UserModel.find({ roleId: legacy._id, deletedAt: null })
      .select('fullname')
      .lean()
    console.log(
      `legacy role "surveyor": ${people.length} people -> Surveyor role, then the old role is removed`,
    )
    if (APPLY) {
      await UserModel.updateMany({ roleId: legacy._id }, { $set: { roleId: roleIds.agent } })
      await RoleModel.deleteOne({ _id: legacy._id })
    }
  }

  // 3. names of the sector field workers
  const workers = await UserModel.find({
    roleId: roleIds.agent,
    fullname: /\s+Zone Inspector$/i,
    deletedAt: null,
  })
    .select('fullname')
    .lean()
  console.log(
    `${workers.length} sector field workers renamed "... Zone Inspector" -> "... Surveyor"`,
  )
  if (APPLY) {
    for (const w of workers) {
      await UserModel.updateOne(
        { _id: w._id },
        {
          $set: {
            fullname: w.fullname.replace(/\s+Zone Inspector$/i, ' Surveyor'),
            title: 'Surveyor',
          },
        },
      )
    }
  }

  // 4. missing Zone Inspectors and Nodal Managers
  const sectors = await getRealSectors(false)
  const created = await ensurePlacedUsers({
    zoneInspectorRoleId: roleIds.zoneinspector,
    nodalManagerRoleId: roleIds.manager,
    sectorNames: new Map(sectors.map((s) => [s.sectorNo, s.name])),
    zonePassword: ZONE_PASSWORD,
    nodalPassword: NODAL_PASSWORD,
    apply: APPLY,
  })
  console.log(`\n${created.length} accounts ${APPLY ? 'created' : 'would be created'}:`)
  for (const line of created) console.log('  ' + line)

  // Anyone already holding the Nodal Manager role without a sector (e.g. the old all-seeing one).
  const unplaced = await UserModel.find({
    roleId: roleIds.manager,
    sectorKey: null,
    deletedAt: null,
  })
    .select('fullname')
    .lean()
  if (unplaced.length > 0) {
    console.log(
      `\nNote: ${unplaced.length} Nodal Manager account(s) have no sector yet and will see nothing until an Admin places them: ` +
        unplaced.map((u) => u.fullname).join(', '),
    )
  }

  console.log(APPLY ? '\nDone.' : '\nPreview finished. Nothing was changed.')
  if (APPLY)
    console.log(
      'New accounts use the demo passwords set at the top of this script — change them after the first login.',
    )
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
