import mongoose, { Schema } from 'mongoose';
import { EncryptedSecret } from '../crypto/fieldEncryption.js';

export enum TrackingProviderType {
  WIALON = 'WIALON',
  TRACCAR_DIRECT = 'TRACCAR_DIRECT',
  PHONE = 'PHONE',
  WIALON_API = 'WIALON_API'
}

export enum TrackingMethod {
  FORWARD = 'FORWARD',
  PULL = 'PULL'
}

export enum TrackingIntegrationStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  ERROR = 'ERROR'
}

const EncryptedSecretSchema = new Schema<EncryptedSecret>(
  {
    ciphertextB64: { type: String, required: true },
    ivB64: { type: String, required: true },
    tagB64: { type: String, required: true }
  },
  { _id: false }
);

const TrackingIntegrationSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    providerType: { type: String, enum: Object.values(TrackingProviderType), required: true },
    method: { type: String, enum: Object.values(TrackingMethod), required: true },
    status: { type: String, enum: Object.values(TrackingIntegrationStatus), required: true, default: TrackingIntegrationStatus.ACTIVE },
    authorizationAcceptedAt: { type: Date, required: true },
    config: {
      wialon: {
        baseUrl: { type: String },
        tokenEnc: { type: EncryptedSecretSchema },
        pollingIntervalSeconds: { type: Number }
      },
      ipAllowlist: { type: [String], default: [] }
    },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export type TrackingIntegrationDoc = mongoose.InferSchemaType<typeof TrackingIntegrationSchema>;

export const TrackingIntegrationModel =
  (mongoose.models.TrackingIntegration as mongoose.Model<TrackingIntegrationDoc> | undefined) ??
  mongoose.model<TrackingIntegrationDoc>('TrackingIntegration', TrackingIntegrationSchema);
