import 'server-only'

import bcrypt from 'bcryptjs'
import { dbConnect } from '@/server/db/connect'
import { UserModel } from '@/server/db/models/user.model'
import { RoleModel } from '@/server/db/models/role.model'
import type { TicketScope } from '@/lib/ticket-scope'
import { placementKindOf, resolvePlacement, type Placement } from '@/lib/placement'

/** Everyone except pending signups — the Accounts page's main table. */
export async function listUsers() {
  await dbConnect()
  const users = await UserModel.find({ deletedAt: null, status: { $ne: 'pending' } })
    .sort({ createdAt: -1 })
    .populate({ path: 'roleId', select: 'key name' })
    .lean()
  return users
}

/** Accounts awaiting Admin approval — surfaced at the top of the Accounts page. */
export async function listPendingUsers() {
  await dbConnect()
  const users = await UserModel.find({ deletedAt: null, status: 'pending' })
    .sort({ createdAt: -1 })
    .populate({ path: 'roleId', select: 'key name' })
    .lean()
  return users
}

/** Where a person works (sector / zone), for checking that a ticket may be handed to them. */
export async function getUserPlacement(userId: string) {
  await dbConnect()
  const doc = await UserModel.findOne({ _id: userId, deletedAt: null, isActive: true })
    .select('sectorKey zoneKey')
    .lean()
  return doc ? { sectorKey: doc.sectorKey ?? null, zoneKey: doc.zoneKey ?? null } : null
}

/**
 * The people a ticket can be handed to by someone with this scope: everyone for an Admin, the
 * people placed in the zone's / sector's sectors for a Zone Inspector / Nodal Manager, and nobody
 * for a Surveyor.
 */
export async function listAssignableUsers(scope: TicketScope) {
  await dbConnect()
  if (scope.kind === 'own') return []
  const filter =
    scope.kind === 'all'
      ? { isActive: true, deletedAt: null }
      : { isActive: true, deletedAt: null, sectorKey: { $in: scope.sectorKeys } }
  return UserModel.find(filter).select('fullname email').sort({ fullname: 1 }).lean()
}

/**
 * The Surveyor a new ticket in this sector is handed to: the sector's field worker (role `agent`),
 * not its Nodal Manager, who lives in the same sector. Null when the sector has no Surveyor, in
 * which case the ticket waits for the Nodal Manager to hand it out.
 */
export async function findSectorSurveyor(sectorKey: string) {
  await dbConnect()
  const role = await RoleModel.findOne({ key: 'agent' }).select('_id').lean()
  if (!role) return null
  return UserModel.findOne({ sectorKey, roleId: role._id, isActive: true, deletedAt: null })
    .sort({ createdAt: 1 })
    .lean()
}

export async function listRoles() {
  await dbConnect()
  return RoleModel.find().sort({ rank: 1 }).lean()
}

export async function createUser(input: {
  fullname: string
  email: string
  password: string
  roleId: string
  sectorNo?: string
  zoneKey?: string
}) {
  await dbConnect()

  const existing = await UserModel.findOne({ email: input.email.toLowerCase() }).lean()
  if (existing) throw new Error('An account with that email already exists.')

  const role = await RoleModel.findById(input.roleId).select('key').lean()
  if (!role) throw new Error('That role does not exist.')
  const placed = resolvePlacement(role.key, input)
  if (!placed.ok) throw new Error(placed.error)

  const passwordHash = await bcrypt.hash(input.password, 12)
  return UserModel.create({
    email: input.email.toLowerCase(),
    passwordHash,
    fullname: input.fullname,
    roleId: input.roleId,
    ...placed.placement,
    isActive: true,
  })
}

/** Changes someone's role. Whatever zone / sector no longer fits the new role is cleared. */
export async function updateUserRole(userId: string, roleId: string) {
  await dbConnect()
  const role = await RoleModel.findById(roleId).select('key').lean()
  const kind = role ? placementKindOf(role.key) : null
  const keep: Partial<Placement> = {}
  if (kind !== 'sector') keep.sectorKey = null
  if (kind !== 'zone') keep.zoneKey = null
  await UserModel.updateOne({ _id: userId }, { $set: { roleId, ...keep } })
}

/** Moves someone to another sector or zone (which one is used depends on their role). */
export async function updateUserPlacement(
  userId: string,
  input: { sectorNo?: string | null; zoneKey?: string | null },
) {
  await dbConnect()
  const user = await UserModel.findOne({ _id: userId, deletedAt: null })
    .populate('roleId', 'key')
    .lean()
  const roleKey = (user?.roleId as unknown as { key?: string } | null)?.key
  if (!user || !roleKey) throw new Error('Account not found.')
  const placed = resolvePlacement(roleKey, input)
  if (!placed.ok) throw new Error(placed.error)
  await UserModel.updateOne({ _id: userId }, { $set: placed.placement })
}

export async function setUserActive(userId: string, isActive: boolean) {
  await dbConnect()
  await UserModel.updateOne({ _id: userId }, { $set: { isActive } })
}

/**
 * Public self-registration — creates a `status: 'pending'` account that cannot sign in (see
 * auth.ts) until an Admin calls approveUser(). roleKey is restricted to 'manager' | 'agent' by
 * the caller's Zod schema (src/lib/schemas/register.ts); re-checked here too since this is the
 * one service function reachable by an unauthenticated caller.
 */
export async function registerPendingUser(input: {
  fullname: string
  email: string
  password: string
  roleKey: 'agent' | 'manager' | 'zoneinspector'
  sectorNo?: string
  zoneKey?: string
}) {
  await dbConnect()

  const existing = await UserModel.findOne({ email: input.email.toLowerCase() }).lean()
  if (existing) throw new Error('An account with that email already exists.')

  const role = await RoleModel.findOne({ key: input.roleKey }).lean()
  if (!role) throw new Error('That role is not available for self-registration.')
  const placed = resolvePlacement(input.roleKey, input)
  if (!placed.ok) throw new Error(placed.error)

  const passwordHash = await bcrypt.hash(input.password, 12)
  return UserModel.create({
    email: input.email.toLowerCase(),
    passwordHash,
    fullname: input.fullname,
    roleId: role._id,
    ...placed.placement,
    isActive: true,
    status: 'pending',
  })
}

export async function approveUser(userId: string) {
  await dbConnect()
  await UserModel.updateOne({ _id: userId }, { $set: { status: 'active' } })
}

export async function rejectUser(userId: string) {
  await dbConnect()
  await UserModel.updateOne({ _id: userId }, { $set: { status: 'rejected' } })
}
