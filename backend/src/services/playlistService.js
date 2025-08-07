// src/services/playlistService.js
import { query, transaction } from '../config/database.js';
import {logger} from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

class PlaylistService {
  // Create a new playlist
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

  // Get playlist by ID with tracks
  async getPlaylistById(id, userId = null) {
    const result = await query(
      `SELECT 
        p.*,
        json_agg(
          json_build_object(
            'id', m.id,
            'title', m.title,
            'duration', m.duration,
            'file_path', m.file_path,
            'position', pt.position,
            'added_at', pt.added_at,
            'artists', (
              SELECT json_agg(json_build_object('id', a.id, 'name', a.name, 'role', ma.role))
              FROM media_artists ma 
              JOIN artists a ON ma.artist_id = a.id 
              WHERE ma.media_id = m.id
            )
          ) ORDER BY pt.position
        ) FILTER (WHERE m.id IS NOT NULL) as tracks
       FROM playlists p
       LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
       LEFT JOIN media m ON pt.media_id = m.id
       WHERE p.id = $1 AND (p.is_public = true OR p.created_by = $2)
       GROUP BY p.id`,
      [id, userId]
    );
    return result.rows[0] || null;
  }

  // Add track to playlist
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

  // Remove track from playlist
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

  // Create playlist from Billboard chart
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

  // Get user's playlists
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

  // Search playlists
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

  // Update playlist totals (track count and duration)
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

  // Delete playlist
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
}

export default new PlaylistService();
