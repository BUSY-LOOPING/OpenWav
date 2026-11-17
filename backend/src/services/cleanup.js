import { deleteMediaObjects } from '../routes/browse.js';

const DAY_MS = 86_400_000;
const LOCK = 7_331_001;

// Tracks nobody kept: never liked, in no playlist, not played within the window
export function createCleanup({ prisma, settings, storage, config, logger }) {
  async function candidates(days, take) {
    const cutoff = new Date(Date.now() - days * DAY_MS);
    return prisma.media.findMany({
      where: {
        status: 'completed',
        createdAt: { lt: cutoff },
        likes: { none: {} },
        playlistItems: { none: {} },
        history: { none: { playedAt: { gte: cutoff } } },
      },
      orderBy: [{ fileSize: 'desc' }, { id: 'asc' }],
      take,
      select: { id: true, title: true, filePath: true, thumbnailPath: true, fileSize: true, createdAt: true },
    });
  }

  async function preview() {
    const days = await settings.get('storage.cleanup_unplayed_days');
    const rows = await candidates(days, 5000);
    return {
      days,
      count: rows.length,
      bytes: rows.reduce((n, r) => n + Number(r.fileSize ?? 0), 0),
      sample: rows.slice(0, 20).map((r) => ({ id: r.id, title: r.title, fileSize: Number(r.fileSize ?? 0), createdAt: r.createdAt })),
    };
  }

  async function run(limit = 500) {
    const rows = await candidates(await settings.get('storage.cleanup_unplayed_days'), limit);
    let bytes = 0;
    for (const media of rows) {
      await deleteMediaObjects({ storage, config }, media);
      await prisma.media.delete({ where: { id: media.id } });
      bytes += Number(media.fileSize ?? 0);
    }
    if (rows.length) logger.info({ removed: rows.length, bytes }, 'storage cleanup removed unused tracks');
    return { removed: rows.length, bytes };
  }

  // Hourly tick from every backend instance; the advisory lock and last-run stamp keep it to one run a day
  async function tick() {
    if (!(await settings.get('storage.cleanup_enabled'))) return null;
    return prisma.$transaction(
      async (tx) => {
        const [{ locked }] = await tx.$queryRaw`SELECT pg_try_advisory_xact_lock(${LOCK}) AS locked`;
        if (!locked) return null;
        const last = await tx.setting.findUnique({ where: { key: 'storage.cleanup_last_run' } });
        if (last && Date.now() - new Date(last.value).getTime() < DAY_MS - 3_600_000) return null;
        const value = new Date().toISOString();
        await tx.setting.upsert({ where: { key: 'storage.cleanup_last_run' }, create: { key: 'storage.cleanup_last_run', value }, update: { value } });
        return true;
      },
      { timeout: 10_000 },
    ).then((claimed) => (claimed ? run() : null));
  }

  return { preview, run, tick };
}
