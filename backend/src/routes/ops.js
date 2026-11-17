import { DAILY_LIMIT_MESSAGE, EXCHANGE, QUEUES, STORAGE_LIMIT_MESSAGE, TASK_STATUS, YTDLP_STATUS_KEY, YTDLP_UPDATE_CHANNEL, publishJson } from '@openwav/shared';
import { Router } from 'express';
import { z } from 'zod';
import { unavailable } from '../lib/errors.js';
import { cursorWhere, page, pageQuery, uuidParam, validate } from '../lib/http.js';
import { listSessions } from '../lib/sessions.js';

const DAY_MS = 86_400_000;
const RANGES = { '1h': 3600, '6h': 21_600, '24h': 86_400, '7d': 604_800 };
const DISK = 'fstype!~"tmpfs|devtmpfs|overlay|squashfs|efivarfs|vfat|ramfs|nsfs|autofs|fuse.*"';
const NIC = 'device!~"lo|veth.*|br-.*|docker.*"';
const SCRAPER_ENDPOINTS = ['search', 'suggestions', 'artist', 'related', 'playlist', 'charts'];

const deathOf = (msg) => msg.properties.headers?.['x-death']?.[0] ?? null;
const parse = (msg) => {
  try {
    return JSON.parse(msg.content.toString());
  } catch {
    return null;
  }
};

// Disk holding a path: the longest mount point that prefixes it
const diskFor = (disks, path) =>
  disks.filter((d) => path === d.mount || path.startsWith(d.mount.endsWith('/') ? d.mount : `${d.mount}/`)).sort((a, b) => b.mount.length - a.mount.length)[0] ?? null;

