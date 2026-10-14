import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pg_trgm } from '@electric-sql/pglite/contrib/pg_trgm';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { beforeAll, describe, expect, it } from 'vitest';

const migration = (name) => readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8');

let db;
const rows = async (sql) => (await db.query(sql)).rows;

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pg_trgm, uuid_ossp } });
  await db.exec(migration('0_init'));
  await db.exec(`
    CREATE TABLE pgmigrations (id serial primary key, name text);
    INSERT INTO users (id, username, email, password_hash, role) VALUES
      ('00000000-0000-0000-0000-00000000000a', 'a', 'a@x.io', 'h', 'admin'),
      ('00000000-0000-0000-0000-00000000000b', 'b', 'b@x.io', 'h', NULL);
    INSERT INTO media (id, title, url, format, status, metadata, created_at) VALUES
      ('00000000-0000-0000-0000-0000000000a1', 'keep', 'https://y/1', 'mp3', 'completed', '{"raw":{"id":"vid1"}}', now()),
      ('00000000-0000-0000-0000-0000000000a2', 'dup', 'https://y/1', 'mp3', 'completed', NULL, now() - interval '1 day'),
      ('00000000-0000-0000-0000-0000000000a3', 'other', 'https://y/2', 'mp3', 'bogus', NULL, now());
    INSERT INTO likes (user_id, media_id) VALUES
      ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1'),
      ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2'),
      ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000a2');
    INSERT INTO user_history (user_id, media_id, watch_time, played_at) VALUES
      ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 10, now() - interval '1 day'),
      ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 50, now()),
      ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 5, now());
    INSERT INTO playlists (id, name, created_by) VALUES ('00000000-0000-0000-0000-0000000000c1', 'pl', '00000000-0000-0000-0000-00000000000a');
    INSERT INTO playlist_tracks (playlist_id, media_id, position) VALUES
      ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a2', 1);
    INSERT INTO download_tasks (url, status, media_id) VALUES ('https://y/1', 'processing', '00000000-0000-0000-0000-0000000000a2');
    INSERT INTO global_settings (setting_key, setting_value, data_type) VALUES
      ('max_downloads_per_user_per_day', '42', 'number'),
      ('allowed_domains', '["youtube.com"]', 'json'),
      ('registration_enabled', 'false', 'boolean');
  `);
  await db.exec(migration('1_prisma_upgrade'));
});

describe('1_prisma_upgrade', () => {
  it('keeps the richest duplicate media row and backfills source ids', async () => {
    expect(await rows(`SELECT title, source_id, status::text FROM media ORDER BY title`)).toEqual([
      { title: 'keep', source_id: 'vid1', status: 'completed' },
      { title: 'other', source_id: null, status: 'pending' },
    ]);
  });

  it('moves likes and playlist tracks onto the kept media without duplicates', async () => {
    expect(await rows(`SELECT count(*)::int AS n FROM likes`)).toEqual([{ n: 2 }]);
    expect(await rows(`SELECT media_id FROM playlist_tracks`)).toEqual([{ media_id: '00000000-0000-0000-0000-0000000000a1' }]);
  });

  it('rolls history up into one row per user and track', async () => {
    expect(await rows(`SELECT play_count, watch_time FROM user_history`)).toEqual([{ play_count: 3, watch_time: 50 }]);
    expect(await rows(`SELECT play_count FROM media WHERE title = 'keep'`)).toEqual([{ play_count: 3 }]);
  });

  it('converts statuses and roles to enums with safe fallbacks', async () => {
    expect(await rows(`SELECT status::text FROM download_tasks`)).toEqual([{ status: 'queued' }]);
    expect(await rows(`SELECT role::text FROM users ORDER BY username`)).toEqual([{ role: 'admin' }, { role: 'user' }]);
  });

  it('migrates typed settings into jsonb', async () => {
    const settings = Object.fromEntries((await rows(`SELECT key, value FROM settings`)).map((r) => [r.key, r.value]));
    expect(settings).toEqual({
      'downloads.max_per_user_per_day': 42,
      'downloads.allowed_domains': ['youtube.com'],
      'auth.registration_enabled': false,
    });
  });

  it('drops the legacy migration table', async () => {
    expect(await rows(`SELECT to_regclass('pgmigrations') AS t`)).toEqual([{ t: null }]);
  });
});
