import { connectMongo } from '../db.js';
import { ENV } from '../env.js';
import { startWialonPollerJob } from '../jobs/wialonPollerJob.js';

async function main() {
  await connectMongo();

  const appLike = {
    log: console,
    graphql: { pubsub: { publish: async () => undefined } }
  };

  startWialonPollerJob({
    app: appLike,
    intervalSeconds: ENV.backgroundJobs.wialonPollIntervalSeconds
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
