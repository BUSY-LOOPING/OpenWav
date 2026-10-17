import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  KAFKA_BROKERS: z.string().default('localhost:19092'),
  S3_ENDPOINT: z.string().default('http://localhost:9000'),
  S3_REGION: z.string().default('us-east-1'),
  S3_ACCESS_KEY: z.string().default('rustfsadmin'),
  S3_SECRET_KEY: z.string().default('rustfsadmin'),
  S3_BUCKET_AUDIO: z.string().default('audio'),
  S3_BUCKET_COVERS: z.string().default('covers'),
  PUBLIC_BASE_URL: z.string().url().default('https://localhost:8443'),
  STREAM_SIGNING_SECRET: z.string().min(16),
  STREAM_URL_TTL_SEC: z.coerce.number().int().positive().default(6 * 3600),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  SCRAPER_URL: z.string().default('http://localhost:8100'),
  RECOMMENDER_URL: z.string().default('http://localhost:8000'),
  PROMETHEUS_URL: z.string().default('http://localhost:9090'),
  ALERTMANAGER_URL: z.string().default('http://localhost:9093'),
  GRAFANA_URL: z.string().default('http://localhost:3001'),
  RABBITMQ_UI_URL: z.string().default('http://localhost:15672'),
  OPS_GRAFANA_URL: z.string().default('http://127.0.0.1:3001'),
  OPS_PROMETHEUS_URL: z.string().default('http://127.0.0.1:9090'),
  OPS_ALERTMANAGER_URL: z.string().default('http://127.0.0.1:9093'),
  OPS_RABBITMQ_URL: z.string().default('http://127.0.0.1:15672'),
  OPS_PRISMA_STUDIO_URL: z.string().default('http://127.0.0.1:5555'),
  PRISMA_STUDIO_URL: z.string().optional(),
  CORS_ORIGINS: z.string().default('https://localhost:8443,http://localhost:6330'),
  TRUST_PROXY: z.coerce.number().int().default(1),
});

export function loadConfig(env = process.env) {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  return { ...parsed.data, corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean) };
}
