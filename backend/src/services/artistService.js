// src/services/artistService.js
import { query } from '../config/database.js';
import {logger} from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

class ArtistService {
  // Create or get existing artist
  async createOrGetArtist(name, metadata = {}) {
    try {
      const slug = this.generateSlug(name);
      
      // Check if artist already exists
      const existing = await query(
        'SELECT * FROM artists WHERE slug = $1 OR LOWER(name) = LOWER($2)',
        [slug, name]
      );

      if (existing.rows.length > 0) {
        return existing.rows[0];
      }

      // Create new artist
      const result = await query(
        `INSERT INTO artists (name, slug, image_url, genres, bio, social_links, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          name,
          slug,
          metadata.image_url || null,
          metadata.genres || [],
          metadata.bio || null,
          metadata.social_links || {},
          metadata
        ]
      );

      logger.info(`Artist created: ${name}`);
      return result.rows[0];
    } catch (error) {
      logger.error(`Failed to create/get artist ${name}:`, error);
      throw error;
    }
  }

  // Get artist by ID
  async getArtistById(id) {
    const result = await query('SELECT * FROM artists WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  // Search artists
  async searchArtists(searchTerm, limit = 20) {
    const result = await query(
      `SELECT * FROM artists 
       WHERE name ILIKE $1 OR $1 = ANY(genres)
       ORDER BY name
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    return result.rows;
  }

  // Get artist with their media
  async getArtistWithMedia(id) {
    const result = await query(
      `SELECT 
        a.*,
        json_agg(
          json_build_object(
            'id', m.id,
            'title', m.title,
            'duration', m.duration,
            'file_path', m.file_path,
            'role', ma.role
          )
        ) FILTER (WHERE m.id IS NOT NULL) as media
       FROM artists a
       LEFT JOIN media_artists ma ON a.id = ma.artist_id
       LEFT JOIN media m ON ma.media_id = m.id
       WHERE a.id = $1
       GROUP BY a.id`,
      [id]
    );
    return result.rows[0] || null;
  }

  // Link artist to media
  async linkArtistToMedia(artistId, mediaId, role = 'artist') {
    try {
      await query(
        `INSERT INTO media_artists (artist_id, media_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (media_id, artist_id, role) DO NOTHING`,
        [artistId, mediaId, role]
      );
    } catch (error) {
      logger.error(`Failed to link artist ${artistId} to media ${mediaId}:`, error);
      throw error;
    }
  }

  // Generate slug from artist name
  generateSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 100);
  }

  // Update artist metadata
  async updateArtist(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (['name', 'image_url', 'genres', 'bio', 'social_links', 'metadata'].includes(key)) {
        fields.push(`${key} = $${paramCount++}`);
        values.push(updates[key]);
      }
    });

    if (fields.length === 0) return null;

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query(
      `UPDATE artists SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );

    return result.rows[0] || null;
  }
}

export default new ArtistService();
