import { HeadBucketCommand } from '@aws-sdk/client-s3';
import { CANCEL_CHANNEL, TASK_STATUS, TERMINAL_TASK_STATUSES } from '@openwav/shared';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { cursorWhere, page, pageQuery, uuidParam, validate } from '../lib/http.js';
import { trackInclude } from '../lib/serializers.js';
import { deleteMediaObjects } from './browse.js';

const COOKIE_DOMAIN = /(^|\.)(youtube\.com|google\.com)$/;

export function parseCookies(text) {
  const kept = text
    .split(/\r?\n/)
    .map((line) => ({ line, f: line.replace(/^#HttpOnly_/, '').split('\t') }))
    .filter(({ f }) => f.length === 7 && COOKIE_DOMAIN.test(f[0].replace(/^\./, '')));
  const expiries = kept.map(({ f }) => Number(f[4])).filter((t) => t > 0);
  return {
    content: `# Netscape HTTP Cookie File\n${kept.map((k) => k.line).join('\n')}\n`,
    entries: kept.length,
    domains: [...new Set(kept.map(({ f }) => f[0].replace(/^\./, '')))].sort(),
    expiresAt: expiries.length ? Math.min(...expiries) : null,
  };
}

const statusList = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',') : undefined))
  .pipe(z.array(z.enum(Object.values(TASK_STATUS))).optional());

export function adminRoutes(deps) {
  const { prisma, redis, auth, serialize, downloads, settings, storage, config, monitoring, recommender, scraper, channel, producerReady } = deps;
  const router = Router();
  router.use(auth.authenticate, auth.requireAdmin);

  router.get('/stats', async (_req, res) => {
    const day = new Date(Date.now() - 86_400_000);
    const week = new Date(Date.now() - 7 * 86_400_000);
    const [users, active, newUsers, media, newMedia, storageBytes, plays, byStatus, today, playsToday, current] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastSeen: { gte: day } } }),
      prisma.user.count({ where: { createdAt: { gte: week } } }),
      prisma.media.count({ where: { status: 'completed' } }),
      prisma.media.count({ where: { status: 'completed', createdAt: { gte: week } } }),
      prisma.media.aggregate({ _sum: { fileSize: true }, where: { status: 'completed' } }),
      prisma.media.aggregate({ _sum: { playCount: true } }),
      prisma.downloadTask.groupBy({ by: ['status'], _count: true }),
      prisma.downloadTask.count({ where: { createdAt: { gte: day } } }),
      prisma.userHistory.count({ where: { playedAt: { gte: day } } }),
      settings.all(),
    ]);
    const statusCounts = Object.fromEntries(byStatus.map((s) => [s.status, s._count]));
    res.json({
      data: {
        users: { total: users, activeToday: active, newThisWeek: newUsers },
        media: { total: media, newThisWeek: newMedia, totalPlays: plays._sum.playCount ?? 0 },
        storage: { totalBytes: Number(storageBytes._sum.fileSize ?? 0) },
        downloads: { total: Object.values(statusCounts).reduce((a, b) => a + b, 0), today, queued: 0, failed: 0, ...statusCounts },
        events: { last24h: playsToday },
        alerts: { p95_ms: current['alerts.p95_ms'], p99_ms: current['alerts.p99_ms'] },
      },
    });
  });

  router.get('/health', async (_req, res) => {
    const timed = async (name, fn) => {
      const start = performance.now();
      try {
        await fn();
        return { name, status: 'up', latencyMs: Math.round(performance.now() - start) };
      } catch (err) {
        return { name, status: 'down', latencyMs: null, error: err.message };
      }
    };
    const services = await Promise.all([
      timed('postgres', () => prisma.$queryRaw`SELECT 1`),
      timed('redis', () => redis.ping()),
      timed('rabbitmq', async () => {
        if (!channel()) throw new Error('not connected');
      }),
      timed('kafka', async () => {
        if (!producerReady()) throw new Error('not connected');
      }),
      timed('storage', () => storage.send(new HeadBucketCommand({ Bucket: config.S3_BUCKET_AUDIO }))),
      timed('recommender', () => recommender.health()),
      timed('scraper', () => scraper.health()),
    ]);
    const reachable = (url) =>
      fetch(url, { signal: AbortSignal.timeout(1500) }).then(
        (r) => (r.status < 500 ? 'up' : 'down'),
        () => 'down',
      );
    const links = await Promise.all(
      [
        { name: 'Grafana', description: 'Dashboards, logs (Loki) and traces (Tempo)', url: config.OPS_GRAFANA_URL, dashboardUrl: `${config.OPS_GRAFANA_URL}/d/openwav-overview`, check: `${config.GRAFANA_URL}/api/health` },
        { name: 'Prometheus', description: 'Metrics and alert rules', url: config.OPS_PROMETHEUS_URL, check: `${config.PROMETHEUS_URL}/-/healthy` },
        { name: 'Alertmanager', description: 'Active alerts and silences', url: config.OPS_ALERTMANAGER_URL, check: `${config.ALERTMANAGER_URL}/-/healthy` },
        { name: 'RabbitMQ', description: 'Download queues and dead letters', url: config.OPS_RABBITMQ_URL, check: config.RABBITMQ_UI_URL },
        { name: 'Prisma Studio', description: 'Runs on your machine only while npm run db:studio is running', url: config.OPS_PRISMA_STUDIO_URL, check: null },
      ].map(async ({ check, ...link }) => ({ ...link, status: check ? await reachable(check) : 'manual' })),
    );
    res.json({ data: { services, http: await monitoring.latency(), links } });
  });

  router.get('/alerts', async (_req, res) => res.json({ data: await monitoring.alerts() }));

  router.get('/users', validate({ query: pageQuery.extend({ search: z.string().max(100).optional(), role: z.enum(['user', 'admin']).optional(), status: z.enum(['active', 'banned']).optional() }) }), async (req, res) => {
    const { cursor, limit, search, role, status } = req.query;
    const rows = await prisma.user.findMany({
      where: {
        ...(search ? { OR: [{ username: { contains: search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}),
        ...(role ? { role } : {}),
        ...(status ? { isActive: status === 'active' } : {}),
        ...cursorWhere(cursor),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { _count: { select: { downloadTasks: true, playlists: true, likes: true } } },
    });
    const { items, nextCursor } = page(rows, limit);
    res.json({
      data: items.map((u) => ({ ...serialize.user(u), isActive: u.isActive, lastLogin: u.lastLogin, lastSeen: u.lastSeen, stats: u._count })),
      nextCursor,
    });
  });

  router.patch('/users/:id', validate({ params: uuidParam, body: z.object({ role: z.enum(['user', 'admin']).optional(), isActive: z.boolean().optional() }) }), async (req, res) => {
    if (req.params.id === req.user.id && (req.body.role === 'user' || req.body.isActive === false)) throw badRequest('You cannot demote or ban yourself');
    const user = await prisma.user.update({ where: { id: req.params.id }, data: req.body }).catch(() => {
      throw notFound('User');
    });
    if (req.body.isActive === false) await prisma.refreshToken.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date() } });
    res.json({ data: { ...serialize.user(user), isActive: user.isActive } });
  });

  router.delete('/users/:id', validate({ params: uuidParam }), async (req, res) => {
    if (req.params.id === req.user.id) throw badRequest('You cannot delete yourself');
    const { count } = await prisma.user.deleteMany({ where: { id: req.params.id } });
    if (!count) throw notFound('User');
    res.status(204).end();
  });

  router.get('/downloads', validate({ query: pageQuery.extend({ status: statusList, userId: z.string().uuid().optional() }) }), async (req, res) => {
    const { cursor, limit, status, userId } = req.query;
    const rows = await prisma.downloadTask.findMany({
      where: { ...(status ? { status: { in: status } } : {}), ...(userId ? { requestedBy: userId } : {}), ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { media: { select: { title: true } }, requester: { select: { username: true } } },
    });
    const { items, nextCursor } = page(rows, limit);
    res.json({ data: items.map(serialize.task), nextCursor });
  });

  async function cancel(ids) {
    const { count } = await prisma.downloadTask.updateMany({ where: { id: { in: ids }, status: { notIn: TERMINAL_TASK_STATUSES } }, data: { status: TASK_STATUS.cancelled } });
    await Promise.all(ids.map((id) => redis.publish(CANCEL_CHANNEL, id)));
    return count;
  }

  async function retry(ids) {
    const tasks = await prisma.downloadTask.findMany({ where: { id: { in: ids }, status: { in: [TASK_STATUS.failed, TASK_STATUS.cancelled] } }, select: { id: true } });
    for (const t of tasks) await downloads.retry(t.id);
    return tasks.length;
  }

  const taskById = async (id) => {
    const task = await prisma.downloadTask.findUnique({ where: { id }, include: { media: { select: { title: true } }, requester: { select: { username: true } } } });
    if (!task) throw notFound('Download');
    return serialize.task(task);
  };

  router.post('/downloads/:id/cancel', validate({ params: uuidParam }), async (req, res) => {
    await taskById(req.params.id);
    await cancel([req.params.id]);
    res.json({ data: await taskById(req.params.id) });
  });

  router.post('/downloads/:id/retry', validate({ params: uuidParam }), async (req, res) => {
    await taskById(req.params.id);
    if (!(await retry([req.params.id]))) throw badRequest('Only failed or cancelled downloads can be retried');
    res.json({ data: await taskById(req.params.id) });
  });

  router.post('/downloads/bulk', validate({ body: z.object({ action: z.enum(['cancel', 'retry', 'delete']), ids: z.array(z.string().uuid()).min(1).max(500) }) }), async (req, res) => {
    const { action, ids } = req.body;
    const affected =
      action === 'cancel'
        ? await cancel(ids)
        : action === 'retry'
          ? await retry(ids)
          : (await prisma.downloadTask.deleteMany({ where: { id: { in: ids }, status: { in: TERMINAL_TASK_STATUSES } } })).count;
    res.json({ data: { affected } });
  });

  router.get('/media', validate({ query: pageQuery.extend({ search: z.string().max(200).optional() }) }), async (req, res) => {
    const { cursor, limit, search } = req.query;
    const rows = await prisma.media.findMany({
      where: { ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}), ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { ...trackInclude(), uploader: { select: { username: true } } },
    });
    const { items, nextCursor } = page(rows, limit);
    res.json({
      data: items.map((m) => ({ ...serialize.track(m), status: m.status, url: m.url, fileSize: Number(m.fileSize ?? 0), uploadedBy: m.uploader?.username ?? null, createdAt: m.createdAt })),
      nextCursor,
    });
  });

  router.patch('/media/:id', validate({ params: uuidParam, body: z.object({ title: z.string().trim().min(1).max(500).optional(), artistNames: z.array(z.string().trim().min(1).max(200)).max(10).optional() }) }), async (req, res) => {
    const { title, artistNames } = req.body;
    await prisma.$transaction(async (tx) => {
      const media = await tx.media.findUnique({ where: { id: req.params.id }, select: { id: true } });
      if (!media) throw notFound('Track');
      if (title) await tx.media.update({ where: { id: media.id }, data: { title } });
      if (artistNames) {
        await tx.mediaArtist.deleteMany({ where: { mediaId: media.id } });
        for (const [position, name] of artistNames.entries()) {
          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || name;
          const artist = await tx.artist.upsert({ where: { slug }, create: { name, slug }, update: {} });
          await tx.mediaArtist.create({ data: { mediaId: media.id, artistId: artist.id, position } });
        }
      }
    });
    res.json({ data: serialize.track(await prisma.media.findUnique({ where: { id: req.params.id }, include: trackInclude() })) });
  });

  router.delete('/media/:id', validate({ params: uuidParam }), async (req, res) => {
    const media = await prisma.media.findUnique({ where: { id: req.params.id }, select: { id: true, filePath: true, thumbnailPath: true } });
    if (!media) throw notFound('Track');
    await deleteMediaObjects({ storage, config }, media);
    await prisma.media.delete({ where: { id: media.id } });
    res.status(204).end();
  });

  router.get('/settings', async (_req, res) => res.json({ data: await settings.all() }));

  router.patch('/settings', validate({ body: z.record(z.string(), z.json()) }), async (req, res) => {
    res.json({ data: await settings.update(req.body, req.user.id) });
  });

  router.get('/discovery', async (_req, res) => {
    const rows = await prisma.setting.findMany({ where: { key: { in: ['discovery.last_run', 'discovery.run_requested_at'] } } });
    const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const lastRun = stored['discovery.last_run'] ?? null;
    const tasks = lastRun?.taskIds?.length
      ? await prisma.downloadTask.findMany({ where: { id: { in: lastRun.taskIds } }, orderBy: { createdAt: 'asc' } })
      : [];
    const counts = Object.fromEntries(Object.values(TASK_STATUS).map((s) => [s, tasks.filter((t) => t.status === s).length]));
    const all = await settings.all();
    res.json({
      data: {
        settings: Object.fromEntries(Object.entries(all).filter(([k]) => k.startsWith('discovery.'))),
        requestedAt: stored['discovery.run_requested_at'] ?? null,
        lastRun,
        counts,
        tasks: tasks.map(serialize.task),
      },
    });
  });

  router.post('/discovery/run', async (req, res) => {
    const value = new Date().toISOString();
    await prisma.setting.upsert({ where: { key: 'discovery.run_requested_at' }, create: { key: 'discovery.run_requested_at', value, updatedBy: req.user.id }, update: { value, updatedBy: req.user.id } });
    res.status(202).json({ data: { requestedAt: value } });
  });

  const cookieStatus = (row) => {
    const { entries = 0, domains = [], expiresAt = null } = row?.value ?? {};
    return { configured: !!row, entries, domains, expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null, updatedAt: row?.updatedAt ?? null };
  };

  router.get('/ytdlp/cookies', async (_req, res) => {
    res.json({ data: cookieStatus(await prisma.setting.findUnique({ where: { key: 'ytdlp.cookies' } })) });
  });

  router.put('/ytdlp/cookies', validate({ body: z.object({ content: z.string().min(1).max(90_000) }) }), async (req, res) => {
    const value = parseCookies(req.body.content);
    if (!value.domains.some((d) => d.endsWith('youtube.com'))) throw badRequest('No youtube.com cookies found. Export a Netscape cookies.txt while signed in to YouTube.');
    const row = await prisma.setting.upsert({ where: { key: 'ytdlp.cookies' }, create: { key: 'ytdlp.cookies', value, updatedBy: req.user.id }, update: { value, updatedBy: req.user.id } });
    res.json({ data: cookieStatus(row) });
  });

  router.delete('/ytdlp/cookies', async (_req, res) => {
    await prisma.setting.deleteMany({ where: { key: 'ytdlp.cookies' } });
    res.status(204).end();
  });

  router.post('/recommender/retrain', async (_req, res) => {
    await recommender.retrain();
    res.status(202).json({ data: { queued: true } });
  });

  return router;
}
