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

export interface PlaylistDetail extends Playlist {
  tracks: PlaylistTrack[];
}

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
  videoId: string;
  url: string;
  title: string;
  channel: string;
  thumbnailUrl: string;
  durationSec: number | null;
  downloaded: boolean;
  mediaId: string | null;
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

export interface SearchResults {
  songs: Track[];
  artists: Artist[];
  albums: Album[];
  playlists: Playlist[];
  youtube: YoutubeResult[];
}

export type SearchType = 'all' | 'songs' | 'artists' | 'albums' | 'playlists' | 'youtube';

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
}

export type Settings = Record<string, unknown>;
