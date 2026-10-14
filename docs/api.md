# OpenWav API v1

Base path `/api/v1`. JSON only. Auth is `Authorization: Bearer <accessToken>` unless marked *public*.

Success: `{ "data": ... }`. Lists add `"nextCursor": string | null` and take `?cursor=&limit=` (limit ≤ 100, default 20).
Error: `{ "error": { "code": "VALIDATION" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" | "INTERNAL", "message": string, "details"?: any } }` with the matching HTTP status. `401` with code `TOKEN_EXPIRED` means refresh and retry once.

## Shapes

```ts
User      { id, username, email, role: 'user' | 'admin', createdAt }
ArtistRef { id, name }
AlbumRef  { id, name }
Track     { id, title, artists: ArtistRef[], album: AlbumRef | null, durationSec: number | null, thumbnailUrl: string | null, liked: boolean, playCount: number }
Playlist  { id, name, description, isPublic, owner: { id, username } | null, trackCount, durationSec, coverUrls: string[], isOwner, saved, createdAt }
Artist    { id, name, imageUrl, subscribed, subscriberCount }
Album     { id, name, coverUrl, releaseYear: number | null, artists: ArtistRef[] }
YoutubeResult { type: 'song' | 'video', videoId, url, title, channel, artists, album, views, thumbnailUrl, durationSec: number | null, downloaded: boolean, mediaId: string | null }
Section   { id, title, subtitle: string | null, kind: 'quick_picks' | 'tracks' | 'playlists' | 'artists', items: Track[] | Playlist[] | Artist[] }
Task      { id, url, status: 'queued'|'downloading'|'uploading'|'completed'|'failed'|'cancelled', progress, title, mediaId, errorMessage, retryCount, createdAt, playlistTaskId }
```

## Auth
| Method | Path | Body | Returns |
|---|---|---|---|
| POST | /auth/register *public* | `{ username, email, password }` | `{ user, tokens: { accessToken, refreshToken } }` |
| POST | /auth/login *public* | `{ email, password }` | same |
| POST | /auth/refresh *public* | `{ refreshToken }` | same (refresh token rotates) |
| POST | /auth/logout *public* | `{ refreshToken }` | 204 |
| GET | /auth/me | | `User` |
| PATCH | /auth/me | `{ username?, currentPassword?, newPassword? }` | `User` |
| GET/PATCH | /me/preferences | `{ [key]: json }` | `{ [key]: json }` |

Password: 8–128 chars, at least one letter and one digit.

## Browse
| GET | /home | | `Section[]` (personalised; popularity fallback) |
| GET | /explore | | `{ newReleases: Track[], charts: Track[], moods: string[], genres: string[] }` |
| GET | /explore/moods/:mood | | `Track[]` (mood or genre label, case-insensitive) |
| GET | /media/:id | | `Track` |
| GET | /media/:id/related | | `Track[]` |
| GET | /media/:id/lyrics | | `{ plain: string | null, synced: string | null }` |
| POST | /media/:id/stream | | `{ url, expiresAt }` signed nginx URL, supports Range |
| PUT/DELETE | /media/:id/like | | `{ liked }` |
| GET | /artists/:id | | `Artist & { topTracks: Track[], albums: Album[] }` |
| PUT/DELETE | /artists/:id/subscription | | `{ subscribed }` |
| GET | /albums/:id | | `Album & { tracks: Track[] }` |

## Search
| GET | /search?q=&scope=online\|library&type=all\|songs\|videos\|albums\|artists\|playlists&limit= | | `{ online: { top, songs, videos, albums, artists, playlists } \| null, library: { songs: Track[], artists: Artist[], albums: Album[], playlists: Playlist[] } \| null }`. `scope` defaults to `online` (YouTube Music through the scraper); songs and videos are marked `downloaded`/`mediaId` when already in the library. Online albums and playlists carry an importable `url` for `POST /playlists/import`. `limit` defaults to 6 per type for `all`, otherwise 20. |
| GET | /search/suggestions?q= | | `string[]` |

## Library
| GET | /library/liked | | `Track[]` cursor |
| GET | /library/history | | `(Track & { playedAt })[]` cursor |
| GET | /library/playlists | | `Playlist[]` (owned first, then saved) |
| GET | /library/artists | | `Artist[]` |
| GET | /library/albums | | `Album[]` |

