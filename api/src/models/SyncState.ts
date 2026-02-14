import mongoose, { Schema } from 'mongoose';

const SyncStateSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    value: { type: String, required: true }
  },
  { timestamps: true }
);

export type SyncStateDoc = mongoose.InferSchemaType<typeof SyncStateSchema>;

export const SyncStateModel =
  (mongoose.models.SyncState as mongoose.Model<SyncStateDoc> | undefined) ??
  mongoose.model<SyncStateDoc>('SyncState', SyncStateSchema);
