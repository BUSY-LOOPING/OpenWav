import { startTracing } from '@openwav/shared/tracing';

startTracing('backend');

const { S3Client } = await import('@aws-sdk/client-s3');
const { prisma } = await import('@openwav/db');
const { assertTopology } = await import('@openwav/shared');
const { createLogger } = await import('@openwav/shared/logger');
const { initMetrics } = await import('@openwav/shared/metrics');
const { default: amqplib } = await import('amqplib');
const { Redis } = await import('ioredis');
const { Kafka, logLevel } = await import('kafkajs');
const { createApp } = await import('./app.js');
const { loadConfig } = await import('./config.js');
const { createLyrics, createMonitoring, createRecommender, createScraper } = await import('./services/external.js');

const config = loadConfig();
const logger = createLogger('backend');
initMetrics('backend');

const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 2 });
const subscriber = new Redis(config.REDIS_URL);
redis.on('error', (err) => logger.error({ err }, 'redis error'));
subscriber.on('error', (err) => logger.error({ err }, 'redis subscriber error'));

let channel = null;
async function connectRabbit(attempt = 0) {
  try {
    const conn = await amqplib.connect(config.RABBITMQ_URL);
    const ch = await conn.createConfirmChannel();
    await assertTopology(ch);
    conn.on('close', () => {
      channel = null;
      logger.warn('rabbitmq closed, reconnecting');
      setTimeout(() => connectRabbit(), 2000);
    });
    conn.on('error', (err) => logger.error({ err }, 'rabbitmq error'));
    channel = ch;
    logger.info('rabbitmq connected');
  } catch (err) {
    logger.warn({ err: err.message, attempt }, 'rabbitmq connect failed');
    setTimeout(() => connectRabbit(attempt + 1), Math.min(30_000, 1000 * 2 ** attempt));
  }
}

const kafka = new Kafka({ clientId: 'backend', brokers: config.KAFKA_BROKERS.split(','), logLevel: logLevel.WARN });
const producer = kafka.producer({ allowAutoTopicCreation: false, idempotent: true, maxInFlightRequests: 1 });
let producerReady = false;
producer.on(producer.events.CONNECT, () => (producerReady = true));
producer.on(producer.events.DISCONNECT, () => (producerReady = false));
producer.connect().catch((err) => logger.warn({ err: err.message }, 'kafka connect failed'));

const storage = new S3Client({
  endpoint: config.S3_ENDPOINT,
  region: config.S3_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY },
});

await connectRabbit();

const { app } = createApp({
  prisma,
  redis,
  subscriber,
  channel: () => channel,
  producer,
  producerReady: () => producerReady,
  storage,
  config,
  logger,
  scraper: createScraper({ baseUrl: config.SCRAPER_URL, redis }),
  recommender: createRecommender({ baseUrl: config.RECOMMENDER_URL }),
  lyrics: createLyrics({ redis }),
  monitoring: createMonitoring({ prometheusUrl: config.PROMETHEUS_URL, alertmanagerUrl: config.ALERTMANAGER_URL }),
});

const server = app.listen(config.PORT, () => logger.info({ port: config.PORT }, 'backend listening'));
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;

let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  logger.info({ signal }, 'shutting down');
  server.close();
  await Promise.allSettled([producer.disconnect(), redis.quit(), subscriber.quit(), prisma.$disconnect(), channel?.close()]);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('unhandledRejection', (err) => logger.error({ err }, 'unhandled rejection'));