## Playlists
| POST | /playlists | `{ name, description?, isPublic? }` | `Playlist` |
| GET | /playlists/:id *public if isPublic* | | `Playlist & { tracks: (Track & { position, addedAt })[] }` |
| PATCH | /playlists/:id | `{ name?, description?, isPublic? }` | `Playlist` (owner) |
| DELETE | /playlists/:id | | 204 (owner) |
| POST | /playlists/:id/tracks | `{ mediaId }` | 201 (owner) |
| DELETE | /playlists/:id/tracks/:mediaId | | 204 (owner) |
| PUT | /playlists/:id/order | `{ mediaIds: string[] }` | 204 (owner) |
| PUT/DELETE | /playlists/:id/save | | `{ saved }` |
| POST | /playlists/import | `{ url, name?, isPublic? }` | `{ playlistId, playlistTaskId }` |

## Downloads and progress
| POST | /downloads | `{ url, format?, quality?, playlistId? }` | `{ type: 'track'|'playlist', taskId?, playlistTaskId?, mediaId? }` (`mediaId` set when already in the library, 200; otherwise 202) |
| GET | /downloads | | `Task[]` cursor (own) |
| GET | /downloads/:id | | `Task` (own) |
| POST | /tickets | `{ purpose: 'progress' }` | `{ ticket, expiresAt }` (60 s, single purpose) |
| GET | /progress?ticket= | | SSE stream of `{ taskId, status, progress, title, error }` for the caller's tasks |

## Events
| POST | /events | `{ events: TrackingEvent[] }` (≤ 50) | 202. Types: play_start, play_progress, play_complete, skip, like, unlike, search, add_to_playlist, remove_from_playlist, download_request, page_view. Disabled or sampled-out events are dropped server side. |

## Admin (role admin)
| GET | /admin/stats | | users, media, downloads, storage, events counters |
| GET | /admin/health | | `{ services: { name, status: 'up'|'down', latencyMs }[], http: { p95Ms, p99Ms, errorRate }, links: { name, description, url, dashboardUrl?, status: 'up'|'down'|'manual' }[] }` |
| GET | /admin/alerts | | active Alertmanager alerts |
| GET | /admin/users?search=&role=&status=active\|banned | | cursor |
| PATCH | /admin/users/:id | `{ role?, isActive? }` | `User` |
| DELETE | /admin/users/:id | | 204 |
| GET | /admin/downloads?status=a,b&userId= | | `Task & { username }` cursor |
| POST | /admin/downloads/:id/cancel · /retry | | `Task` |
| POST | /admin/downloads/bulk | `{ action: 'cancel'|'retry'|'delete', ids }` | `{ affected }` |
| GET | /admin/media?search= | | cursor |
| PATCH | /admin/media/:id | `{ title?, artistNames? }` | `Track` |
| DELETE | /admin/media/:id | | 204 (also deletes the storage object) |
| GET | /admin/settings | | `{ [key]: value }` merged with defaults |
| PATCH | /admin/settings | `{ [key]: value }` | same |
| POST | /admin/recommender/retrain | | 202 |
| GET | /admin/discovery | | `{ settings, requestedAt, lastRun: { startedAt, finishedAt, trigger, error, sources: { source, label, found, queued, skipped, error }[], taskIds, playlistTaskIds } | null, counts, tasks: Task[] }` |
| POST | /admin/discovery/run | | 202 `{ requestedAt }` (the scheduler starts the run within a minute) |
| GET | /admin/ytdlp/cookies | | `{ configured, entries, domains, expiresAt, updatedAt }` (cookie values are never returned) |
| PUT | /admin/ytdlp/cookies | `{ content }` Netscape cookies.txt, ≤ 90 KB | same; only youtube.com and google.com lines are kept, 400 if there are none |
| DELETE | /admin/ytdlp/cookies | | 204 |

## Streaming

`POST /media/:id/stream` returns `https://<host>/stream/<objectKey>?md5=<sig>&expires=<unix>`. nginx validates the signature (`secure_link`, md5 over `expires + uri + " " + STREAM_SIGNING_SECRET`, base64url), slices into 1 MB ranges, caches on disk and serves with `sendfile`. Covers are served from `/covers/<key>` with immutable caching. The API never touches audio bytes.
