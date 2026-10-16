import bcrypt from 'bcryptjs';
import { createPrisma } from '@openwav/db';
import { createLogger } from '@openwav/shared/logger';
import supertest from 'supertest';
import { inject } from 'vitest';
import { createApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

export const config = loadConfig({
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://unused',
  STREAM_SIGNING_SECRET: 'stream-secret-for-tests',
  JWT_SECRET: 'j'.repeat(40),
  JWT_REFRESH_SECRET: 'r'.repeat(40),
  BCRYPT_ROUNDS: '4',
  PUBLIC_BASE_URL: 'https://music.test',
});

export const prisma = createPrisma(inject('databaseUrl'));
const logger = createLogger('test');
logger.level = 'silent';

export function fakeRedis() {
  const store = new Map();
  return {
    published: [],
    get: async (k) => store.get(k) ?? null,
    set: async (k, v) => store.set(k, v),
    publish: async (channel, message) => fakeRedis.last.published.push([channel, message]),
    ping: async () => 'PONG',
  };
}

export function fakeChannel() {
  const channel = {
    messages: [],
    fail: false,
    publish(exchange, routingKey, buffer, _opts, cb) {
      if (channel.fail) return cb(new Error('broker down'));
      channel.messages.push({ exchange, routingKey, body: JSON.parse(buffer.toString()) });
      cb(null);
      return true;
    },
  };
  return channel;
}

export function buildApp(overrides = {}) {
  const redis = fakeRedis();
  fakeRedis.last = redis;
  const channel = fakeChannel();
  const producer = { sent: [], send: async (batch) => producer.sent.push(batch) };
  const external = {
    prisma,
    config,
    logger,
    redis,
    subscriber: null,
    channel: () => channel,
    producer,
    producerReady: () => true,
    storage: { sent: [], send: async (cmd) => external.storage.sent.push(cmd) },
    scraper: { search: async () => [], related: async () => [], suggestions: async () => [], health: async () => ({}) },
    recommender: { forUser: async () => [], similar: async () => [], retrain: async () => ({}), insights: async () => ({ status: { state: 'idle' } }), health: async () => ({}) },
    lyrics: { find: async () => ({ plain: 'la la', synced: null }) },
    monitoring: { latency: async () => ({ p95Ms: 120, p99Ms: 400, errorRate: 0 }), alerts: async () => [] },
    ...overrides,
  };
  const { app, deps } = createApp(external);
  return { app, deps, request: supertest(app), redis, channel, producer, external };
}

export async function resetDb() {
  await prisma.$executeRawUnsafe(`TRUNCATE users, media, artists, albums, playlists, settings, download_tasks, playlist_tasks CASCADE`);
}

let counter = 0;
export async function createUser({ role = 'user', password = 'secret123', isActive = true } = {}) {
  counter += 1;
  const user = await prisma.user.create({
    data: { username: `user${counter}`, email: `user${counter}@test.io`, passwordHash: await bcrypt.hash(password, 4), role, isActive },
  });
  return user;
}

export function bearer(deps, user) {
  return { Authorization: `Bearer ${deps.tokens.signAccess(user)}` };
}

export async function createTrack(data = {}) {
  counter += 1;
  return prisma.media.create({
    data: {
      title: `Song ${counter}`,
      url: `https://www.youtube.com/watch?v=vid${counter}`,
      sourceId: `vid${counter}`,
      format: 'mp3',
      status: 'completed',
      duration: 200,
      filePath: `audio-${counter}.mp3`,
      ...data,
    },
  });
}
