import { LatestLocationModel } from '../../models/LatestLocation.js';
import { TrackingHistoryModel } from '../../models/TrackingHistory.js';
import { EntityType } from '../../models/LatestLocation.js';

export async function writeLatestAndHistory(input: {
  entityType: EntityType;
  entityId: string;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  accuracy?: number | null;
  timestamp: Date;
  source: string;
  minHistoryIntervalSeconds: number;
}): Promise<{
  latest: {
    entityType: EntityType;
    entityId: string;
    lat: number;
    lng: number;
    heading: number | null;
    speed: number | null;
    accuracy: number | null;
    timestamp: Date;
    source: string;
    receivedAt: Date;
  };
  wroteHistory: boolean;
}> {
  const receivedAt = new Date();
  const previous = await LatestLocationModel.findOne({ entityType: input.entityType, entityId: input.entityId }).lean();

  await LatestLocationModel.updateOne(
    { entityType: input.entityType, entityId: input.entityId },
    {
      $set: {
        lat: input.lat,
        lng: input.lng,
        heading: input.heading ?? null,
        speed: input.speed ?? null,
        accuracy: input.accuracy ?? null,
        timestamp: input.timestamp,
        source: input.source,
        receivedAt
      }
    },
    { upsert: true }
  );

  let wroteHistory = true;
  if (previous?.timestamp) {
    const deltaSeconds = Math.abs(input.timestamp.getTime() - new Date(previous.timestamp).getTime()) / 1000;
    if (deltaSeconds < input.minHistoryIntervalSeconds) wroteHistory = false;
  }

  if (wroteHistory) {
    await TrackingHistoryModel.create({
      entityType: input.entityType,
      entityId: input.entityId,
      lat: input.lat,
      lng: input.lng,
      heading: input.heading ?? null,
      speed: input.speed ?? null,
      accuracy: input.accuracy ?? null,
      timestamp: input.timestamp,
      source: input.source,
      receivedAt
    });
  }

  return {
    latest: {
      entityType: input.entityType,
      entityId: input.entityId,
      lat: input.lat,
      lng: input.lng,
      heading: input.heading ?? null,
      speed: input.speed ?? null,
      accuracy: input.accuracy ?? null,
      timestamp: input.timestamp,
      source: input.source,
      receivedAt
    },
    wroteHistory
  };
}

