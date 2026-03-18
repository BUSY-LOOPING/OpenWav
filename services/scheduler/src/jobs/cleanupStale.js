import pg from 'pg';
import {logger} from '../utils/logger.js'

const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

export async function cleanupStaleDownloads() {
  const result = await pool.query(`
    UPDATE downloads
    SET status = 'failed',
        error_message = 'Job timed out — marked failed by scheduler',
        updated_at = NOW()
    WHERE status = 'processing'
      AND updated_at < NOW() - INTERVAL '30 minutes'
    RETURNING id
  `);

  logger.jobResult('cleanupStale', result.rowCount);
}