import pg from 'pg';

export const pool = new pg.Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  import('./logger.js').then(({ logger }) => {
    logger.logError(err, { context: 'pg pool idle error' });
  });
});