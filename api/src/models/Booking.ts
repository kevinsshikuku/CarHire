import mongoose, { Schema } from 'mongoose';

export enum BookingStatus {
  REQUESTED = 'REQUESTED',
  ACCEPTED = 'ACCEPTED',
  PAYMENT_PENDING = 'PAYMENT_PENDING',
  CONFIRMED = 'CONFIRMED',
  ON_HIRE = 'ON_HIRE',
  RETURNED = 'RETURNED',
  CLOSED = 'CLOSED',
  DECLINED = 'DECLINED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED'
}

const BookingSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'Partner', required: true, index: true },
    status: { type: String, enum: Object.values(BookingStatus), required: true, default: BookingStatus.REQUESTED },
    deliveryTrackingEnabled: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

export type BookingDoc = mongoose.InferSchemaType<typeof BookingSchema>;

export const BookingModel =
  (mongoose.models.Booking as mongoose.Model<BookingDoc> | undefined) ??
  mongoose.model<BookingDoc>('Booking', BookingSchema);
