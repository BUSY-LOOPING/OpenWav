import { forbidden, notFound } from '../lib/errors.js';

export function createPlaylistService({ prisma }) {
  async function owned(playlistId, userId) {
    const playlist = await prisma.playlist.findUnique({ where: { id: playlistId }, select: { id: true, createdBy: true } });
    if (!playlist) throw notFound('Playlist');
    if (playlist.createdBy !== userId) throw forbidden('Only the owner can change this playlist');
    return playlist;
  }

  async function recalc(tx, playlistId) {
    const [{ count, duration }] = await tx.$queryRaw`
      SELECT count(*)::int AS count, coalesce(sum(m.duration), 0)::int AS duration
      FROM playlist_tracks pt JOIN media m ON m.id = pt.media_id WHERE pt.playlist_id = ${playlistId}::uuid`;
    await tx.playlist.update({ where: { id: playlistId }, data: { totalTracks: count, totalDuration: duration } });
  }

  return {
    owned,
    createOwned: (userId, { name, description = null, isPublic = true }) =>
      prisma.playlist.create({ data: { name, description, isPublic, createdBy: userId } }),

    addTrack: async (playlistId, mediaId, userId) => {
      await owned(playlistId, userId);
      const media = await prisma.media.findFirst({ where: { id: mediaId, status: 'completed' }, select: { id: true } });
      if (!media) throw notFound('Track');
      await prisma.$transaction(async (tx) => {
        const { _max } = await tx.playlistTrack.aggregate({ where: { playlistId }, _max: { position: true } });
        await tx.playlistTrack.upsert({
          where: { playlistId_mediaId: { playlistId, mediaId } },
          create: { playlistId, mediaId, addedBy: userId, position: (_max.position ?? 0) + 1 },
          update: {},
        });
        await recalc(tx, playlistId);
      });
    },

    removeTrack: async (playlistId, mediaId, userId) => {
      await owned(playlistId, userId);
      await prisma.$transaction(async (tx) => {
        await tx.playlistTrack.deleteMany({ where: { playlistId, mediaId } });
        await tx.$executeRaw`
          UPDATE playlist_tracks pt SET position = r.n
          FROM (SELECT id, row_number() OVER (ORDER BY position) AS n FROM playlist_tracks WHERE playlist_id = ${playlistId}::uuid) r
          WHERE pt.id = r.id`;
        await recalc(tx, playlistId);
      });
    },

    reorder: async (playlistId, mediaIds, userId) => {
      await owned(playlistId, userId);
      await prisma.$transaction(
        mediaIds.map((mediaId, i) => prisma.playlistTrack.updateMany({ where: { playlistId, mediaId }, data: { position: i + 1 } })),
      );
    },
  };
}
