import { AuditLogModel } from '../models/AuditLog.js';
import { EntityType } from '../models/LatestLocation.js';
import { SyncStateModel } from '../models/SyncState.js';
import { TrackingDeviceHealthStatus, TrackingDeviceModel } from '../models/TrackingDevice.js';
import { writeLatestAndHistory } from '../services/tracking/writeLocation.js';
import { TraccarClient, TraccarPosition } from '../services/traccar/TraccarClient.js';

const SYNC_KEY = 'traccar.lastFixTimeIso';

function locationTopicForPartner(partnerId: string): string {
  return `partnerTrackingLocationUpdated:${partnerId}`;
}

function deviceHealthTopicForPartner(partnerId: string): string {
  return `trackingDeviceHealthUpdated:${partnerId}`;
}

function pickNewestFixTime(positions: TraccarPosition[]): Date | null {
  const first = positions[0];
  if (!first) return null;
  let max = new Date(first.fixTime ?? first.serverTime);
  for (const p of positions) {
    const t = new Date(p.fixTime ?? p.serverTime);
    if (t > max) max = t;
  }
  return max;
}

export function startTraccarSyncJob(input: {
  app: {
    log: { info: (...args: any[]) => void; error: (...args: any[]) => void };
    graphql: { pubsub: { publish: (args: any) => Promise<void> | void } };
  };
  traccarClient: TraccarClient;
  intervalSeconds: number;
}): void {
  const { app, traccarClient, intervalSeconds } = input;

  app.log.info({ intervalSeconds }, 'Starting Traccar sync job');

  const tick = async () => {
    const cursorDoc = await SyncStateModel.findOne({ key: SYNC_KEY }).lean();
    const now = new Date();
    const from = cursorDoc?.value ? new Date(cursorDoc.value) : new Date(now.getTime() - 5 * 60 * 1000);

    let positions: TraccarPosition[] = [];
    try {
      positions = await traccarClient.getPositions({ from, to: now });
    } catch (err) {
      app.log.error({ err }, 'Traccar sync failed');
      return;
    }

    if (positions.length === 0) return;

    const deviceIds = Array.from(new Set(positions.map((p) => p.deviceId)));
    const devices = await TrackingDeviceModel.find({ traccarDeviceId: { $in: deviceIds } }).lean();
    const byTraccarId = new Map<number, typeof devices[number]>();
    for (const d of devices) {
      if (d.traccarDeviceId != null) byTraccarId.set(d.traccarDeviceId, d);
    }

    for (const p of positions) {
      const device = byTraccarId.get(p.deviceId);
      if (!device) continue;

      const fixTime = new Date(p.fixTime ?? p.serverTime);
      const partnerId = device.partnerId.toString();

      const previousStatus = device.healthStatus;

      await TrackingDeviceModel.updateOne(
        { _id: device._id },
        {
          $set: {
            lastSeenAt: fixTime,
            lastLocation: {
              lat: p.latitude,
              lng: p.longitude,
              heading: p.course ?? null,
              speed: p.speed ?? null,
              timestamp: fixTime,
              source: 'TRACCAR'
            },
            healthStatus: TrackingDeviceHealthStatus.ONLINE
          }
        }
      );

      if (device.vehicleId) {
        const written = await writeLatestAndHistory({
          entityType: EntityType.VEHICLE,
          entityId: device.vehicleId.toString(),
          lat: p.latitude,
          lng: p.longitude,
          heading: p.course ?? null,
          speed: p.speed ?? null,
          accuracy: p.accuracy ?? null,
          timestamp: fixTime,
          source: 'TRACCAR',
          minHistoryIntervalSeconds: 3
        });

        await app.graphql.pubsub.publish({
          topic: locationTopicForPartner(partnerId),
          payload: {
            partnerTrackingLocationUpdated: {
              ...written.latest,
              receivedAt: written.latest.receivedAt
            }
          }
        });
      }

      if (previousStatus !== TrackingDeviceHealthStatus.ONLINE) {
        const updated = await TrackingDeviceModel.findById(device._id).lean();
        if (updated) {
          await app.graphql.pubsub.publish({
            topic: deviceHealthTopicForPartner(partnerId),
            payload: { trackingDeviceHealthUpdated: updated }
          });
        }
      }
    }

    const newest = pickNewestFixTime(positions);
    if (newest) {
      await SyncStateModel.updateOne(
        { key: SYNC_KEY },
        { $set: { value: newest.toISOString() } },
        { upsert: true }
      );
    }

    await AuditLogModel.create({
      actorUserId: null,
      action: 'TRACCAR_SYNC_TICK',
      data: { processedPositions: positions.length }
    }).catch(() => undefined);
  };

  // fire immediately, then interval
  void tick();
  setInterval(() => void tick(), intervalSeconds * 1000);
}
