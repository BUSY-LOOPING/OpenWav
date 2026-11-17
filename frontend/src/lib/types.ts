export type Role = 'user' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: Role;
  createdAt: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthPayload {
  user: User;
  tokens: Tokens;
}

export interface ArtistRef {
  id: string;
  name: string;
}

export interface AlbumRef {
  id: string;
  name: string;
}

export interface Track {
  id: string;
  title: string;
  artists: ArtistRef[];
  album: AlbumRef | null;
  durationSec: number | null;
  thumbnailUrl: string | null;
  liked: boolean;
  playCount: number;
}

export interface PlaylistTrack extends Track {
  position: number;
  addedAt: string;
}

export interface HistoryTrack extends Track {
  playedAt: string;
}

export interface Playlist {
  id: string;
  name: string;
  description: string | null;
  isPublic: boolean;
  owner: { id: string; username: string } | null;
  trackCount: number;
  durationSec: number;
  coverUrls: string[];
  isOwner: boolean;
  saved: boolean;
  createdAt: string;
}

export interface PlaylistImport {
  status: 'queued' | 'resolving' | 'downloading' | 'completed' | 'failed' | 'cancelled';
  running: boolean;
  url: string;
  total: number;
  done: number;
  failed: number;
}

export interface PlaylistDetail extends Playlist {
  import: PlaylistImport | null;
}

export interface PendingTrack {
  id: string;
  url: string;
  title: string | null;
  status: TaskStatus;
  progress: number;
  position: number;
  reason: 'daily_limit' | 'storage_limit' | null;
}

export type PlaylistItem = { id: string; position: number } & ({ track: PlaylistTrack; pending: null } | { track: null; pending: PendingTrack });

export interface Artist {
  id: string;
  name: string;
  imageUrl: string | null;
  subscribed: boolean;
  subscriberCount: number;
}

export interface Album {
  id: string;
  name: string;
  coverUrl: string | null;
  releaseYear: number | null;
  artists: ArtistRef[];
}

export interface ArtistDetail extends Artist {
  topTracks: Track[];
  albums: Album[];
}

export interface AlbumDetail extends Album {
  tracks: Track[];
}

export interface YoutubeResult {
  type: 'song' | 'video';
  videoId: string;
  url: string;
  title: string;
  channel: string;
  artists?: string[];
  album?: string | null;
  views?: string | null;
  thumbnailUrl: string | null;
  durationSec: number | null;
  downloaded: boolean;
  mediaId: string | null;
}

export interface OnlineAlbum {
  type: 'album';
  browseId: string;
  playlistId: string | null;
  title: string;
  artists: string[];
  year: string | null;
  albumType: string | null;
  thumbnailUrl: string | null;
  url: string | null;
}

export interface OnlineArtist {
  type: 'artist';
  browseId: string;
  name: string;
  thumbnailUrl: string | null;
  url: string;
}

export interface OnlinePlaylist {
  type: 'playlist';
  playlistId: string;
  title: string;
  author: string | null;
  itemCount: string | null;
  thumbnailUrl: string | null;
  url: string;
}

export interface OnlinePlaylistDetail {
  playlistId: string;
  title: string;
  author: string | null;
  description: string | null;
  year: string | null;
  thumbnailUrl: string | null;
  trackCount: number;
  missing: number;
  durationSec: number;
  url: string;
}

export interface OnlinePlaylistTrack extends YoutubeResult {
  position: number;
}

export interface OnlineResults {
  top: YoutubeResult | OnlineAlbum | OnlineArtist | null;
  topSongs: YoutubeResult[];
  songs: YoutubeResult[];
  videos: YoutubeResult[];
  albums: OnlineAlbum[];
  artists: OnlineArtist[];
  playlists: OnlinePlaylist[];
}

export interface LibraryResults {
  songs: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
}

