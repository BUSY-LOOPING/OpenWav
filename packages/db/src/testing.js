import { readdirSync, readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const migrations = new URL('../prisma/migrations/', import.meta.url);

export async function startTestDatabase() {
  const db = await PGlite.create({ extensions: { pg_trgm, uuid_ossp } });
  for (const dir of readdirSync(migrations, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()) {
    await db.exec(readFileSync(new URL(`${dir}/migration.sql`, migrations), 'utf8'));
  }
  const port = 55000 + Math.floor(Math.random() * 9000);
  const server = new PGLiteSocketServer({ db, port, host: '127.0.0.1', maxConnections: 50 });
  await server.start();
  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable`,
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}

export function vitestGlobalSetup() {
  return async ({ provide }) => {
    const { url, stop } = await startTestDatabase();
    provide('databaseUrl', url);
    return stop;
  };
}
