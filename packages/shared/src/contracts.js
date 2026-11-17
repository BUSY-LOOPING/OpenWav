import { z } from 'zod';

export const EXCHANGE = 'downloads.exchange';
export const RETRY_EXCHANGE = 'downloads.retry';

export const QUEUES = Object.freeze({
  download: 'downloads',
  playlist: 'playlists',
  retry: 'downloads.retry',
  dead: 'downloads.dead',
});

export const PROGRESS_CHANNEL = 'download:progress';

export const EVENTS_TOPIC = 'openwav.events';

export const TASK_STATUS = Object.freeze({
  queued: 'queued',
  downloading: 'downloading',
  uploading: 'uploading',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
});

export const PLAYLIST_TASK_STATUS = Object.freeze({
  queued: 'queued',
  resolving: 'resolving',
  downloading: 'downloading',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
});

export const TERMINAL_TASK_STATUSES = [TASK_STATUS.completed, TASK_STATUS.failed, TASK_STATUS.cancelled];

export const DAILY_LIMIT_MESSAGE = 'Daily download limit reached';
export const STORAGE_LIMIT_MESSAGE = 'Storage limit reached';

export const dailyQuotaWhere = (userId, now = Date.now()) => ({
  requestedBy: userId,
  createdAt: { gte: new Date(now - 86_400_000) },
  NOT: { status: TASK_STATUS.completed, startedAt: null },
});

export const AUDIO_FORMATS = ['mp3', 'm4a', 'opus', 'flac', 'wav'];
export const AUDIO_QUALITIES = ['64k', '96k', '128k', '160k', '192k', '256k', '320k'];

export const MAX_RETRIES = 3;

export const EVENT_TYPES = [
  'play_start',
  'play_progress',
  'play_complete',
  'skip',
  'like',
  'unlike',
  'search',
  'add_to_playlist',
  'remove_from_playlist',
  'download_request',
  'page_view',
];

export const downloadJobSchema = z.object({
  taskId: z.string().uuid(),
  url: z.string().url(),
  format: z.enum(AUDIO_FORMATS),
  quality: z.enum(AUDIO_QUALITIES),
  userId: z.string().uuid().nullable(),
  playlistTaskId: z.string().uuid().nullable().default(null),
  playlistId: z.string().uuid().nullable().default(null),
  position: z.number().int().positive().nullable().default(null),
});

export const playlistJobSchema = z.object({
  playlistTaskId: z.string().uuid(),
  url: z.string().url(),
  format: z.enum(AUDIO_FORMATS),
  quality: z.enum(AUDIO_QUALITIES),
  userId: z.string().uuid().nullable(),
  playlistId: z.string().uuid().nullable().default(null),
});

export const progressEventSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(Object.values(TASK_STATUS)),
  progress: z.number().min(0).max(100).nullable(),
  title: z.string().nullable(),
  error: z.string().nullable(),
  url: z.string().nullable(),
  mediaId: z.string().uuid().nullable(),
  userId: z.string().uuid().nullable(),
  timestamp: z.string(),
});

export const trackingEventSchema = z.object({
  type: z.enum(EVENT_TYPES),
  mediaId: z.string().uuid().optional(),
  playlistId: z.string().uuid().optional(),
  query: z.string().max(200).optional(),
  positionSec: z.number().min(0).optional(),
  durationSec: z.number().min(0).optional(),
  path: z.string().max(300).optional(),
  occurredAt: z.string().datetime().optional(),
});

export const DEFAULT_SETTINGS = Object.freeze({
  'downloads.max_per_user_per_day': 100,
  'downloads.allowed_domains': ['youtube.com', 'youtu.be', 'music.youtube.com', 'soundcloud.com'],
  'downloads.default_format': 'mp3',
  'downloads.default_quality': '192k',
  'downloads.concurrency': 3,
  'downloads.paused': false,
  'storage.default_user_quota_gb': 0,
  'storage.cleanup_enabled': false,
  'storage.cleanup_unplayed_days': 180,
  'analytics.retention_days': 365,
  'scraper.cache_ttl_sec': 21600,
  'scraper.timeout_sec': 8,
  'scraper.max_concurrency': 4,
  'scraper.retries': 2,
  'auth.registration_enabled': true,
  'ratelimit.global_per_minute': 300,
  'ratelimit.auth_per_15min': 20,
  'ratelimit.downloads_per_hour': 60,
  'events.enabled': true,
  'events.sample_rate': 1,
  'events.types': EVENT_TYPES,
  'events.retention_days': 30,
  'recommender.enabled': true,
  'recommender.blend_content_weight': 0.3,
  'recommender.factors': 32,
  'recommender.regularization': 0.1,
  'recommender.iterations': 10,
  'recommender.alpha': 40,
  'recommender.half_life_days': 30,
  'recommender.window_days': 365,
  'alerts.p95_ms': 500,
  'alerts.p99_ms': 1500,
  'discovery.enabled': true,
  'discovery.interval_hours': 24,
  'discovery.per_source': 5,
  'discovery.country': 'ZZ',
  'discovery.genres': ['pop', 'hip hop', 'rock', 'bollywood', 'edm', 'r&b', 'lofi', 'indie'],
  'discovery.top_artists': 10,
  'discovery.queries': ['trending songs', 'viral hits', 'new music this week'],
  'discovery.playlists': [],
});

