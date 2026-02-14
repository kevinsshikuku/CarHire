import { ENV } from '../env.js';
import { TrackingDeviceHealthStatus, TrackingDeviceModel } from '../models/TrackingDevice.js';

function deviceHealthTopicForPartner(partnerId: string): string {
  return `trackingDeviceHealthUpdated:${partnerId}`;
}

export function startDeviceHealthMonitorJob(input: {
  app: {
    log: { info: (...args: any[]) => void; error: (...args: any[]) => void };
    graphql: { pubsub: { publish: (args: any) => Promise<void> | void } };
  };
  intervalSeconds: number;
}): void {
  const { app, intervalSeconds } = input;
  app.log.info({ intervalSeconds }, 'Starting device health monitor job');

  const tick = async () => {
    const now = Date.now();
    const offlineCutoff = new Date(now - ENV.trackerOfflineAfterSeconds * 1000);

    const candidates = await TrackingDeviceModel.find({
      lastSeenAt: { $ne: null, $lt: offlineCutoff },
      healthStatus: TrackingDeviceHealthStatus.ONLINE
    }).lean();

    for (const device of candidates) {
      await TrackingDeviceModel.updateOne(
        { _id: device._id, healthStatus: TrackingDeviceHealthStatus.ONLINE },
        { $set: { healthStatus: TrackingDeviceHealthStatus.OFFLINE } }
      );

      const updated = await TrackingDeviceModel.findById(device._id).lean();
      if (!updated) continue;

      const partnerId = updated.partnerId.toString();
      await app.graphql.pubsub.publish({
        topic: deviceHealthTopicForPartner(partnerId),
        payload: { trackingDeviceHealthUpdated: updated }
      });
    }
  };

  void tick();
  setInterval(() => void tick(), intervalSeconds * 1000);
}
