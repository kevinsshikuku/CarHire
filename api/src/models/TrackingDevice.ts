import mongoose, { Schema } from 'mongoose';
import { TrackingMethod, TrackingProviderType } from './TrackingIntegration.js';

export enum TrackingDeviceHealthStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  UNKNOWN = 'UNKNOWN'
}

const LastLocationSchema = new Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    heading: { type: Number },
    speed: { type: Number },
    timestamp: { type: Date, required: true },
    source: { type: String, required: true }
  },
  { _id: false }
);

const TrackingDeviceSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    trackingIntegrationId: { type: Schema.Types.ObjectId, ref: 'TrackingIntegration', required: true, index: true },
    branchId: { type: Schema.Types.ObjectId, ref: 'PartnerBranch' },
    vehicleId: { type: Schema.Types.ObjectId, ref: 'Vehicle' },
    label: { type: String, required: true },

    providerType: { type: String, enum: Object.values(TrackingProviderType), required: true },
    method: { type: String, enum: Object.values(TrackingMethod), required: true },

    externalDeviceId: { type: String, required: true },
    traccarDeviceId: { type: Number },

    lastSeenAt: { type: Date },
    lastLocation: { type: LastLocationSchema },
    healthStatus: { type: String, enum: Object.values(TrackingDeviceHealthStatus), required: true, default: TrackingDeviceHealthStatus.UNKNOWN },

    assignedAt: { type: Date },
    unassignedAt: { type: Date }
  },
  { timestamps: true }
);

TrackingDeviceSchema.index(
  { partnerId: 1, trackingIntegrationId: 1, externalDeviceId: 1 },
  { unique: true }
);

export type TrackingDeviceDoc = mongoose.InferSchemaType<typeof TrackingDeviceSchema>;

export const TrackingDeviceModel =
  (mongoose.models.TrackingDevice as mongoose.Model<TrackingDeviceDoc> | undefined) ??
  mongoose.model<TrackingDeviceDoc>('TrackingDevice', TrackingDeviceSchema);
