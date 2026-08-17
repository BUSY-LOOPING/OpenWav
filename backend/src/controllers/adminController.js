import { query, transaction } from '../config/database.js';
import { logger } from '../config/logger.js';
import { publishDownloadJob } from '../services/downloadPublisher.js';
import fs from 'fs-extra';
import path from 'path';

const getDashboardStats = async (req, res) => {
  try {
    const [userStats, mediaStats, downloadStats, storageStats] = await Promise.all([
      getUserStats(),
      getMediaStats(),
      getDownloadStats(),
      getStorageStats(),
    ]);

    res.json({
      success: true,
      data: {
        users: userStats,
        media: mediaStats,
        downloads: downloadStats,
        storage: storageStats,
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const {
      limit = 20,
      cursor,        // created_at::id cursor instead of offset
      search,
      role,
      status,
      sortOrder = 'DESC',
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const conditions = [];
    const params = [];
    let i = 1;

    if (search) {
      conditions.push(`(u.username ILIKE $${i} OR u.email ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (role) {
      conditions.push(`u.role = $${i++}`);
      params.push(role);
    }
    if (status !== undefined) {
      conditions.push(`u.is_active = $${i++}`);
      params.push(status === 'active');
    }

    // Cursor-based pagination — avoids OFFSET degradation on large tables
    // Cursor format: "created_at_ISO__uuid"
    if (cursor) {
      const [cursorTs, cursorId] = cursor.split('__');
      const op = sortDir === 'DESC' ? '<' : '>';
      conditions.push(
        `(u.created_at, u.id) ${op} ($${i++}::timestamptz, $${i++}::uuid)`
      );
      params.push(cursorTs, cursorId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    // Single query — aggregate stats in subqueries to avoid N+1
    // LEFT JOIN LATERAL is more efficient than correlated subqueries for per-row aggregates
    const usersResult = await query(
      `SELECT
         u.id, u.username, u.email, u.role,
         u.is_active, u.email_verified,
         u.last_login, u.last_seen, u.created_at,
         COALESCE(ms.media_count, 0)        AS media_count,
         COALESCE(ms.total_storage, 0)      AS total_storage,
         COALESCE(ds.download_count, 0)     AS download_count
       FROM users u
       LEFT JOIN LATERAL (
         SELECT COUNT(*)            AS media_count,
                COALESCE(SUM(file_size), 0) AS total_storage
         FROM media
         WHERE uploaded_by = u.id
       ) ms ON true
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS download_count
         FROM download_tasks
         WHERE requested_by = u.id
       ) ds ON true
       ${where}
       ORDER BY u.created_at ${sortDir}, u.id ${sortDir}
       LIMIT $${i}`,
      [...params, parsedLimit + 1]  // fetch one extra to determine if there's a next page
    );

    const rows = usersResult.rows;
    const hasNextPage = rows.length > parsedLimit;
    if (hasNextPage) rows.pop(); // remove the extra row

    const nextCursor = hasNextPage
      ? `${rows.at(-1).created_at.toISOString()}__${rows.at(-1).id}`
      : null;

    res.json({
      success: true,
      data: {
        users: rows.map((u) => ({
          id:             u.id,
          username:       u.username,
          email:          u.email,
          role:           u.role,
          isActive:       u.is_active,
          emailVerified:  u.email_verified,
          lastLogin:      u.last_login,
          lastSeen:       u.last_seen,
          createdAt:      u.created_at,
          stats: {
            mediaCount:   parseInt(u.media_count),
            downloadCount: parseInt(u.download_count),
            storageUsed:  parseInt(u.total_storage),
          },
        })),
        pagination: {
          limit:     parsedLimit,
          nextCursor,
          hasNextPage,
        },
      },
    });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, isActive } = req.body;

    const existing = await query('SELECT id, role FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.user.id === id && role && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Cannot change your own admin role' });
    }

    const updates = [];
    const params = [];
    let i = 1;

    if (username !== undefined) { updates.push(`username = $${i++}`); params.push(username); }
    if (email    !== undefined) { updates.push(`email = $${i++}`);    params.push(email); }
    if (role     !== undefined) { updates.push(`role = $${i++}`);     params.push(role); }
    if (isActive !== undefined) { updates.push(`is_active = $${i++}`); params.push(isActive); }

    if (updates.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid fields to update' });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const result = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${i} RETURNING id, username, email, role, is_active, updated_at`,
      params,
    );

    logger.info(`User ${id} updated by admin ${req.user.username}`);
    res.json({ success: true, message: 'User updated successfully', data: { user: result.rows[0] } });
  } catch (error) {
    logger.error('Update user error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'Username or email already exists' });
    }
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }

    const existing = await query('SELECT username FROM users WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const username = existing.rows[0].username;

    await transaction(async (client) => {
      const media = await client.query(
        'SELECT file_path, thumbnail_path FROM media WHERE uploaded_by = $1',
        [id],
      );

      for (const row of media.rows) {
        for (const p of [row.file_path, row.thumbnail_path]) {
          if (p && (await fs.pathExists(p))) {
            await fs.unlink(p).catch((e) => logger.warn(`File delete failed: ${e.message}`));
          }
        }
      }

      await client.query('DELETE FROM users WHERE id = $1', [id]);
    });

    logger.info(`User ${username} (${id}) deleted by admin ${req.user.username}`);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const getDownloadTasks = async (req, res) => {
  try {
    const {
      limit = 20,
      cursor,
      status,
      userId,
      sortOrder = 'DESC',
    } = req.query;

    const parsedLimit = Math.min(parseInt(limit) || 20, 100);
    const sortDir = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const conditions = [];
    const params = [];
    let i = 1;

    if (status) {
      conditions.push(`dt.status = $${i++}`);
      params.push(status);
    }
    if (userId) {
      conditions.push(`dt.requested_by = $${i++}`);
      params.push(userId);
    }
    if (cursor) {
      const [cursorTs, cursorId] = cursor.split('__');
      const op = sortDir === 'DESC' ? '<' : '>';
      conditions.push(
        `(dt.created_at, dt.id) ${op} ($${i++}::timestamptz, $${i++}::uuid)`
      );
      params.push(cursorTs, cursorId);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const tasksResult = await query(
      `SELECT
         dt.id,
         dt.url,
         dt.status,
         dt.progress,
         dt.quality,
         dt.format,
         dt.error_message,
         dt.retry_count,
         dt.media_id,
         dt.started_at,
         dt.completed_at,
         dt.created_at,
         u.username,
         m.title AS media_title
       FROM download_tasks dt
       LEFT JOIN users u  ON dt.requested_by = u.id
       LEFT JOIN media m  ON dt.media_id     = m.id
       ${where}
       ORDER BY dt.created_at ${sortDir}, dt.id ${sortDir}
       LIMIT $${i}`,
      [...params, parsedLimit + 1]
    );

    const rows = tasksResult.rows;
    const hasNextPage = rows.length > parsedLimit;
    if (hasNextPage) rows.pop();

    const nextCursor = hasNextPage
      ? `${rows.at(-1).created_at.toISOString()}__${rows.at(-1).id}`
      : null;

    res.json({
      success: true,
      data: {
        tasks: rows.map((t) => ({
          id:           t.id,
          url:          t.url,
          status:       t.status,
          progress:     t.progress,
          quality:      t.quality,
          format:       t.format,
          errorMessage: t.error_message,
          retryCount:   t.retry_count,
          mediaId:      t.media_id,
          mediaTitle:   t.media_title,
          username:     t.username,
          startedAt:    t.started_at,
          completedAt:  t.completed_at,
          createdAt:    t.created_at,
        })),
        pagination: {
          limit:     parsedLimit,
          nextCursor,
          hasNextPage,
        },
      },
    });
  } catch (error) {
    logger.error('Get download tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get download tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const cancelDownloadTask = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await query('SELECT status FROM download_tasks WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Download task not found' });
    }
    if (existing.rows[0].status === 'completed') {
      return res.status(400).json({ success: false, message: 'Cannot cancel completed task' });
    }
    if (existing.rows[0].status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'Task already cancelled' });
    }

    await query(
      'UPDATE download_tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', id],
    );

    logger.info(`Download task ${id} cancelled by admin ${req.user.username}`);
    res.json({ success: true, message: 'Download task cancelled successfully' });
  } catch (error) {
    logger.error('Cancel download task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel download task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const getGlobalSettings = async (req, res) => {
  try {
    const result = await query('SELECT * FROM global_settings ORDER BY setting_key');

    const settings = {};
    result.rows.forEach((row) => {
      let value = row.setting_value;
      if (row.data_type === 'number')       value = parseFloat(value);
      else if (row.data_type === 'boolean') value = value === 'true';
      else if (row.data_type === 'json') {
        try { value = JSON.parse(value); } catch (_) {}
      }

      settings[row.setting_key] = {
        value,
        dataType: row.data_type,
        description: row.description,
        isPublic: row.is_public,
        updatedAt: row.updated_at,
      };
    });

    res.json({ success: true, data: { settings } });
  } catch (error) {
    logger.error('Get global settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get global settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

const updateGlobalSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, dataType, description, isPublic } = req.body;

    if (value === undefined || value === null || value === '') {
      return res.status(400).json({ success: false, message: 'Setting value is required' });
    }

    const allowedTypes = ['string', 'number', 'boolean', 'json'];
    if (dataType && !allowedTypes.includes(dataType)) {
      return res.status(400).json({ success: false, message: 'Invalid data type' });
    }

    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    const result = await query(
      `INSERT INTO global_settings (setting_key, setting_value, data_type, description, is_public)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (setting_key) DO UPDATE SET
         setting_value = $2,
         data_type     = COALESCE($3, global_settings.data_type),
         description   = COALESCE($4, global_settings.description),
         is_public     = COALESCE($5, global_settings.is_public),
         updated_at    = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, stringValue, dataType, description, isPublic],
    );

    const row = result.rows[0];
    logger.info(`Global setting ${key} updated by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: {
        setting: {
          key: row.setting_key,
          value: row.setting_value,
          dataType: row.data_type,
          description: row.description,
          isPublic: row.is_public,
          updatedAt: row.updated_at,
        },
      },
    });
  } catch (error) {
    logger.error('Update global setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update setting',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

async function getUserStats() {
  const result = await query(`
    SELECT
      COUNT(*)                                                           as total,
      COUNT(*) FILTER (WHERE role = 'admin')                             as admins,
      COUNT(*) FILTER (WHERE role = 'user')                             as users,
      COUNT(*) FILTER (WHERE is_active = true)                          as active,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')    as new_this_week,
      COUNT(*) FILTER (WHERE last_login  > NOW() - INTERVAL '24 hours') as active_today,
      COUNT(*) FILTER (WHERE last_seen   > NOW() - INTERVAL '5 minutes')  as online_now,
      COUNT(*) FILTER (WHERE last_seen   > NOW() - INTERVAL '15 minutes') as active_recently
    FROM users
  `);
  return result.rows[0];
}

async function getMediaStats() {
  const result = await query(`
    SELECT
      COUNT(*)                                                       as total,
      COUNT(*) FILTER (WHERE status = 'completed')                   as completed,
      COUNT(*) FILTER (WHERE status = 'failed')                      as failed,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
      COALESCE(SUM(file_size), 0)                                    as total_size,
      COALESCE(AVG(duration),  0)                                    as avg_duration
    FROM media
  `);
  const row = result.rows[0];
  return { ...row, total_size: parseInt(row.total_size), avg_duration: parseFloat(row.avg_duration) };
}

async function getDownloadStats() {
  const result = await query(`
    SELECT
      COUNT(*)                                                         as total,
      COUNT(*) FILTER (WHERE status = 'queued')                        as queued,
      COUNT(*) FILTER (WHERE status = 'downloading')                   as downloading,
      COUNT(*) FILTER (WHERE status = 'completed')                     as completed,
      COUNT(*) FILTER (WHERE status = 'failed')                        as failed,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today
    FROM download_tasks
  `);
  return result.rows[0];
}

async function getStorageStats() {
  try {
    const result = await query(`
      SELECT
        COALESCE(SUM(file_size), 0)                                      AS total_size,
        COALESCE(SUM(file_size) FILTER (WHERE status = 'completed'), 0)  AS media_size,
        COUNT(*) FILTER (WHERE status = 'completed')                     AS file_count,
        COALESCE(AVG(file_size) FILTER (WHERE status = 'completed'), 0)  AS avg_file_size
      FROM media
      WHERE file_size IS NOT NULL
    `);

    const row = result.rows[0];
    return {
      totalSize:   parseInt(row.total_size),
      mediaSize:   parseInt(row.media_size),
      avgFileSize: parseInt(row.avg_file_size),
      fileCount:   parseInt(row.file_count),
      tempSize: 0,
    };
  } catch (error) {
    logger.error('Error getting storage stats:', error);
    return { totalSize: 0, mediaSize: 0, tempSize: 0, avgFileSize: 0, fileCount: 0 };
  }
}

async function getFolderSize(folderPath) {
  try {
    if (!(await fs.pathExists(folderPath))) return 0;
    let total = 0;
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(folderPath, entry.name);
      total += entry.isDirectory() ? await getFolderSize(full) : (await fs.stat(full)).size;
    }
    return total;
  } catch (error) {
    logger.error(`Folder size error for ${folderPath}:`, error);
    return 0;
  }
}

export default {
  getDashboardStats,
  getUsers,
  updateUser,
  deleteUser,
  getDownloadTasks,
  cancelDownloadTask,
  getGlobalSettings,
  updateGlobalSetting,
};