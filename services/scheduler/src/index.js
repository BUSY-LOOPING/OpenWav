import cron from 'node-cron'
import { cleanupStaleDownloads } from './jobs/cleanupStale.js';
import { purgeTempFiles } from './jobs/purgeTemp.js';
import { logger} from './utils/logger.js'

logger.info('Scheduler starting...');


cron.schedule('*/10 * * * *', async () => {
  logger.info('[CRON] Running cleanupStaleDownloads');
  try {
    await cleanupStaleDownloads();
  } catch (err) {
    logger.logError('[CRON] cleanupStaleDownloads failed:', err.message);
  }
});

cron.schedule('0 3 * * *', async () => {
  logger.info('[cron] Running purgeTempFiles');
  try {
    await purgeTempFiles();
  } catch (err) {
    logger.logError('[cron] purgeTempFiles failed:', err.message);
  }
});

logger.info('Scheduler running. Waiting for cron triggers...');