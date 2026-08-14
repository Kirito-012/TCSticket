import 'server-only'

import bcrypt from 'bcryptjs'
import { dbConnect } from '@/server/db/connect'
import { UserModel } from '@/server/db/models/user.model'
import { RoleModel } from '@/server/db/models/role.model'

export async function listUsers() {
  await dbConnect()
  const users = await UserModel.find({ deletedAt: null })
    .sort({ createdAt: -1 })
    .populate({ path: 'roleId', select: 'key name' })
    .lean()
  return users
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
}) {
  await dbConnect()

  const existing = await UserModel.findOne({ email: input.email.toLowerCase() }).lean()
  if (existing) throw new Error('An account with that email already exists.')

  const passwordHash = await bcrypt.hash(input.password, 12)
  return UserModel.create({
    email: input.email.toLowerCase(),
    passwordHash,
    fullname: input.fullname,
    roleId: input.roleId,
    isActive: true,
  })
}

export async function updateUserRole(userId: string, roleId: string) {
  await dbConnect()
  await UserModel.updateOne({ _id: userId }, { $set: { roleId } })
}

export async function setUserActive(userId: string, isActive: boolean) {
  await dbConnect()
  await UserModel.updateOne({ _id: userId }, { $set: { isActive } })
}