export function buildProgressEvent({ taskId, status, progress = null, title = null, error = null, url = null, mediaId = null, userId = null }) {
  return progressEventSchema.parse({ taskId, status, progress, title, error, url, mediaId, userId, timestamp: new Date().toISOString() });
}

export async function storageUsage(prisma, userId) {
  const [user, setting, used] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { storageQuotaBytes: true } }),
    prisma.setting.findUnique({ where: { key: 'storage.default_user_quota_gb' } }),
    prisma.media.aggregate({ _sum: { fileSize: true }, where: { uploadedBy: userId, status: 'completed' } }),
  ]);
  const quota = user?.storageQuotaBytes ?? Math.round((setting?.value ?? DEFAULT_SETTINGS['storage.default_user_quota_gb']) * 1024 ** 3);
  return { usedBytes: Number(used._sum.fileSize ?? 0), quotaBytes: Number(quota) || null };
}

export const overStorage = ({ usedBytes, quotaBytes }) => quotaBytes !== null && usedBytes >= quotaBytes;

export function isAllowedDomain(url, allowedDomains) {
  const host = new URL(url).hostname.toLowerCase();
  return allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function isPlaylistUrl(url) {
  const parsed = new URL(url);
  if (parsed.hostname.includes('soundcloud.com')) return parsed.pathname.includes('/sets/');
  return parsed.pathname.startsWith('/playlist') || (parsed.searchParams.has('list') && !parsed.searchParams.has('v'));
}

export const CANCEL_CHANNEL = 'download:cancel';
export const YTDLP_UPDATE_CHANNEL = 'ytdlp:update';
export const YTDLP_STATUS_KEY = 'ytdlp:status';
export const SCRAPER_CONFIG_KEY = 'scraper:config';

export const scraperConfig = (s) => ({
  cacheTtlSec: s['scraper.cache_ttl_sec'],
  timeoutSec: s['scraper.timeout_sec'],
  maxConcurrency: s['scraper.max_concurrency'],
  retries: s['scraper.retries'],
});

export function cappedQuality(requested, max) {
  if (!max || !AUDIO_QUALITIES.includes(max)) return requested;
  return AUDIO_QUALITIES.indexOf(requested) > AUDIO_QUALITIES.indexOf(max) ? max : requested;
}

export function retryDelayMs(retryCount) {
  return Math.min(30_000 * 2 ** retryCount, 15 * 60_000);
}

export async function assertTopology(channel) {
  await channel.assertExchange(EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(RETRY_EXCHANGE, 'direct', { durable: true });
  const deadLetter = { 'x-dead-letter-exchange': EXCHANGE, 'x-dead-letter-routing-key': QUEUES.dead };
  await channel.assertQueue(QUEUES.dead, { durable: true });
  await channel.assertQueue(QUEUES.download, { durable: true, arguments: deadLetter });
  await channel.assertQueue(QUEUES.playlist, { durable: true, arguments: deadLetter });
  await channel.assertQueue(QUEUES.retry, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': EXCHANGE, 'x-dead-letter-routing-key': QUEUES.download },
  });
  await channel.bindQueue(QUEUES.dead, EXCHANGE, QUEUES.dead);
  await channel.bindQueue(QUEUES.download, EXCHANGE, QUEUES.download);
  await channel.bindQueue(QUEUES.playlist, EXCHANGE, QUEUES.playlist);
  await channel.bindQueue(QUEUES.retry, RETRY_EXCHANGE, QUEUES.download);
}

export function publishJson(channel, exchange, routingKey, payload, options = {}) {
  return new Promise((resolve, reject) => {
    channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(payload)), { persistent: true, contentType: 'application/json', ...options }, (err) =>
      err ? reject(err) : resolve(),
    );
  });
}
