import mongoose, { Schema } from 'mongoose';
import { Role } from '../auth/auth.js';

const UserSchema = new Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    name: { type: String },
    passwordHash: { type: String, required: true },
    roles: { type: [String], enum: Object.values(Role), required: true, default: [Role.CUSTOMER] },
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner' },
    refreshTokenVersion: { type: Number, required: true, default: 0 }
  },
  { timestamps: true }
);

export type UserDoc = mongoose.InferSchemaType<typeof UserSchema>;

export const UserModel =
  (mongoose.models.User as mongoose.Model<UserDoc> | undefined) ??
  mongoose.model<UserDoc>('User', UserSchema);
