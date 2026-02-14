import mongoose, { Schema } from 'mongoose';

const PartnerSchema = new Schema(
  {
    name: { type: String, required: true },
    verified: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

export type PartnerDoc = mongoose.InferSchemaType<typeof PartnerSchema>;

export const PartnerModel =
  (mongoose.models.Partner as mongoose.Model<PartnerDoc> | undefined) ??
  mongoose.model<PartnerDoc>('Partner', PartnerSchema);
