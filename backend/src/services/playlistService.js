// src/services/playlistService.js
import { query, transaction } from '../config/database.js';
import { logger } from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { fetchMediaDetails } from './mediaService.js';

class PlaylistService {
  async createPlaylist(data) {
    try {
      const result = await query(
        `INSERT INTO playlists (name, description, cover_image_url, is_public, created_by, metadata)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          data.name,
          data.description || null,
          data.cover_image_url || null,
          data.is_public !== false,
          data.created_by,
          data.metadata || {}
        ]
      );

      logger.info(`Playlist created: ${data.name}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Failed to create playlist ${data.name}:`, error);
      throw error;
    }
  }


  async getPlaylistById(id, userId = null) {
    const playlistResult = await query(
      `SELECT p.*
     FROM playlists p
     WHERE p.id = $1
       AND (p.is_public = true OR p.created_by = $2)`,
      [id, userId]
    );

    if (playlistResult.rows.length === 0) {
      return null;
    }

    const playlist = playlistResult.rows[0];

    playlist.tracks = [];

    const tracksResult = await query(
      `SELECT pt.media_id, pt.position, pt.added_at
     FROM playlist_tracks pt
     WHERE pt.playlist_id = $1
     ORDER BY pt.position ASC`,
      [id]
    );
    logger.info(tracksResult);

    for (const row of tracksResult.rows) {
      const media = await fetchMediaDetails(row.media_id, userId);
      if (media) {
        playlist.tracks.push({
          ...media,
          position: row.position,
          added_at: row.added_at
        });
      }
    }

    return playlist;
  }



  async addTrackToPlaylist(playlistId, mediaId, userId, position = null) {
    return transaction(async (client) => {
      // Get next position if not provided
      if (position === null) {
        const posResult = await client.query(
          'SELECT COALESCE(MAX(position), 0) + 1 as next_position FROM playlist_tracks WHERE playlist_id = $1',
          [playlistId]
        );
        position = posResult.rows[0].next_position;
      }

      // Add track
      await client.query(
        `INSERT INTO playlist_tracks (playlist_id, media_id, position, added_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (playlist_id, media_id) DO NOTHING`,
        [playlistId, mediaId, position, userId]
      );

      // Update playlist totals
      await this.updatePlaylistTotals(playlistId, client);

      logger.info(`Track ${mediaId} added to playlist ${playlistId}`);
    });
  }

  async removeTrackFromPlaylist(playlistId, mediaId, userId) {
    return transaction(async (client) => {
      // Check ownership
      const playlist = await client.query(
        'SELECT created_by FROM playlists WHERE id = $1',
        [playlistId]
      );

      if (playlist.rows.length === 0) {
        throw new Error('Playlist not found');
      }

      if (playlist.rows[0].created_by !== userId) {
        throw new Error('Not authorized to modify this playlist');
      }

      // Remove track
      await client.query(
        'DELETE FROM playlist_tracks WHERE playlist_id = $1 AND media_id = $2',
        [playlistId, mediaId]
      );

      // Reorder remaining tracks
      await client.query(
        `UPDATE playlist_tracks 
         SET position = ROW_NUMBER() OVER (ORDER BY position)
         WHERE playlist_id = $1`,
        [playlistId]
      );

      // Update playlist totals
      await this.updatePlaylistTotals(playlistId, client);
    });
  }

  async createPlaylistFromChart(chartData, chartName, userId) {
    try {
      const playlistName = `Billboard ${chartName} - ${chartData.date}`;

      // Create playlist
      const playlist = await this.createPlaylist({
        name: playlistName,
        description: `Billboard ${chartName} chart for ${chartData.date}`,
        is_public: true,
        created_by: userId,
        metadata: {
          source: 'billboard',
          chart_name: chartName,
          chart_date: chartData.date
        }
      });

      logger.info(`Created Billboard playlist: ${playlistName}`);
      return playlist;
    } catch (error) {
      logger.error(`Failed to create Billboard playlist:`, error);
      throw error;
    }
  }

  async getUserPlaylists(userId, includePublic = true) {
    const whereCondition = includePublic
      ? 'WHERE created_by = $1 OR is_public = true'
      : 'WHERE created_by = $1';

    const result = await query(
      `SELECT p.*, 
        (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
       FROM playlists p
       ${whereCondition}
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  async searchPlaylists(searchTerm, limit = 20) {
    const result = await query(
      `SELECT p.*,
        (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
       FROM playlists p
       WHERE is_public = true AND (name ILIKE $1 OR description ILIKE $1)
       ORDER BY name
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    return result.rows;
  }

  async updatePlaylistTotals(playlistId, client = null) {
    const queryFn = client ? (sql, params) => client.query(sql, params) : query;

    await queryFn(
      `UPDATE playlists SET 
        total_tracks = (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = $1),
        total_duration = (SELECT COALESCE(SUM(m.duration), 0) 
                         FROM playlist_tracks pt 
                         JOIN media m ON pt.media_id = m.id 
                         WHERE pt.playlist_id = $1),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [playlistId]
    );
  }

  async deletePlaylist(id, userId) {
    const result = await query(
      'DELETE FROM playlists WHERE id = $1 AND created_by = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      throw new Error('Playlist not found or not authorized');
    }

    return result.rows[0];
  }

  async getPublicPlaylists(limit = 50) {
    try {
      const result = await query(
        `SELECT p.*,
          (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
         FROM playlists p
         WHERE p.is_public = true
         ORDER BY p.created_at DESC
         LIMIT $1`,
        [limit]
      );
      return result.rows;
    } catch (error) {
      logger.error('Failed to fetch public playlists:', error);
      throw error;
    }
  }

  async getLatestChartPlaylist(chartName, userId = null) {
    try {
      const result = await query(
        `SELECT p.id
   FROM playlists p
   WHERE p.is_public = true
     AND p.metadata->>'chart_name' ILIKE $1
     AND (p.metadata->>'chart_date' IS NULL OR p.metadata->>'chart_date' != 'undefined' OR p.metadata->>'chart_date' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$')
   ORDER BY 
     COALESCE(NULLIF(p.metadata->>'chart_date', 'undefined')::date, p.created_at) DESC
   LIMIT 1`,
        [`%${chartName}%`]
      );


      if (result.rows.length === 0) {
        logger.warn(`No playlist found for chart: ${chartName}`);
        return null;
      }

      const playlistId = result.rows[0].id;

      logger.debug(`Matched latest playlist for ${chartName} → ${playlistId}`);

      const playlist = await this.getPlaylistById(playlistId, userId);

      return playlist;

    } catch (error) {
      logger.error(`Failed to fetch latest chart playlist for ${chartName}:`, error);
      throw error;
    }
  }


  async getChartPlaylists(chartName, limit = 10) {
    try {
      const result = await query(
        `SELECT p.*,
          (SELECT COUNT(*) FROM playlist_tracks WHERE playlist_id = p.id) as track_count
         FROM playlists p
         WHERE p.is_public = true
           AND p.metadata->>'chart_name' = $1
         ORDER BY (p.metadata->>'chart_date')::date DESC
         LIMIT $2`,
        [chartName, limit]
      );
      return result.rows;
    } catch (error) {
      logger.error(`Failed to fetch chart playlists for ${chartName}:`, error);
      throw error;
    }
  }
}

export default new PlaylistService();
