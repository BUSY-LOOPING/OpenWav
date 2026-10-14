export function trackInclude(userId) {
  return {
    artists: { orderBy: { position: 'asc' }, include: { artist: { select: { id: true, name: true } } } },
    albums: { include: { album: { select: { id: true, name: true } } }, take: 1 },
    likes: userId ? { where: { userId }, select: { userId: true } } : false,
  };
}

export function createSerializers() {
  const coverUrl = (path) => (!path ? null : /^https?:\/\//.test(path) ? path : `/covers/${path}`);

  const track = (m) => ({
    id: m.id,
    title: m.title,
    artists: (m.artists ?? []).map((a) => ({ id: a.artist.id, name: a.artist.name })),
    album: m.albums?.[0] ? { id: m.albums[0].album.id, name: m.albums[0].album.name } : null,
    durationSec: m.duration ?? null,
    thumbnailUrl: coverUrl(m.thumbnailPath),
    liked: (m.likes?.length ?? 0) > 0,
    playCount: m.playCount ?? 0,
  });

  const playlist = (p, userId) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    isPublic: p.isPublic,
    owner: p.owner ? { id: p.owner.id, username: p.owner.username } : null,
    trackCount: p.totalTracks,
    durationSec: p.totalDuration,
    coverUrls: p.coverImageUrl ? [coverUrl(p.coverImageUrl)] : (p.tracks ?? []).map((t) => coverUrl(t.media?.thumbnailPath)).filter(Boolean).slice(0, 4),
    isOwner: !!userId && p.createdBy === userId,
    saved: (p.saves?.length ?? 0) > 0,
    createdAt: p.createdAt,
  });

  const artist = (a, userId) => ({
    id: a.id,
    name: a.name,
    imageUrl: coverUrl(a.imageUrl),
    subscribed: !!userId && (a.subscribers?.length ?? 0) > 0,
    subscriberCount: a._count?.subscribers ?? 0,
  });

  const album = (a) => ({
    id: a.id,
    name: a.name,
    coverUrl: coverUrl(a.coverImageUrl ?? a.media?.[0]?.media?.thumbnailPath),
    releaseYear: a.releaseDate ? a.releaseDate.getUTCFullYear() : null,
    artists: [...new Map((a.media ?? []).flatMap((ma) => ma.media?.artists ?? []).map((x) => [x.artist.id, { id: x.artist.id, name: x.artist.name }])).values()],
  });

  const user = (u) => ({ id: u.id, username: u.username, email: u.email, role: u.role, createdAt: u.createdAt });

  const task = (t) => ({
    id: t.id,
    url: t.url,
    status: t.status,
    progress: t.progress,
    title: t.media?.title ?? null,
    mediaId: t.mediaId,
    errorMessage: t.errorMessage,
    retryCount: t.retryCount,
    createdAt: t.createdAt,
    playlistTaskId: t.playlistTaskId,
    ...(t.requester !== undefined ? { username: t.requester?.username ?? null } : {}),
  });

  return { coverUrl, track, playlist, artist, album, user, task };
}

export const playlistInclude = (userId) => ({
  owner: { select: { id: true, username: true } },
  saves: userId ? { where: { userId }, select: { userId: true } } : false,
  tracks: { take: 4, orderBy: { position: 'asc' }, include: { media: { select: { thumbnailPath: true } } } },
});

export async function tracksByIds(prisma, ids, userId) {
  if (!ids.length) return [];
  const rows = await prisma.media.findMany({ where: { id: { in: ids }, status: 'completed' }, include: trackInclude(userId) });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean);
}