export type Section =
  | { id: string; title: string; subtitle: string | null; kind: 'quick_picks' | 'tracks'; items: Track[] }
  | { id: string; title: string; subtitle: string | null; kind: 'playlists'; items: Playlist[] }
  | { id: string; title: string; subtitle: string | null; kind: 'artists'; items: Artist[] };

export interface Explore {
  newReleases: Track[];
  charts: Track[];
  moods: string[];
  genres: string[];
}

export interface RelatedResults {
  library: Track[];
  online: YoutubeResult[];
}

export interface SearchResults {
  online: OnlineResults | null;
  library: LibraryResults | null;
}

export type SearchScope = 'online' | 'library';
export type SearchType = 'all' | 'songs' | 'videos' | 'albums' | 'artists' | 'playlists';

export type TaskStatus = 'queued' | 'downloading' | 'uploading' | 'completed' | 'failed' | 'cancelled';

export interface Task {
  id: string;
  url: string;
  status: TaskStatus;
  progress: number;
  title: string | null;
  mediaId: string | null;
  errorMessage: string | null;
  retryCount: number;
  createdAt: string;
  playlistTaskId: string | null;
  username?: string | null;
}

export interface DownloadResponse {
  type: 'track' | 'playlist';
  taskId?: string;
  playlistTaskId?: string;
  mediaId?: string;
}

export interface ProgressEvent {
  taskId: string;
  status: TaskStatus;
  progress: number | null;
  title: string | null;
  error: string | null;
  url: string | null;
  mediaId: string | null;
}

export interface Lyrics {
  plain: string | null;
  synced: string | null;
}

export interface Page<T> {
  data: T[];
  nextCursor: string | null;
}

export interface ServiceHealth {
  name: string;
  status: 'up' | 'down';
  latencyMs: number | null;
}

export interface AdminHealth {
  services: ServiceHealth[];
  http: { p95Ms: number | null; p99Ms: number | null; errorRate: number | null };
  links: OpsLink[];
}

export interface OpsLink {
  name: string;
  description: string;
  url: string;
  dashboardUrl?: string;
  status: 'up' | 'down' | 'manual';
}

export interface DiscoverySource {
  source: 'charts' | 'genre' | 'artist' | 'picks' | 'playlist';
  label: string;
  found: number;
  queued: number;
  skipped: number;
  error: string | null;
}

export interface DiscoveryStatus {
  settings: Record<string, unknown>;
  requestedAt: string | null;
  lastRun: { startedAt: string; finishedAt: string | null; trigger: 'manual' | 'schedule'; error: string | null; sources: DiscoverySource[]; taskIds: string[]; playlistTaskIds: string[] } | null;
  counts: Record<TaskStatus, number>;
  tasks: Task[];
}

export interface Alert {
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  status?: { state: string };
}

export interface AdminUser extends User {
  isActive: boolean;
  lastSeen?: string | null;
  storage: { usedBytes: number; quotaBytes: number | null; custom: boolean };
  permissions: { canDownload: boolean; dailyDownloadLimit: number | null; maxQuality: string | null };
}

export interface ServerMetrics {
  cpu: { usage: number | null; cores: number | null; load1: number | null };
  memory: { totalBytes: number | null; availableBytes: number | null };
  swap: { totalBytes: number | null; freeBytes: number | null };
  uptimeSec: number | null;
  network: { rxBytesPerSec: number | null; txBytesPerSec: number | null };
  disks: Disk[];
  coldStorageDir: string | null;
}

export interface Disk {
  mount: string;
  device: string;
  fstype: string;
  sizeBytes: number;
  availBytes: number | null;
}

export type TimePoint = [number, number | null];

export interface ServerHistory {
  range: string;
  step: number;
  cpu: TimePoint[];
  memory: TimePoint[];
  swap: TimePoint[];
  network: { rx: TimePoint[]; tx: TimePoint[] };
  disks: { mount: string; points: TimePoint[] }[];
  requests: TimePoint[];
  p95: TimePoint[];
  downloads: { completed: TimePoint[]; failed: TimePoint[] };
}

