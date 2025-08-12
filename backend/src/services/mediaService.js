import { query } from '../config/database.js';

async function createMedia(mediaData) {
  const {
    title, description, url, platform, duration, filePath,
    thumbnailPath, fileSize, format, quality, status, uploadedBy, metadata
  } = mediaData;

  const result = await query(
    `INSERT INTO media
      (title, description, url, platform, duration, file_path, thumbnail_path, file_size,
       format, quality, status, uploaded_by, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING id`,
    [title, description, url, platform, duration, filePath, thumbnailPath, fileSize,
      format, quality, status, uploadedBy, metadata]
  );

  return result.rows[0]; // contains the id and any other returned fields
}

async function fetchMediaDetails(mediaId, userId = null) {
  const mediaQuery = `
    SELECT 
      m.*,
      u.username as uploader_username,
      (SELECT COUNT(*) FROM likes l WHERE l.media_id = m.id) as likes_count,
      ${userId ? `(SELECT COUNT(*) FROM likes l WHERE l.media_id = m.id AND l.user_id = $2) as user_liked` : 'false as user_liked'}
    FROM media m
    LEFT JOIN users u ON m.uploaded_by = u.id
    WHERE m.id = $1 AND m.status = 'completed'
  `;
  const params = [mediaId];
  if (userId) params.push(userId);

  const mediaResult = await query(mediaQuery, params);
  if (mediaResult.rows.length === 0) return null;

  const media = mediaResult.rows[0];

  // Watch progress:
  let watchProgress = null;
  if (userId) {
    const progRes = await query(
      `SELECT watch_time, last_position, completed
       FROM user_history
       WHERE user_id = $1 AND media_id = $2
       ORDER BY played_at DESC LIMIT 1`,
      [userId, mediaId]
    );
    if (progRes.rows.length > 0) {
      watchProgress = progRes.rows[0];
    }
  }

  return {
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
    userLiked: userId ? media.user_liked > 0 : false,
    uploaderUsername: media.uploader_username,
    createdAt: media.created_at,
    metadata: media.metadata,
    watchProgress
  };
}


export {
  createMedia,
  fetchMediaDetails
};
