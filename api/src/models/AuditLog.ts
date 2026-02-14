import mongoose, { Schema } from 'mongoose';

const AuditLogSchema = new Schema(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', index: true },
    action: { type: String, required: true },
    entityType: { type: String },
    entityId: { type: Schema.Types.ObjectId },
    data: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

export type AuditLogDoc = mongoose.InferSchemaType<typeof AuditLogSchema>;

export const AuditLogModel =
  (mongoose.models.AuditLog as mongoose.Model<AuditLogDoc> | undefined) ??
  mongoose.model<AuditLogDoc>('AuditLog', AuditLogSchema);
