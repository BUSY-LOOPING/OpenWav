import { metricsHandler } from '@openwav/shared/metrics';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createSerializers } from './lib/serializers.js';
import { createSettings } from './lib/settings.js';
import { createTokens } from './lib/tokens.js';
import { createAuth } from './middleware/auth.js';
import { errorHandler, metricsMiddleware, notFoundHandler } from './middleware/observability.js';
import { createRateLimiters } from './middleware/rateLimit.js';
import { adminRoutes, opsCheck } from './routes/admin.js';
import { authRoutes } from './routes/auth.js';
import { browseRoutes } from './routes/browse.js';
import { downloadRoutes } from './routes/downloads.js';
import { libraryRoutes } from './routes/library.js';
import { playlistRoutes } from './routes/playlists.js';
import { searchRoutes } from './routes/search.js';
import { createDownloadService } from './services/downloads.js';
import { createEventService } from './services/events.js';
import { createPlaylistService } from './services/playlists.js';
import { createProgressHub } from './services/progress.js';

export function createApp(external) {
  const { prisma, config, logger } = external;
  const settings = external.settings ?? createSettings(prisma);
  const tokens = createTokens(config);
  const playlists = createPlaylistService({ prisma });
  const deps = {
    ...external,
    settings,
    tokens,
    playlists,
    serialize: createSerializers(),
    auth: createAuth({ prisma, tokens }),
    limits: createRateLimiters({ redis: external.redis, settings }),
    downloads: createDownloadService({ prisma, settings, channel: external.channel, playlists }),
    events: createEventService({ prisma, settings, producer: external.producer, logger }),
    progress: createProgressHub({ subscriber: external.subscriber, logger }),
  };

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.TRUST_PROXY);
  app.use(
    pinoHttp({
      logger,
      genReqId: (req) => req.headers['x-request-id'] ?? crypto.randomUUID(),
      autoLogging: { ignore: (req) => req.url === '/metrics' || req.url.startsWith('/health') || req.url.startsWith('/api/v1/health') },
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, path: req.url.split('?')[0], ip: req.headers['x-real-ip'] ?? req.remoteAddress }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: config.corsOrigins, credentials: false, maxAge: 600 }));
  app.use(express.json({ limit: '100kb' }));
  app.use(metricsMiddleware);

  app.get('/metrics', metricsHandler);
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));
  app.get('/ready', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready' });
  });

  const api = express.Router();
  api.get('/health', (_req, res) => res.json({ data: { status: 'ok' } }));
  api.use('/auth', authRoutes(deps));
  api.get('/admin/ops-check', opsCheck(deps));
  api.use(deps.auth.optionalAuth, deps.limits.global);
  api.use('/', browseRoutes(deps));
  api.use('/search', searchRoutes(deps));
  api.use('/library', libraryRoutes(deps));
  api.use('/playlists', playlistRoutes(deps));
  api.use('/', downloadRoutes(deps));
  api.use('/admin', adminRoutes(deps));
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return { app, deps };
}
