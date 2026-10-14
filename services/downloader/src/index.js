import { startTracing } from '@openwav/shared/tracing';

startTracing('downloader');

const fs = await import('node:fs/promises');
const { prisma } = await import('@openwav/db');
const { CANCEL_CHANNEL, EXCHANGE, PROGRESS_CHANNEL, QUEUES, RETRY_EXCHANGE, assertTopology, buildProgressEvent, downloadJobSchema, playlistJobSchema, publishJson } = await import('@openwav/shared');
const { createLogger } = await import('@openwav/shared/logger');
const { initMetrics, startMetricsServer } = await import('@openwav/shared/metrics');
const { default: amqplib } = await import('amqplib');
const { Redis } = await import('ioredis');
const { createJobs } = await import('./jobs.js');
const { createStorage } = await import('./storage.js');
const { createYtdlp } = await import('./ytdlp.js');

const logger = createLogger('downloader');
initMetrics('downloader');
const tempDir = process.env.TEMP_DOWNLOAD_PATH ?? '/app/temp';
const concurrency = Number(process.env.CONCURRENT_DOWNLOADS) || 3;
await fs.mkdir(tempDir, { recursive: true });
for (const name of await fs.readdir(tempDir)) await fs.rm(`${tempDir}/${name}`, { force: true, recursive: true });

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
const storage = createStorage();
await storage.ensureBuckets();

let channel = null;
let draining = false;
const ready = () => !!channel && !draining;
startMetricsServer(Number(process.env.METRICS_PORT) || 9464, async () => ready() && (await redis.ping()) === 'PONG');

let cookieCache = { at: 0, value: null };
const cookies = async () => {
  if (Date.now() - cookieCache.at > 30_000) {
    const row = await prisma.setting.findUnique({ where: { key: 'ytdlp.cookies' } });
    cookieCache = { at: Date.now(), value: row?.value?.content ?? null };
  }
  return cookieCache.value;
};

const jobs = createJobs({
  prisma,
  ytdlp: createYtdlp({ logger, cookies, tempDir }),
  storage,
  tempDir,
  logger,
  emit: (event) => redis.publish(PROGRESS_CHANNEL, JSON.stringify(buildProgressEvent(event))).catch(() => {}),
  publishDownload: (job) => publishJson(channel, EXCHANGE, QUEUES.download, job),
  publishRetry: (job, delayMs) => publishJson(channel, RETRY_EXCHANGE, QUEUES.download, job, { expiration: String(delayMs) }),
});

await subscriber.subscribe(CANCEL_CHANNEL);
subscriber.on('message', (_c, taskId) => jobs.cancel(taskId));

function consume(ch, queue, schema, handler) {
  return ch.consume(queue, async (msg) => {
    if (!msg) return;
    let job;
    try {
      job = schema.parse(JSON.parse(msg.content.toString()));
    } catch (err) {
      logger.error({ err: err.message, queue }, 'invalid job, dead-lettering');
      return ch.nack(msg, false, false);
    }
    try {
      await handler(job);
      ch.ack(msg);
    } catch (err) {
      logger.error({ err, queue }, 'job crashed, requeueing');
      ch.nack(msg, false, !msg.fields.redelivered);
    }
  });
}

const tags = [];
async function connect(attempt = 0) {
  try {
    const conn = await amqplib.connect(process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672');
    const ch = await conn.createConfirmChannel();
    await assertTopology(ch);
    await ch.prefetch(concurrency);
    channel = ch;
    tags.length = 0;
    tags.push((await consume(ch, QUEUES.download, downloadJobSchema, jobs.download)).consumerTag);
    tags.push((await consume(ch, QUEUES.playlist, playlistJobSchema, jobs.playlist)).consumerTag);
    conn.on('error', (err) => logger.error({ err }, 'rabbitmq error'));
    conn.on('close', () => {
      channel = null;
      if (!draining) setTimeout(() => connect(), 2000);
    });
    logger.info({ concurrency }, 'downloader consuming');
  } catch (err) {
    logger.warn({ err: err.message, attempt }, 'rabbitmq connect failed');
    setTimeout(() => connect(attempt + 1), Math.min(30_000, 1000 * 2 ** attempt));
  }
}
await connect();

async function shutdown(signal) {
  if (draining) return;
  draining = true;
  logger.info({ signal, running: jobs.running() }, 'draining');
  await Promise.allSettled(tags.map((t) => channel?.cancel(t)));
  const deadline = Date.now() + 120_000;
  while (jobs.running() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 500));
  await Promise.allSettled([channel?.close(), redis.quit(), subscriber.quit(), prisma.$disconnect()]);
  process.exit(0);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
