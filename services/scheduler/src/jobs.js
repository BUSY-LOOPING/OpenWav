import { DEFAULT_SETTINGS, EVENTS_TOPIC, TASK_STATUS, TERMINAL_TASK_STATUSES } from '@openwav/shared';

const minutesAgo = (m, now) => new Date(now - m * 60_000);

async function scrape(baseUrl, path) {
  const res = await fetch(`${baseUrl}${path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`scraper ${res.status}`);
  const body = await res.json();
  return 'item' in body ? body.item : body.items;
}

export function createSchedulerJobs({ prisma, publishDownload, publishPlaylist, kafkaAdmin, scraperUrl, now = () => Date.now() }) {
  return {
    async recoverStale() {
      const stuck = await prisma.downloadTask.findMany({
        where: {
          OR: [
            { status: { in: [TASK_STATUS.downloading, TASK_STATUS.uploading] }, updatedAt: { lt: minutesAgo(30, now()) } },
            { status: TASK_STATUS.queued, updatedAt: { lt: minutesAgo(60, now()) } },
          ],
        },
        take: 500,
      });
      for (const task of stuck) {
        await prisma.downloadTask.update({ where: { id: task.id }, data: { status: TASK_STATUS.queued, progress: 0, errorMessage: 'Recovered by scheduler' } });
        await publishDownload({
          taskId: task.id,
          url: task.url,
          format: task.format ?? 'mp3',
          quality: task.quality ?? '192k',
          userId: task.requestedBy,
          playlistTaskId: task.playlistTaskId,
          playlistId: task.targetPlaylistId,
          position: task.position,
        });
      }
      return stuck.length;
    },

    async pruneTokens() {
      const { count } = await prisma.refreshToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now()) } }, { revokedAt: { lt: minutesAgo(7 * 1440, now()) } }] } });
      return count;
    },

    async pruneTasks(days = 30) {
      const { count } = await prisma.downloadTask.deleteMany({ where: { status: { in: TERMINAL_TASK_STATUSES }, updatedAt: { lt: minutesAgo(days * 1440, now()) } } });
      return count;
    },

    async enrichArtists(batch = 25) {
      const artists = await prisma.$queryRaw`
        SELECT id, name, metadata FROM artists
        WHERE image_url IS NULL AND (metadata->>'imageCheckedAt' IS NULL OR (metadata->>'imageCheckedAt')::timestamptz < ${minutesAgo(7 * 1440, now())})
        ORDER BY created_at DESC LIMIT ${batch}`;
      let found = 0;
      for (const a of artists) {
        const item = await scrape(scraperUrl, `/artist?q=${encodeURIComponent(a.name)}`).catch(() => undefined);
        if (item === undefined) continue;
        if (item?.thumbnailUrl) found++;
        await prisma.artist.update({
          where: { id: a.id },
          data: { imageUrl: item?.thumbnailUrl ?? null, metadata: { ...(a.metadata ?? {}), imageCheckedAt: new Date(now()).toISOString(), ...(item ? { ytBrowseId: item.browseId } : {}) } },
        });
      }
      return found;
    },

    async discover() {
      const rows = await prisma.setting.findMany({ where: { key: { startsWith: 'discovery.' } } });
      const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const s = { ...DEFAULT_SETTINGS, ...stored };
      const last = stored['discovery.last_run'];
      const requested = stored['discovery.run_requested_at'];
      const manual = !!requested && (!last || requested > last.startedAt);
      const due = s['discovery.enabled'] && (!last || now() - Date.parse(last.startedAt) >= s['discovery.interval_hours'] * 3_600_000);
      if (!manual && !due) return 'idle';

      const run = { startedAt: new Date(now()).toISOString(), finishedAt: null, trigger: manual ? 'manual' : 'schedule', error: null, sources: [], taskIds: [], playlistTaskIds: [] };
      const save = () => prisma.setting.upsert({ where: { key: 'discovery.last_run' }, create: { key: 'discovery.last_run', value: run }, update: { value: run } });
      const owner = await prisma.user.findFirst({ where: { role: 'admin', isActive: true }, orderBy: { createdAt: 'asc' }, select: { id: true } });
      if (!owner) {
        run.error = 'No active admin user to own discovered downloads';
        run.finishedAt = run.startedAt;
        await save();
        return 0;
      }
      await save();

      const limit = s['discovery.per_source'];
      const format = s['downloads.default_format'];
      const quality = s['downloads.default_quality'];
      const search = (q) => scrape(scraperUrl, `/search?filter=songs&limit=${limit}&q=${encodeURIComponent(q)}`);
      const artists = await prisma.$queryRaw`
        SELECT a.name FROM artists a JOIN media_artists ma ON ma.artist_id = a.id JOIN media m ON m.id = ma.media_id
        GROUP BY a.id, a.name ORDER BY sum(m.play_count) DESC, count(*) DESC LIMIT ${s['discovery.top_artists']}`;
      const sources = [
        { source: 'charts', label: s['discovery.country'], load: () => scrape(scraperUrl, `/charts?country=${encodeURIComponent(s['discovery.country'])}`) },
        ...s['discovery.genres'].map((g) => ({ source: 'genre', label: g, load: () => search(`top ${g} songs`) })),
        ...artists.map((a) => ({ source: 'artist', label: a.name, load: () => search(`${a.name} top songs`) })),
        ...s['discovery.queries'].map((q) => ({ source: 'picks', label: q, load: () => search(q) })),
      ];

      const found = new Map();
      for (const { load, ...meta } of sources) {
        const entry = { ...meta, found: 0, queued: 0, skipped: 0, error: null };
        run.sources.push(entry);
        try {
          for (const item of (await load()).slice(0, limit)) {
            entry.found++;
            if (found.has(item.videoId)) entry.skipped++;
            else found.set(item.videoId, { item, entry });
          }
        } catch (err) {
          entry.error = err.message;
        }
      }

      const ids = [...found.keys()];
      const urls = [...found.values()].map((f) => f.item.url);
      const have = new Set((await prisma.media.findMany({ where: { sourceId: { in: ids } }, select: { sourceId: true } })).map((m) => m.sourceId));
      const pending = new Set(
        (await prisma.downloadTask.findMany({ where: { url: { in: urls }, status: { notIn: TERMINAL_TASK_STATUSES } }, select: { url: true } })).map((t) => t.url),
      );
      for (const [id, { item, entry }] of found) {
        if (have.has(id) || pending.has(item.url)) {
          entry.skipped++;
          continue;
        }
        const task = await prisma.downloadTask.create({ data: { url: item.url, requestedBy: owner.id, format, quality } });
        await publishDownload({ taskId: task.id, url: item.url, format, quality, userId: owner.id, playlistTaskId: null, playlistId: null, position: null });
        entry.queued++;
        run.taskIds.push(task.id);
      }

      for (const url of s['discovery.playlists']) {
        const entry = { source: 'playlist', label: url, found: 1, queued: 0, skipped: 0, error: null };
        run.sources.push(entry);
        try {
          const task = await prisma.playlistTask.create({ data: { url, requestedBy: owner.id, format, quality } });
          await publishPlaylist({ playlistTaskId: task.id, url, format, quality, userId: owner.id, playlistId: null });
          entry.queued = 1;
          run.playlistTaskIds.push(task.id);
        } catch (err) {
          entry.error = err.message;
        }
      }

      run.finishedAt = new Date(now()).toISOString();
      await save();
      return run.taskIds.length;
    },

    async syncEventRetention() {
      const row = await prisma.setting.findUnique({ where: { key: 'events.retention_days' } });
      const days = Number(row?.value ?? DEFAULT_SETTINGS['events.retention_days']);
      await kafkaAdmin.alterConfigs({
        validateOnly: false,
        resources: [{ type: 2, name: EVENTS_TOPIC, configEntries: [{ name: 'retention.ms', value: String(days * 86_400_000) }] }],
      });
      return days;
    },
  };
}
