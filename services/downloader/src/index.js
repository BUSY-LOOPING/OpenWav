import { connectRabbit, QUEUE_DOWNLOAD } from './rabbit.js';
import { processDownloadJob } from './worker.js';
import { logger } from './utils/logger.js';
import fs from 'fs/promises';


const TEMP_DIR = process.env.TEMP_DOWNLOAD_PATH || '/app/temp';

async function main() {
  logger.startup();

  await fs.mkdir(TEMP_DIR, { recursive: true });

  const channel = await connectRabbit();

  logger.rabbit(`Consuming queue: ${QUEUE_DOWNLOAD}`);

  channel.consume(QUEUE_DOWNLOAD, (msg) => {
    if (!msg) return;
    processDownloadJob(msg, channel);
  });
}

main().catch((err) => {
  logger.logError(err, { context: 'startup' });
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.shutdown();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.shutdown();
  process.exit(0);
});