export interface Session {
  id: string;
  device: string;
  userAgent: string | null;
  ip: string | null;
  startedAt: string;
  lastActiveAt: string;
  current: boolean;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string | null;
  targetType: string | null;
  targetId: string | null;
  details: Record<string, unknown> | null;
  ip: string | null;
  createdAt: string;
}

export interface QueueStatus {
  paused: boolean;
  queues: { name: string; messages: number; consumers: number }[];
  scheduler: { job: string; ok: number; error: number }[];
}

export interface DeadLetter {
  id: string;
  queue: string | null;
  reason: string | null;
  deaths: number;
  url: string | null;
  title: string | null;
  error: string | null;
}

export interface YtdlpHealth {
  status: { version: string | null; latest: string | null; checkedAt: string | null; updating: boolean; lastUpdate: { at: string; ok: boolean; output: string } | null } | null;
  lastSuccessAt: string | null;
  last24h: { completed: number; failed: number; successRate: number | null };
  topErrors: { message: string; count: number }[];
}

export interface StorageReport {
  tiers: {
    hot: { disk: Disk | null; holds: string };
    cold: { path: string | null; disk: Disk | null; holds: string };
  };
  databaseBytes: number;
  library: { tracks: number; bytes: number };
  byFormat: { format: string | null; quality: string | null; tracks: number; bytes: number }[];
  largest: { id: string; title: string; fileSize: number; format: string | null; quality: string | null; playCount: number }[];
  cleanup: { enabled: boolean; unplayedDays: number; lastRunAt: string | null; preview: { days: number; count: number; bytes: number; sample: { id: string; title: string; fileSize: number; createdAt: string }[] } };
}

export interface Analytics {
  days: number;
  totals: { plays: number; listeners: number };
  daily: { day: string; plays: number; listeners: number; downloads: number; signups: number }[];
  topTracks: { id: string; title: string; plays: number; listeners: number }[];
  topArtists: { id: string; name: string; plays: number }[];
  topUsers: { id: string; username: string; plays: number }[];
  searchMisses: { term: string; count: number }[];
}

export interface ScraperStatus {
  health: 'up' | 'down';
  stats: { config: { cacheTtlSec: number; timeoutSec: number; maxConcurrency: number; retries: number }; cache: { entries: number; hits: number; misses: number } } | null;
  settings: Record<string, number>;
  routes: { route: string; rps: number; p95Ms: number | null }[];
  upstreamErrors: { source: string; count: number }[];
}

export interface ScraperRun {
  status: number;
  durationMs: number;
  body: unknown;
}

export interface TraceSummary {
  traceId: string;
  service: string | null;
  name: string | null;
  startedAt: string;
  durationMs: number;
}

export interface LogLine {
  at: string;
  service: string | null;
  level: string | null;
  line: string;
}

export type Settings = Record<string, unknown>;

export interface RecommenderParams {
  content_weight: number;
  factors: number;
  reg: number;
  iterations: number;
  alpha: number;
  half_life_days: number;
  window_days: number;
}

export interface RecommenderRun {
  version: number;
  trainedAt: string;
  users: number;
  items: number;
  interactions?: number;
  density?: number;
  seconds: number;
  loadSeconds?: number;
  params?: RecommenderParams;
  loss?: number[];
}

export interface RecommenderInsights {
  status: {
    state: 'idle' | 'loading' | 'training' | 'failed';
    startedAt?: string;
    finishedAt?: string;
    iteration?: number;
    loss?: number[];
    params?: RecommenderParams;
    error?: string | null;
  };
  model: { version: number; trainedAt: string | null; users: number; items: number };
  params: RecommenderParams;
  runs: RecommenderRun[];
  data: {
    totals: { interactions: number; users: number; items: number; positive: number };
    weights: { weight: number; count: number }[];
    daily: { day: string; count: number }[];
    topItems: { mediaId: string; title: string | null; score: number; interactions: number }[];
    recent: { occurredAt: string; user: string | null; title: string | null; weight: number }[];
  };
}
