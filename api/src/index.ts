import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import mercurius from 'mercurius';
import { getAuthUserFromAuthorizationHeader } from './auth/auth.js';
import { connectMongo, disconnectMongo } from './db.js';
import { ENV } from './env.js';
import { typeDefs } from './graphql/schema.js';
import { buildResolvers } from './graphql/resolvers.js';
import { startBackgroundJobs } from './jobs/startBackgroundJobs.js';
import { TraccarClient } from './services/traccar/TraccarClient.js';

async function main() {
  await connectMongo();

  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: ENV.corsOrigin === '*' ? true : ENV.corsOrigin.split(',').map((s) => s.trim()),
    credentials: true
  });

  await app.register(websocket);

  const traccarClient = new TraccarClient({
    baseUrl: ENV.traccar.baseUrl,
    username: ENV.traccar.username,
    password: ENV.traccar.password
  });

  await app.register(mercurius as any, {
    schema: typeDefs,
    resolvers: buildResolvers({ traccarClient }) as any,
    subscription: {
      onConnect: async (data: any) => {
        const authHeader = data?.connectionParams?.authorization;
        const authUser = getAuthUserFromAuthorizationHeader(authHeader);
        return { authUser, traccarClient, pubsub: (app as any).graphql.pubsub };
      }
    },
    context: (request: any) => {
      const authUser = getAuthUserFromAuthorizationHeader(request.headers.authorization);
      return { authUser, traccarClient, pubsub: (app as any).graphql.pubsub };
    },
    graphiql: ENV.nodeEnv !== 'production'
  });

  app.get('/healthz', async () => ({ ok: true, time: new Date().toISOString() }));

  if (ENV.backgroundJobs.enabled) {
    startBackgroundJobs({ app, traccarClient });
  }

  const close = async () => {
    app.log.info('Shutting down...');
    await app.close();
    await disconnectMongo();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);

  await app.listen({ port: ENV.port, host: '0.0.0.0' });
  app.log.info(`API ready on port ${ENV.port}`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