export function opsRoutes(deps) {
  const { prisma, redis, auth, settings, config, monitoring, scraper, channel, audit, cleanup } = deps;
  const router = Router();
  router.use(auth.authenticate, auth.requireAdmin);

  const amqp = () => {
    const ch = channel();
    if (!ch) throw unavailable('RabbitMQ is not connected');
    return ch;
  };

  router.get('/audit', validate({ query: pageQuery.extend({ action: z.string().max(100).optional(), actorId: z.string().uuid().optional() }) }), async (req, res) => {
    const { cursor, limit, action, actorId } = req.query;
    const rows = await prisma.auditLog.findMany({
      where: { ...(action ? { action: { startsWith: action } } : {}), ...(actorId ? { actorId } : {}), ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: { actor: { select: { username: true } } },
    });
    const { items, nextCursor } = page(rows, limit);
    res.json({ data: items.map(({ actor, ...a }) => ({ ...a, actor: actor?.username ?? null })), nextCursor });
  });

  router.get('/users/:id/sessions', validate({ params: uuidParam }), async (req, res) => {
    res.json({ data: await listSessions(prisma, req.params.id) });
  });

  router.delete('/users/:id/sessions/:sessionId', validate({ params: z.object({ id: z.string().uuid(), sessionId: z.string().uuid() }) }), async (req, res) => {
    const { count } = await prisma.refreshToken.updateMany({ where: { userId: req.params.id, sessionId: req.params.sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, 'session.revoke', { type: 'user', id: req.params.id, details: { sessionId: req.params.sessionId, tokens: count } });
    res.status(204).end();
  });

  router.delete('/users/:id/sessions', validate({ params: uuidParam }), async (req, res) => {
    const { count } = await prisma.refreshToken.updateMany({ where: { userId: req.params.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(req, 'session.revoke_all', { type: 'user', id: req.params.id, details: { tokens: count } });
    res.status(204).end();
  });

  router.get('/queues', async (_req, res) => {
    const ch = amqp();
    const queues = [];
    for (const name of [QUEUES.download, QUEUES.playlist, QUEUES.retry, QUEUES.dead]) {
      const { messageCount, consumerCount } = await ch.checkQueue(name);
      queues.push({ name, messages: messageCount, consumers: consumerCount });
    }
    const runs = await monitoring.vector('sum by (job, outcome) (increase(scheduler_job_runs_total[24h]))').catch(() => []);
    const scheduler = {};
    for (const r of runs) {
      scheduler[r.metric.job] ??= { job: r.metric.job, ok: 0, error: 0 };
      scheduler[r.metric.job][r.metric.outcome === 'ok' ? 'ok' : 'error'] += Math.round(Number(r.value[1]));
    }
    res.json({ data: { paused: await settings.get('downloads.paused'), queues, scheduler: Object.values(scheduler).sort((a, b) => a.job.localeCompare(b.job)) } });
  });

  router.put('/queues/paused', validate({ body: z.object({ paused: z.boolean() }) }), async (req, res) => {
    await settings.update({ 'downloads.paused': req.body.paused }, req.user.id);
    await audit(req, req.body.paused ? 'queue.pause' : 'queue.resume');
    res.json({ data: { paused: req.body.paused } });
  });

  router.get('/queues/dead', validate({ query: z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }) }), async (req, res) => {
    const ch = amqp();
    const held = [];
    try {
      for (let i = 0; i < req.query.limit; i++) {
        const msg = await ch.get(QUEUES.dead, { noAck: false });
        if (!msg) break;
        held.push(msg);
      }
    } finally {
      for (const msg of held) ch.nack(msg, false, true);
    }
    const jobs = held.map((msg) => ({ body: parse(msg), death: deathOf(msg) }));
    const taskIds = jobs.map((j) => j.body?.taskId).filter(Boolean);
    const tasks = taskIds.length ? await prisma.downloadTask.findMany({ where: { id: { in: taskIds } }, select: { id: true, title: true, errorMessage: true } }) : [];
    const byId = new Map(tasks.map((t) => [t.id, t]));
    res.json({
      data: jobs.map(({ body, death }, i) => ({
        id: `${i}`,
        queue: death?.['routing-keys']?.[0] ?? death?.queue ?? null,
        reason: death?.reason ?? null,
        deaths: Number(death?.count ?? 1),
        url: body?.url ?? null,
        title: byId.get(body?.taskId)?.title ?? null,
        error: byId.get(body?.taskId)?.errorMessage ?? null,
      })),
    });
  });

  router.post('/queues/dead/replay', async (req, res) => {
    const ch = amqp();
    let replayed = 0;
    for (let i = 0; i < 1000; i++) {
      const msg = await ch.get(QUEUES.dead, { noAck: false });
      if (!msg) break;
      const body = parse(msg);
      const target = deathOf(msg)?.['routing-keys']?.[0] === QUEUES.playlist ? QUEUES.playlist : QUEUES.download;
      if (!body) {
        ch.ack(msg);
        continue;
      }
      if (body.taskId) await prisma.downloadTask.updateMany({ where: { id: body.taskId }, data: { status: TASK_STATUS.queued, retryCount: 0, errorMessage: null, progress: 0 } });
      await publishJson(ch, EXCHANGE, target, body);
      ch.ack(msg);
      replayed += 1;
    }
    await audit(req, 'queue.dead_replay', { details: { replayed } });
    res.json({ data: { replayed } });
  });

  router.delete('/queues/dead', async (req, res) => {
    const { messageCount } = await amqp().purgeQueue(QUEUES.dead);
    await audit(req, 'queue.dead_purge', { details: { purged: messageCount } });
    res.json({ data: { purged: messageCount } });
  });

  router.get('/ytdlp', async (_req, res) => {
    const since = new Date(Date.now() - DAY_MS);
    const quotaErrors = [DAILY_LIMIT_MESSAGE, STORAGE_LIMIT_MESSAGE];
    const [raw, lastSuccess, outcomes, errors] = await Promise.all([
      redis.get(YTDLP_STATUS_KEY),
      prisma.downloadTask.findFirst({ where: { status: TASK_STATUS.completed, startedAt: { not: null } }, orderBy: { completedAt: 'desc' }, select: { completedAt: true } }),
      prisma.downloadTask.groupBy({ by: ['status'], where: { updatedAt: { gte: since }, startedAt: { not: null }, status: { in: [TASK_STATUS.completed, TASK_STATUS.failed] } }, _count: true }),
      prisma.downloadTask.groupBy({
        by: ['errorMessage'],
        where: { updatedAt: { gte: since }, status: TASK_STATUS.failed, errorMessage: { notIn: quotaErrors } },
        _count: true,
        orderBy: { _count: { errorMessage: 'desc' } },
        take: 5,
      }),
    ]);
    const count = (status) => outcomes.find((o) => o.status === status)?._count ?? 0;
    const completed = count(TASK_STATUS.completed);
    const failed = count(TASK_STATUS.failed);
    res.json({
      data: {
        status: raw ? JSON.parse(raw) : null,
        lastSuccessAt: lastSuccess?.completedAt ?? null,
        last24h: { completed, failed, successRate: completed + failed ? completed / (completed + failed) : null },
        topErrors: errors.filter((e) => e.errorMessage).map((e) => ({ message: e.errorMessage.slice(0, 300), count: e._count })),
      },
    });
  });

  router.post('/ytdlp/update', async (req, res) => {
    await redis.publish(YTDLP_UPDATE_CHANNEL, req.user.id);
    await audit(req, 'ytdlp.update');
    res.status(202).json({ data: { requested: true } });
  });

  router.get('/storage', async (_req, res) => {
    const [server, [db], totals, byFormat, largest, lastRun, preview, current] = await Promise.all([
      monitoring.server().catch(() => null),
      prisma.$queryRaw`SELECT pg_database_size(current_database())::bigint AS bytes`,
      prisma.media.aggregate({ where: { status: 'completed' }, _sum: { fileSize: true }, _count: true }),
      prisma.media.groupBy({ by: ['format', 'quality'], where: { status: 'completed' }, _sum: { fileSize: true }, _count: true, orderBy: { _sum: { fileSize: 'desc' } } }),
      prisma.media.findMany({ where: { status: 'completed' }, orderBy: { fileSize: 'desc' }, take: 10, select: { id: true, title: true, fileSize: true, format: true, quality: true, playCount: true } }),
      prisma.setting.findUnique({ where: { key: 'storage.cleanup_last_run' } }),
      cleanup.preview(),
      settings.all(),
    ]);
    const disks = server?.disks ?? [];
    const hot = diskFor(disks, '/');
    const cold = config.COLD_STORAGE_DIR ? diskFor(disks, config.COLD_STORAGE_DIR) : null;
    res.json({
      data: {
        tiers: {
          hot: { disk: hot, holds: 'Database, cache, queues, event log, downloads in progress' },
          cold: { path: config.COLD_STORAGE_DIR || null, disk: cold && cold.device !== hot?.device ? cold : null, holds: 'Audio, covers, metrics, logs and traces' },
        },
        databaseBytes: Number(db.bytes),
        library: { tracks: totals._count, bytes: Number(totals._sum.fileSize ?? 0) },
        byFormat: byFormat.map((f) => ({ format: f.format, quality: f.quality, tracks: f._count, bytes: Number(f._sum.fileSize ?? 0) })),
        largest: largest.map((m) => ({ ...m, fileSize: Number(m.fileSize ?? 0) })),
        cleanup: { enabled: current['storage.cleanup_enabled'], unplayedDays: current['storage.cleanup_unplayed_days'], lastRunAt: lastRun?.value ?? null, preview },
      },
    });
  });

  router.post('/storage/cleanup', async (req, res) => {
    const result = await cleanup.run();
    await audit(req, 'storage.cleanup', { details: result });
    res.json({ data: result });
  });

  router.get('/analytics', validate({ query: z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }) }), async (req, res) => {
    const { days } = req.query;
    const since = new Date(Date.now() - days * DAY_MS);
    const [plays, downloads, signups, topTracks, topUsers, topArtists, misses, [totals]] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char((played_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, count(*)::int AS plays, count(DISTINCT user_id)::int AS listeners
        FROM play_events WHERE played_at >= ${since} GROUP BY 1`,
      prisma.$queryRaw`
        SELECT to_char((completed_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, count(*)::int AS downloads
        FROM download_tasks WHERE status = 'completed' AND completed_at >= ${since} GROUP BY 1`,
      prisma.$queryRaw`
        SELECT to_char((created_at AT TIME ZONE 'UTC')::date, 'YYYY-MM-DD') AS day, count(*)::int AS signups
        FROM users WHERE created_at >= ${since} GROUP BY 1`,
      prisma.$queryRaw`
        SELECT m.id, m.title, count(*)::int AS plays, count(DISTINCT p.user_id)::int AS listeners
        FROM play_events p JOIN media m ON m.id = p.media_id WHERE p.played_at >= ${since}
        GROUP BY m.id, m.title ORDER BY plays DESC LIMIT 10`,
      prisma.$queryRaw`
        SELECT u.id, u.username, count(*)::int AS plays FROM play_events p JOIN users u ON u.id = p.user_id
        WHERE p.played_at >= ${since} GROUP BY u.id, u.username ORDER BY plays DESC LIMIT 10`,
      prisma.$queryRaw`
        SELECT a.id, a.name, count(*)::int AS plays FROM play_events p
        JOIN media_artists ma ON ma.media_id = p.media_id JOIN artists a ON a.id = ma.artist_id
        WHERE p.played_at >= ${since} GROUP BY a.id, a.name ORDER BY plays DESC LIMIT 10`,
      prisma.searchMiss.groupBy({ by: ['term'], where: { day: { gte: since } }, _sum: { count: true }, orderBy: { _sum: { count: 'desc' } }, take: 15 }),
      prisma.$queryRaw`SELECT count(*)::int AS plays, count(DISTINCT user_id)::int AS listeners FROM play_events WHERE played_at >= ${since}`,
    ]);
    const byDay = (rows) => new Map(rows.map((r) => [r.day, r]));
    const [p, d, u] = [byDay(plays), byDay(downloads), byDay(signups)];
    const daily = Array.from({ length: days }, (_, i) => {
      const day = new Date(Date.now() - (days - 1 - i) * DAY_MS).toISOString().slice(0, 10);
      return { day, plays: p.get(day)?.plays ?? 0, listeners: p.get(day)?.listeners ?? 0, downloads: d.get(day)?.downloads ?? 0, signups: u.get(day)?.signups ?? 0 };
    });
    res.json({
      data: {
        days,
        totals,
        daily,
        topTracks,
        topArtists,
        topUsers,
        searchMisses: misses.map((m) => ({ term: m.term, count: m._sum.count ?? 0 })),
      },
    });
  });

  router.get('/scraper', async (_req, res) => {
    const [health, stats, current, routes, errors] = await Promise.all([
      scraper.health().then(
        () => 'up',
        () => 'down',
      ),
      scraper.stats().catch(() => null),
      settings.all(),
      monitoring
        .vector('sum by (route) (rate(http_request_duration_seconds_count{job="scraper",route!~"/health|/metrics|/stats"}[15m]))')
        .then(async (rates) => {
          const p95 = await monitoring.vector('histogram_quantile(0.95, sum by (le, route) (rate(http_request_duration_seconds_bucket{job="scraper"}[15m])))');
          const latency = new Map(p95.map((r) => [r.metric.route, Number(r.value[1])]));
          return rates.map((r) => ({ route: r.metric.route, rps: Number(r.value[1]), p95Ms: Number.isFinite(latency.get(r.metric.route)) ? Math.round(latency.get(r.metric.route) * 1000) : null }));
        })
        .catch(() => []),
      monitoring.vector('sum by (source) (increase(scraper_upstream_errors_total[24h]))').catch(() => []),
    ]);
    res.json({
      data: {
        health,
        stats,
        settings: Object.fromEntries(Object.entries(current).filter(([k]) => k.startsWith('scraper.'))),
        routes,
        upstreamErrors: errors.map((e) => ({ source: e.metric.source, count: Math.round(Number(e.value[1])) })),
      },
    });
  });

  router.post(
    '/scraper/run',
    validate({ body: z.object({ endpoint: z.enum(SCRAPER_ENDPOINTS), params: z.record(z.string().regex(/^[a-zA-Z]{1,20}$/), z.string().max(200)).default({}), fresh: z.boolean().default(false) }) }),
    async (req, res) => {
      const result = await scraper.raw(`/${req.body.endpoint}`, req.body.params, { fresh: req.body.fresh }).catch((err) => {
        throw unavailable(`Scraper unreachable: ${err.message}`);
      });
      res.json({ data: result });
    },
  );

  router.delete('/scraper/cache', async (req, res) => {
    const result = await scraper.clearCache().catch(() => {
      throw unavailable('Scraper is unreachable');
    });
    await audit(req, 'scraper.cache_clear', { details: result });
    res.json({ data: result });
  });

  router.get('/server/history', validate({ query: z.object({ range: z.enum(Object.keys(RANGES)).default('6h') }) }), async (req, res) => {
    const sinceSec = RANGES[req.query.range];
    const step = Math.max(15, Math.round(sinceSec / 120));
    const window = `${Math.max(60, step * 2)}s`;
    const q = (query) => monitoring.range(query, { sinceSec, step });
    const one = async (query) => (await q(query))[0]?.points ?? [];
    const [cpu, memory, swap, rx, tx, disks, requests, p95, downloads] = await Promise.all([
      one(`1 - avg(rate(node_cpu_seconds_total{mode="idle"}[${window}]))`),
      one('1 - node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes'),
      one('1 - node_memory_SwapFree_bytes / clamp_min(node_memory_SwapTotal_bytes, 1)'),
      one(`sum(rate(node_network_receive_bytes_total{${NIC}}[${window}]))`),
      one(`sum(rate(node_network_transmit_bytes_total{${NIC}}[${window}]))`),
      q(`max by (mountpoint) (1 - node_filesystem_avail_bytes{${DISK}} / node_filesystem_size_bytes{${DISK}})`),
      one(`sum(rate(http_request_duration_seconds_count{service="backend"}[${window}]))`),
      one(`histogram_quantile(0.95, sum by (le) (rate(http_request_duration_seconds_bucket{service="backend"}[${window}])))`),
      q(`sum by (status) (increase(download_jobs_total{status=~"completed|failed"}[${window}]))`),
    ]).catch(() => {
      throw unavailable('Prometheus is unreachable');
    });
    const byStatus = (status) => downloads.find((d) => d.labels.status === status)?.points ?? [];
    const serverDisks = (await monitoring.server().catch(() => null))?.disks ?? [];
    const keep = new Set(serverDisks.map((d) => d.mount));
    res.json({
      data: {
        range: req.query.range,
        step,
        cpu,
        memory,
        swap,
        network: { rx, tx },
        disks: disks.filter((d) => !keep.size || keep.has(d.labels.mountpoint)).map((d) => ({ mount: d.labels.mountpoint, points: d.points })),
        requests,
        p95: p95.map(([t, v]) => [t, v === null ? null : v * 1000]),
        downloads: { completed: byStatus('completed'), failed: byStatus('failed') },
      },
    });
  });

  return router;
}
