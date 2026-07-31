import { Schema, model, models, type InferSchemaType } from 'mongoose'

const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    fullname: { type: String, required: true },
    title: { type: String },
    avatarUrl: { type: String },
    roleId: { type: Schema.Types.ObjectId, ref: 'Role', required: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

export type User = InferSchemaType<typeof userSchema>
export const UserModel = models.User ?? model('User', userSchema)
