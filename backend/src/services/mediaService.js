import {query} from '../config/database.js';

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

export {
  createMedia,
};
