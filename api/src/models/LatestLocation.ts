import mongoose, { Schema } from 'mongoose';

export enum EntityType {
  VEHICLE = 'VEHICLE',
  DELIVERY_TASK = 'DELIVERY_TASK',
  YARD = 'YARD'
}

const LatestLocationSchema = new Schema(
  {
    entityType: { type: String, enum: Object.values(EntityType), required: true },
    entityId: { type: Schema.Types.ObjectId, required: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    heading: { type: Number },
    speed: { type: Number },
    accuracy: { type: Number },
    timestamp: { type: Date, required: true },
    source: { type: String, required: true },
    receivedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

LatestLocationSchema.index({ entityType: 1, entityId: 1 }, { unique: true });

export type LatestLocationDoc = mongoose.InferSchemaType<typeof LatestLocationSchema>;

export const LatestLocationModel =
  (mongoose.models.LatestLocation as mongoose.Model<LatestLocationDoc> | undefined) ??
  mongoose.model<LatestLocationDoc>('LatestLocation', LatestLocationSchema);
