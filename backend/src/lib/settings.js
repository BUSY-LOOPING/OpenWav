import { DEFAULT_SETTINGS } from '@openwav/shared';
import { badRequest } from './errors.js';

const typeOf = (value) => (Array.isArray(value) ? 'array' : typeof value);

export function createSettings(prisma, ttlMs = 10_000) {
  let cache = null;
  let loadedAt = 0;

  async function all() {
    if (cache && Date.now() - loadedAt < ttlMs) return cache;
    const rows = await prisma.setting.findMany();
    cache = { ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.filter((r) => r.key in DEFAULT_SETTINGS).map((r) => [r.key, r.value])) };
    loadedAt = Date.now();
    return cache;
  }

  async function update(values, userId) {
    for (const [key, value] of Object.entries(values)) {
      if (!(key in DEFAULT_SETTINGS)) throw badRequest(`Unknown setting ${key}`);
      if (typeOf(value) !== typeOf(DEFAULT_SETTINGS[key])) throw badRequest(`Setting ${key} must be ${typeOf(DEFAULT_SETTINGS[key])}`);
    }
    await prisma.$transaction(
      Object.entries(values).map(([key, value]) =>
        prisma.setting.upsert({ where: { key }, create: { key, value, updatedBy: userId }, update: { value, updatedBy: userId } }),
      ),
    );
    cache = null;
    return all();
  }

  return { all, get: async (key) => (await all())[key], update, invalidate: () => (cache = null) };
}
