import bcrypt from 'bcryptjs'
import { UserModel } from '../src/server/db/models/user.model'
import { ZONES, prettySectorName, sectorKeyOf } from '../src/lib/zones'

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/**
 * Makes sure every zone has a Zone Inspector account and every sector a Nodal Manager account.
 * Existing accounts are NEVER changed (nothing is overwritten, no password is reset): an account is
 * only created when the email or the zone / sector has none. Returns what it made (or would make).
 */
export async function ensurePlacedUsers(options: {
  zoneInspectorRoleId: string
  nodalManagerRoleId: string
  /** Sector number -> its name in the map database, e.g. 1 -> "BAHADRABAD-01". */
  sectorNames: Map<number, string>
  /** Initial passwords, one per role (demo values; change them after the first login). */
  zonePassword: string
  nodalPassword: string
  apply: boolean
}) {
  const created: string[] = []
  const zoneHash = options.apply ? await bcrypt.hash(options.zonePassword, 12) : ''
  const nodalHash = options.apply ? await bcrypt.hash(options.nodalPassword, 12) : ''

  for (const zone of ZONES) {
    const email = `${zone.key}@droneseva.local`
    const exists = await UserModel.exists({
      $or: [{ email }, { zoneKey: zone.key, roleId: options.zoneInspectorRoleId, deletedAt: null }],
    })
    if (exists) continue
    created.push(`${zone.name} Zone Inspector <${email}>`)
    if (options.apply) {
      await UserModel.create({
        email,
        passwordHash: zoneHash,
        fullname: `${zone.name} Zone Inspector`,
        title: 'Zone Inspector',
        roleId: options.zoneInspectorRoleId,
        zoneKey: zone.key,
        isActive: true,
      })
    }
  }

  for (const zone of ZONES) {
    for (const no of zone.sectorNos) {
      const key = sectorKeyOf(no)
      const mapName = options.sectorNames.get(no) ?? `Sector ${no}`
      const email = `${slug(mapName)}-nodal@droneseva.local`
      const exists = await UserModel.exists({
        $or: [{ email }, { sectorKey: key, roleId: options.nodalManagerRoleId, deletedAt: null }],
      })
      if (exists) continue
      created.push(`${mapName} Nodal Manager <${email}> (${prettySectorName(mapName)})`)
      if (options.apply) {
        await UserModel.create({
          email,
          passwordHash: nodalHash,
          fullname: `${mapName} Nodal Manager`,
          title: 'Nodal Manager',
          roleId: options.nodalManagerRoleId,
          sectorKey: key,
          isActive: true,
        })
      }
    }
  }
  return created
}
