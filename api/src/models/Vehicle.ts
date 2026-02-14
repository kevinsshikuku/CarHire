import mongoose, { Schema } from 'mongoose';

const VehicleSchema = new Schema(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    title: { type: String, required: true }
  },
  { timestamps: true }
);

export type VehicleDoc = mongoose.InferSchemaType<typeof VehicleSchema>;

export const VehicleModel =
  (mongoose.models.Vehicle as mongoose.Model<VehicleDoc> | undefined) ??
  mongoose.model<VehicleDoc>('Vehicle', VehicleSchema);
