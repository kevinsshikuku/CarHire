import 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    graphql: {
      pubsub: {
        publish: (args: any) => Promise<void>;
        subscribe: (topic: string) => AsyncIterable<unknown>;
      };
    };
  }
}

