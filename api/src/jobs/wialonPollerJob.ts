import { ENV } from '../env.js';
import { decryptString } from '../crypto/fieldEncryption.js';
import { EntityType } from '../models/LatestLocation.js';
import { TrackingIntegrationModel, TrackingIntegrationStatus, TrackingProviderType } from '../models/TrackingIntegration.js';
import { TrackingDeviceHealthStatus, TrackingDeviceModel } from '../models/TrackingDevice.js';
import { writeLatestAndHistory } from '../services/tracking/writeLocation.js';
import { WialonClient } from '../services/wialon/WialonClient.js';

function locationTopicForPartner(partnerId: string): string {
  return `partnerTrackingLocationUpdated:${partnerId}`;
}

function deviceHealthTopicForPartner(partnerId: string): string {
  return `trackingDeviceHealthUpdated:${partnerId}`;
}

export function startWialonPollerJob(input: {
  app: {
    log: { info: (...args: any[]) => void; error: (...args: any[]) => void };
    graphql: { pubsub: { publish: (args: any) => Promise<void> | void } };
  };
  intervalSeconds: number;
}): void {
  const { app, intervalSeconds } = input;
  app.log.info({ intervalSeconds }, 'Starting Wialon poller job');

  const tick = async () => {
    const integrations = await TrackingIntegrationModel.find({
      providerType: TrackingProviderType.WIALON_API,
      method: 'PULL',
      status: TrackingIntegrationStatus.ACTIVE
    }).lean();

    for (const integration of integrations) {
      const partnerId = integration.partnerId.toString();
      const baseUrl = integration.config?.wialon?.baseUrl ?? 'https://hst-api.wialon.com';
      const tokenEnc = integration.config?.wialon?.tokenEnc;
      if (!tokenEnc) continue;
      const token = decryptString(tokenEnc, ENV.encryptionKey);

      const client = new WialonClient({ baseUrl });

      let eid: string;
      try {
        const login = await client.tokenLogin(token);
        eid = login.eid;
      } catch (err) {
        app.log.error({ err, partnerId }, 'Wialon token login failed');
        continue;
      }

      let units = [];
      try {
        units = await client.searchUnitsWithLastPosition(eid);
      } catch (err) {
        app.log.error({ err, partnerId }, 'Wialon unit search failed');
        continue;
      }

      const unitsById = new Map<number, (typeof units)[number]>();
      for (const u of units) unitsById.set(u.id, u);

      const devices = await TrackingDeviceModel.find({ trackingIntegrationId: integration._id }).lean();

      for (const device of devices) {
        const unitId = Number(device.externalDeviceId);
        if (!Number.isFinite(unitId)) continue;
        const unit = unitsById.get(unitId);
        const pos = unit?.pos;
        if (!pos) continue;

        const fixTime = new Date(pos.t * 1000);
        const previousStatus = device.healthStatus;

        await TrackingDeviceModel.updateOne(
          { _id: device._id },
          {
            $set: {
              lastSeenAt: fixTime,
              lastLocation: {
                lat: pos.y,
                lng: pos.x,
                heading: pos.c ?? null,
                speed: pos.s ?? null,
                timestamp: fixTime,
                source: 'WIALON_API'
              },
              healthStatus: TrackingDeviceHealthStatus.ONLINE
            }
          }
        );

        if (device.vehicleId) {
          const written = await writeLatestAndHistory({
            entityType: EntityType.VEHICLE,
            entityId: device.vehicleId.toString(),
            lat: pos.y,
            lng: pos.x,
            heading: pos.c ?? null,
            speed: pos.s ?? null,
            accuracy: null,
            timestamp: fixTime,
            source: 'WIALON_API',
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
    }
  };

  void tick();
  setInterval(() => void tick(), intervalSeconds * 1000);
}
