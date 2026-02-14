import { ENV } from '../env.js';
import { TraccarClient } from '../services/traccar/TraccarClient.js';
import { startDeviceHealthMonitorJob } from './deviceHealthMonitorJob.js';
import { startTraccarSyncJob } from './traccarSyncJob.js';
import { startWialonPollerJob } from './wialonPollerJob.js';

export function startBackgroundJobs(input: {
  app: {
    log: { info: (...args: any[]) => void; error: (...args: any[]) => void };
    graphql: { pubsub: { publish: (args: any) => Promise<void> | void } };
  };
  traccarClient: TraccarClient;
}): void {
  startTraccarSyncJob({
    app: input.app,
    traccarClient: input.traccarClient,
    intervalSeconds: ENV.backgroundJobs.traccarSyncIntervalSeconds
  });

  startWialonPollerJob({
    app: input.app,
    intervalSeconds: ENV.backgroundJobs.wialonPollIntervalSeconds
  });

  startDeviceHealthMonitorJob({
    app: input.app,
    intervalSeconds: Math.max(30, ENV.backgroundJobs.traccarSyncIntervalSeconds)
  });
}
