import { connectMongo } from '../db.js';
import { ENV } from '../env.js';
import { startTraccarSyncJob } from '../jobs/traccarSyncJob.js';
import { TraccarClient } from '../services/traccar/TraccarClient.js';

async function main() {
  await connectMongo();

  const traccarClient = new TraccarClient({
    baseUrl: ENV.traccar.baseUrl,
    username: ENV.traccar.username,
    password: ENV.traccar.password
  });

  const appLike = {
    log: console,
    graphql: { pubsub: { publish: async () => undefined } }
  };

  startTraccarSyncJob({
    app: appLike,
    traccarClient,
    intervalSeconds: ENV.backgroundJobs.traccarSyncIntervalSeconds
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
