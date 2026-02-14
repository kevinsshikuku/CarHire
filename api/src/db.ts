import mongoose from 'mongoose';
import { ENV } from './env.js';

export async function connectMongo(): Promise<void> {
  mongoose.set('strictQuery', true);
  await mongoose.connect(ENV.mongodbUri);
}

export async function disconnectMongo(): Promise<void> {
  await mongoose.disconnect();
}

