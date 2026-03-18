import fs from 'fs-extra';
import path from 'path';
import { query } from '../config/database.js';
import { logger } from '../config/logger.js';
import searchService from '../services/searchService.js';
import { minioPublicClient } from '../config/minio.js';

const streamMedia = async (req, res) => {
  try {
    const { id } = req.params;

    const mediaResult = await query(
      'SELECT id, file_path, format, duration FROM media WHERE id = $1 AND status = $2',
      [id, 'completed']
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Media not found' });
    }

    const media = mediaResult.rows[0];

    if (req.user) {
      trackUserHistory(req.user.id, media.id, media.duration);
    }

    const url = await minioPublicClient.presignedGetObject(
      process.env.MINIO_BUCKET_AUDIO,
      media.file_path,
      24 * 60 * 60
    );

    return res.redirect(url);

  } catch (err) {
    logger.error('Stream error:', err);
    return res.status(500).json({ success: false, message: 'Stream failed' });
  }
};

const getMediaList = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      platform,
      format,
      search,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build query conditions
    let conditions = ['status = $1'];
    let params = ['completed'];
    let paramIndex = 2;

    if (platform) {
      conditions.push(`platform = $${paramIndex}`);
      params.push(platform);
      paramIndex++;
    }

    if (format) {
      conditions.push(`format = $${paramIndex}`);
      params.push(format);
      paramIndex++;
    }

    if (search) {
      conditions.push(`(title ILIKE $${paramIndex} OR description ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    // Validate sort parameters
    const allowedSortFields = ['created_at', 'title', 'duration', 'file_size'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM media ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get media list
    const mediaQuery = `
      SELECT 
        m.*,
        u.username as uploader_username,
        (SELECT COUNT(*) FROM likes l WHERE l.media_id = m.id) as likes_count,
        ${req.user ? `(SELECT COUNT(*) FROM likes l WHERE l.media_id = m.id AND l.user_id = $${paramIndex}) as user_liked` : 'false as user_liked'}
      FROM media m
      LEFT JOIN users u ON m.uploaded_by = u.id
      ${whereClause}
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex + (req.user ? 1 : 0)} OFFSET $${paramIndex + (req.user ? 2 : 1)}
    `;

    if (req.user) {
      params.push(req.user.id);
    }
    params.push(limit, offset);

    const mediaResult = await query(mediaQuery, params);

    res.json({
      success: true,
      data: {
        media: mediaResult.rows.map(row => ({
          id: row.id,
          title: row.title,
          description: row.description,
          duration: row.duration,
          format: row.format,
          quality: row.quality,
          platform: row.platform,
          thumbnailPath: row.thumbnail_path,
          fileSize: row.file_size,
          likesCount: parseInt(row.likes_count),
          userLiked: req.user ? row.user_liked > 0 : false,
          uploaderUsername: row.uploader_username,
          createdAt: row.created_at,
          metadata: row.metadata
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get media list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get media list',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getMediaDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const mediaQuery = `
      SELECT 
        m.*,
        u.username as uploader_username,
        (SELECT COUNT(*) FROM likes l WHERE l.media_id = m.id) as likes_count,
        ${req.user ? `(SELECT COUNT(*) FROM likes l WHERE l.media_id = m.id AND l.user_id = $2) as user_liked` : 'false as user_liked'}
      FROM media m
      LEFT JOIN users u ON m.uploaded_by = u.id
      WHERE m.id = $1 AND m.status = 'completed'
    `;

    const params = [id];
    if (req.user) {
      params.push(req.user.id);
    }

    const mediaResult = await query(mediaQuery, params);

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    const media = mediaResult.rows[0];

    // Get user's watch progress if logged in
    let watchProgress = null;
    if (req.user) {
      const progressResult = await query(
        'SELECT watch_time, last_position, completed FROM user_history WHERE user_id = $1 AND media_id = $2 ORDER BY played_at DESC LIMIT 1',
        [req.user.id, id]
      );
      
      if (progressResult.rows.length > 0) {
        watchProgress = progressResult.rows[0];
      }
    }

    res.json({
      success: true,
      data: {
        media: {
          id: media.id,
          title: media.title,
          description: media.description,
          url: media.url,
          platform: media.platform,
          duration: media.duration,
          format: media.format,
          quality: media.quality,
          thumbnailPath: media.thumbnail_path,
          fileSize: media.file_size,
          likesCount: parseInt(media.likes_count),
          userLiked: req.user ? media.user_liked > 0 : false,
          uploaderUsername: media.uploader_username,
          createdAt: media.created_at,
          metadata: media.metadata,
          watchProgress
        }
      }
    });

  } catch (error) {
    logger.error('Get media details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get media details',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const toggleLike = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if media exists
    const mediaResult = await query(
      'SELECT id FROM media WHERE id = $1 AND status = $2',
      [id, 'completed']
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    // Check if already liked
    const likeResult = await query(
      'SELECT id FROM likes WHERE user_id = $1 AND media_id = $2',
      [userId, id]
    );

    let isLiked;
    
    if (likeResult.rows.length > 0) {
      // Unlike
      await query(
        'DELETE FROM likes WHERE user_id = $1 AND media_id = $2',
        [userId, id]
      );
      isLiked = false;
    } else {
      // Like
      await query(
        'INSERT INTO likes (user_id, media_id) VALUES ($1, $2)',
        [userId, id]
      );
      isLiked = true;
    }

    // Get updated likes count
    const countResult = await query(
      'SELECT COUNT(*) as count FROM likes WHERE media_id = $1',
      [id]
    );

    const likesCount = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      data: {
        liked: isLiked,
        likesCount
      }
    });

  } catch (error) {
    logger.error('Toggle like error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle like',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateWatchProgress = async (req, res) => {
  try {
    const { id } = req.params;
    const { watchTime, currentTime, completed } = req.body;
    const userId = req.user.id;

    // Validate input
    if (typeof watchTime !== 'number' || watchTime < 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid watch time'
      });
    }

    // Check if media exists
    const mediaResult = await query(
      'SELECT duration FROM media WHERE id = $1 AND status = $2',
      [id, 'completed']
    );

    if (mediaResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Media not found'
      });
    }

    const duration = mediaResult.rows[0].duration;

    // Update or insert watch progress
    await query(
      `INSERT INTO user_history (user_id, media_id, watch_time, total_duration, completed, last_position, played_at)
       VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, media_id)
       DO UPDATE SET 
         watch_time = GREATEST(user_history.watch_time, $3),
         completed = $5,
         last_position = $6,
         updated_at = CURRENT_TIMESTAMP`,
      [userId, id, watchTime, duration, completed || false, currentTime || 0]
    );

    res.json({
      success: true,
      message: 'Watch progress updated'
    });

  } catch (error) {
    logger.error('Update watch progress error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update watch progress',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getWatchHistory = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;

    const historyQuery = `
      SELECT 
        h.*,
        m.title,
        m.duration,
        m.thumbnail_path,
        m.format,
        m.platform
      FROM user_history h
      JOIN media m ON h.media_id = m.id
      WHERE h.user_id = $1
      ORDER BY h.played_at DESC
      LIMIT $2 OFFSET $3
    `;

    const historyResult = await query(historyQuery, [req.user.id, limit, offset]);

    // Get total count
    const countResult = await query(
      'SELECT COUNT(*) as total FROM user_history WHERE user_id = $1',
      [req.user.id]
    );

    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: {
        history: historyResult.rows.map(row => ({
          mediaId: row.media_id,
          title: row.title,
          duration: row.duration,
          watchTime: row.watch_time,
          lastPosition: row.last_position,
          completed: row.completed,
          thumbnailPath: row.thumbnail_path,
          format: row.format,
          platform: row.platform,
          playedAt: row.played_at
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    logger.error('Get watch history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get watch history',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

function getContentType(format) {
  const types = {
    'mp4': 'video/mp4',
    'webm': 'video/webm',
    'avi': 'video/x-msvideo',
    'mov': 'video/quicktime',
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'flac': 'audio/flac',
    'm4a': 'audio/mp4'
  };

  return types[format.toLowerCase()] || 'application/octet-stream';
}

async function trackUserHistory(userId, mediaId, duration) {
  try {
    await query(
      `INSERT INTO user_history (user_id, media_id, total_duration, played_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, media_id) 
       DO UPDATE SET played_at = CURRENT_TIMESTAMP`,
      [userId, mediaId, duration]
    );
  } catch (error) {
    logger.error('Failed to track user history:', error);
  }
}

const unifiedSearch = async (req, res) => {
  try {
    const { q: query, limit = 20, includeYoutube = 'true' } = req.query;
    
    if (!query || query.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters long'
      });
    }

    const searchResults = await searchService.unifiedSearch(query.trim(), req.user?.id, {
      limit: parseInt(limit),
      includeYoutube: includeYoutube === 'true'
    });

    res.json({
      success: true,
      data: {
        query: query.trim(),
        results: {
          local: searchResults.local,
          youtube: searchResults.youtube,
          total: searchResults.total
        },
        meta: {
          localCount: searchResults.local.length,
          youtubeCount: searchResults.youtube.length,
          hasMore: searchResults.total >= parseInt(limit)
        }
      }
    });

  } catch (error) {
    logger.error('Unified search error:', error);
    res.status(500).json({
      success: false,
      message: 'Search failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getHomeSections = async (req, res) => {
  try {
    const userId = req.user.id;
    const sections = [];

    const [
      unfinished,
      recentHistory,
      liked,
      allMedia,
    ] = await Promise.all([
      query(
        `SELECT m.id, m.title, m.thumbnail_path, m.duration, m.platform, m.metadata,
                h.last_position, h.watch_time
         FROM user_history h
         JOIN media m ON h.media_id = m.id
         WHERE h.user_id = $1
           AND h.completed = false
           AND h.last_position > 30
           AND m.status = 'completed'
         ORDER BY h.played_at DESC
         LIMIT 6`,
        [userId]
      ),
      query(
        `SELECT m.id, m.title, m.thumbnail_path, m.duration, m.platform, m.metadata,
                h.last_position, h.completed, h.played_at
         FROM user_history h
         JOIN media m ON h.media_id = m.id
         WHERE h.user_id = $1 AND m.status = 'completed'
         ORDER BY h.played_at DESC
         LIMIT 12`,
        [userId]
      ),
      query(
        `SELECT m.id, m.title, m.thumbnail_path, m.duration, m.platform, m.metadata
         FROM likes l
         JOIN media m ON l.media_id = m.id
         WHERE l.user_id = $1 AND m.status = 'completed'
         ORDER BY l.created_at DESC
         LIMIT 6`,
        [userId]
      ),
      query(
        `SELECT id, title, thumbnail_path, duration, platform, metadata
         FROM media
         WHERE status = 'completed'
         ORDER BY created_at DESC
         LIMIT 12`,
        []
      ),
    ]);

    const hasHistory = recentHistory.rows.length > 0;

    if (unfinished.rows.length > 0) {
      sections.push({
        type: 'keep_listening',
        title: 'Keep listening',
        subtitle: null,
        avatar: false,
        tiles: unfinished.rows.map((row, i) => ({
          id: row.id,
          tileType: 'standard',
          size: i === 0 ? 'large' : 'normal',
          title: row.title,
          subtitle: formatPlatform(row.platform),
          thumbnail: row.thumbnail_path,
          href: `/media/${row.id}`,
          resumePosition: row.last_position,
        })),
      });
    }

    if (hasHistory) {
      const listenAgainTiles = recentHistory.rows.slice(0, 6).map((row, i) => ({
        id: row.id,
        tileType: i === 0 ? 'mosaic' : 'standard',
        size: i === 0 ? 'large' : 'normal',
        title: row.title,
        subtitle: formatPlatform(row.platform),
        thumbnail: row.thumbnail_path,
        images: i === 0
          ? recentHistory.rows.slice(0, 4).map(r => r.thumbnail_path).filter(Boolean)
          : undefined,
        href: `/media/${row.id}`,
      }));

      sections.push({
        type: 'listen_again',
        title: 'Listen again',
        subtitle: req.user.username,
        avatar: true,
        tiles: listenAgainTiles,
      });
    }

    if (liked.rows.length > 0) {
      sections.push({
        type: 'liked',
        title: 'From your likes',
        subtitle: null,
        avatar: false,
        tiles: liked.rows.map((row, i) => ({
          id: row.id,
          tileType: 'standard',
          size: i === 0 ? 'large' : 'normal',
          title: row.title,
          subtitle: formatPlatform(row.platform),
          thumbnail: row.thumbnail_path,
          href: `/media/${row.id}`,
        })),
      });
    }

    if (hasHistory && recentHistory.rows.length >= 3) {
      const tags = extractTopTags(recentHistory.rows);
      if (tags.length > 0) {
        const taggedMedia = await query(
          `SELECT id, title, thumbnail_path, duration, platform, metadata
           FROM media
           WHERE status = 'completed'
             AND id NOT IN (
               SELECT media_id FROM user_history WHERE user_id = $1
             )
             AND metadata->'tags' ?| $2
           ORDER BY created_at DESC
           LIMIT 6`,
          [userId, tags]
        );

        if (taggedMedia.rows.length > 0) {
          sections.push({
            type: 'recommended',
            title: 'Recommended for you',
            subtitle: 'Based on your taste',
            avatar: false,
            tiles: taggedMedia.rows.map((row, i) => ({
              id: row.id,
              tileType: 'standard',
              size: i === 0 ? 'large' : 'normal',
              title: row.title,
              subtitle: formatPlatform(row.platform),
              thumbnail: row.thumbnail_path,
              href: `/media/${row.id}`,
            })),
          });
        }
      }
    }

    if (allMedia.rows.length > 0) {
      const historyIds = new Set(recentHistory.rows.map(r => r.id));
      const newTracks = allMedia.rows.filter(r => !historyIds.has(r.id)).slice(0, 6);

      if (newTracks.length > 0) {
        sections.push({
          type: 'new_tracks',
          title: 'New on OpenWav',
          subtitle: null,
          avatar: false,
          tiles: newTracks.map((row, i) => ({
            id: row.id,
            tileType: 'standard',
            size: i === 0 ? 'large' : 'normal',
            title: row.title,
            subtitle: formatPlatform(row.platform),
            thumbnail: row.thumbnail_path,
            href: `/media/${row.id}`,
          })),
        });
      }
    }

    if (sections.length === 0) {
      sections.push({
        type: 'discover',
        title: 'Start listening',
        subtitle: 'Explore OpenWav',
        avatar: false,
        tiles: allMedia.rows.slice(0, 6).map((row, i) => ({
          id: row.id,
          tileType: 'standard',
          size: i === 0 ? 'large' : 'normal',
          title: row.title,
          subtitle: formatPlatform(row.platform),
          thumbnail: row.thumbnail_path,
          href: `/media/${row.id}`,
        })),
      });
    }

    res.json({ success: true, data: { sections } });
  } catch (error) {
    logger.error('Get home sections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get home sections',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

function formatPlatform(platform) {
  const map = { youtube: 'YouTube', soundcloud: 'SoundCloud', vimeo: 'Vimeo', unknown: '' };
  return map[platform] ?? '';
}

function extractTopTags(rows) {
  const freq = {};
  for (const row of rows) {
    const tags = row.metadata?.tags ?? [];
    for (const tag of tags.slice(0, 5)) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag]) => tag);
}


export default {
  streamMedia,
  getMediaList,
  getMediaDetails,
  toggleLike,
  updateWatchProgress,
  getWatchHistory,
  unifiedSearch,
  getHomeSections
};