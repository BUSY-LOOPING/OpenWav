import { startTracing } from '@openwav/shared/tracing';

startTracing('scheduler');

const { prisma } = await import('@openwav/db');
const { EXCHANGE, QUEUES, assertTopology, publishJson } = await import('@openwav/shared');
const { createLogger } = await import('@openwav/shared/logger');
const { counter, histogram, initMetrics, startMetricsServer } = await import('@openwav/shared/metrics');
const { default: amqplib } = await import('amqplib');
const { Kafka, logLevel } = await import('kafkajs');
const cron = await import('node-cron');
const { createSchedulerJobs } = await import('./jobs.js');

const logger = createLogger('scheduler');
initMetrics('scheduler');
const runs = counter('scheduler_job_runs_total', 'Scheduler job runs', ['job', 'outcome']);
const runTime = histogram('scheduler_job_duration_seconds', 'Scheduler job duration', ['job']);

const conn = await amqplib.connect(process.env.RABBITMQ_URL ?? 'amqp://guest:guest@localhost:5672');
const channel = await conn.createConfirmChannel();
await assertTopology(channel);
conn.on('close', () => {
  logger.error('rabbitmq closed, exiting for restart');
  process.exit(1);
});

const kafkaAdmin = new Kafka({ clientId: 'scheduler', brokers: (process.env.KAFKA_BROKERS ?? 'localhost:19092').split(','), logLevel: logLevel.WARN }).admin();
await kafkaAdmin.connect().catch((err) => logger.warn({ err: err.message }, 'kafka admin unavailable'));

const jobs = createSchedulerJobs({
  prisma,
  kafkaAdmin,
  scraperUrl: process.env.SCRAPER_URL ?? 'http://localhost:8100',
  publishDownload: (job) => publishJson(channel, EXCHANGE, QUEUES.download, job),
  publishPlaylist: (job) => publishJson(channel, EXCHANGE, QUEUES.playlist, job),
});

startMetricsServer(Number(process.env.METRICS_PORT) || 9465, async () => true);

const schedule = {
  recoverStale: '*/5 * * * *',
  syncEventRetention: '*/10 * * * *',
  discover: '* * * * *',
  enrichArtists: '*/5 * * * *',
  pruneTokens: '17 3 * * *',
  pruneTasks: '43 3 * * *',
};

for (const [name, expression] of Object.entries(schedule)) {
  cron.schedule(expression, async () => {
    const end = runTime.startTimer({ job: name });
    try {
      const result = await jobs[name]();
      runs.inc({ job: name, outcome: 'ok' });
      logger.info({ job: name, result }, 'job finished');
    } catch (err) {
      runs.inc({ job: name, outcome: 'error' });
      logger.error({ job: name, err }, 'job failed');
    } finally {
      end();
    }
  }, { noOverlap: true });
}

logger.info({ schedule }, 'scheduler started');

const shutdown = async () => {
  await Promise.allSettled([kafkaAdmin.disconnect(), channel.close(), prisma.$disconnect()]);
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
