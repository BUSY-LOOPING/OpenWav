import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { AppError } from '../lib/errors.js';

export function createRateLimiters({ redis, settings }) {
  const make = (prefix, windowMs, settingKey, keyFn) =>
    rateLimit({
      windowMs,
      limit: () => settings.get(settingKey),
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: keyFn,
      store: redis?.call ? new RedisStore({ prefix: `rl:${prefix}:`, sendCommand: (...args) => redis.call(...args) }) : undefined,
      handler: (_req, _res, next, options) => next(new AppError(options.statusCode, 'RATE_LIMITED', 'Too many requests, slow down')),
    });

  const byIp = (req) => ipKeyGenerator(req.ip ?? '');
  const byUserOrIp = (req) => req.user?.id ?? byIp(req);

  return {
    global: make('global', 60_000, 'ratelimit.global_per_minute', byUserOrIp),
    auth: make('auth', 15 * 60_000, 'ratelimit.auth_per_15min', byIp),
    downloads: make('downloads', 3_600_000, 'ratelimit.downloads_per_hour', byUserOrIp),
  };
}
