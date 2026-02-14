import mongoose, { Schema } from 'mongoose';
import { ENV } from '../env.js';
import { EntityType } from './LatestLocation.js';

const TrackingHistorySchema = new Schema(
  {
    entityType: { type: String, enum: Object.values(EntityType), required: true, index: true },
    entityId: { type: Schema.Types.ObjectId, required: true, index: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    heading: { type: Number },
    speed: { type: Number },
    accuracy: { type: Number },
    timestamp: { type: Date, required: true, index: true },
    source: { type: String, required: true },
    receivedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

TrackingHistorySchema.index(
  { timestamp: 1 },
  { expireAfterSeconds: ENV.trackingHistoryTtlDays * 24 * 60 * 60 }
);

export type TrackingHistoryDoc = mongoose.InferSchemaType<typeof TrackingHistorySchema>;

export const TrackingHistoryModel =
  (mongoose.models.TrackingHistory as mongoose.Model<TrackingHistoryDoc> | undefined) ??
  mongoose.model<TrackingHistoryDoc>('TrackingHistory', TrackingHistorySchema);
