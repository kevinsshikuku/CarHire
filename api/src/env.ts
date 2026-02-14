import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGIN: z.string().default('*'),

  MONGODB_URI: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL_SECONDS: z.coerce.number().int().positive().default(60 * 60 * 24 * 30),

  ENCRYPTION_KEY_BASE64: z.string().min(1),

  TRACKING_HISTORY_TTL_DAYS: z.coerce.number().int().positive().default(7),
  TRACKER_OFFLINE_AFTER_SECONDS: z.coerce.number().int().positive().default(180),

  TRACCAR_BASE_URL: z.string().url(),
  TRACCAR_USERNAME: z.string().min(1),
  TRACCAR_PASSWORD: z.string().min(1),
  TRACCAR_FORWARD_HOST: z.string().min(1),
  TRACCAR_WIALON_IPS_PORT: z.coerce.number().int().positive().default(5003),

  ENABLE_BACKGROUND_JOBS: z
    .string()
    .default('false')
    .transform((v) => v.toLowerCase() === 'true'),
  TRACCAR_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(5),
  WIALON_POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(15)
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const encryptionKey = Buffer.from(parsed.data.ENCRYPTION_KEY_BASE64, 'base64');
if (encryptionKey.length !== 32) {
  // eslint-disable-next-line no-console
  console.error('ENCRYPTION_KEY_BASE64 must decode to 32 bytes');
  process.exit(1);
}

export const ENV = {
  port: parsed.data.PORT,
  nodeEnv: parsed.data.NODE_ENV,
  corsOrigin: parsed.data.CORS_ORIGIN,

  mongodbUri: parsed.data.MONGODB_URI,

  jwtAccessSecret: parsed.data.JWT_ACCESS_SECRET,
  jwtRefreshSecret: parsed.data.JWT_REFRESH_SECRET,
  jwtAccessTtlSeconds: parsed.data.JWT_ACCESS_TTL_SECONDS,
  jwtRefreshTtlSeconds: parsed.data.JWT_REFRESH_TTL_SECONDS,

  encryptionKey,

  trackingHistoryTtlDays: parsed.data.TRACKING_HISTORY_TTL_DAYS,
  trackerOfflineAfterSeconds: parsed.data.TRACKER_OFFLINE_AFTER_SECONDS,

  traccar: {
    baseUrl: parsed.data.TRACCAR_BASE_URL.replace(/\/$/, ''),
    username: parsed.data.TRACCAR_USERNAME,
    password: parsed.data.TRACCAR_PASSWORD,
    forwardHost: parsed.data.TRACCAR_FORWARD_HOST,
    wialonIpsPort: parsed.data.TRACCAR_WIALON_IPS_PORT
  },

  backgroundJobs: {
    enabled: parsed.data.ENABLE_BACKGROUND_JOBS,
    traccarSyncIntervalSeconds: parsed.data.TRACCAR_SYNC_INTERVAL_SECONDS,
    wialonPollIntervalSeconds: parsed.data.WIALON_POLL_INTERVAL_SECONDS
  }
} as const;

