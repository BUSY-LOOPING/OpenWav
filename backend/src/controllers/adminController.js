import {query, transaction} from '../config/database.js';
import {logger} from '../config/logger.js';
import downloadService from '../services/downloadService';
import fs from 'fs-extra';
import path from 'path';

const getDashboardStats = async (req, res) => {
  try {
    const [
      userStats,
      mediaStats,
      downloadStats,
      storageStats,
      queueStats
    ] = await Promise.all([
      getUserStats(),
      getMediaStats(),
      getDownloadStats(),
      getStorageStats(),
      downloadService.getQueueStats()
    ]);

    res.json({
      success: true,
      data: {
        users: userStats,
        media: mediaStats,
        downloads: downloadStats,
        storage: storageStats,
        queue: queueStats,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Get dashboard stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search,
      role,
      status,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    // Build query conditions
    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (search) {
      conditions.push(`(username ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (role) {
      conditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (status !== undefined) {
      conditions.push(`is_active = $${paramIndex}`);
      params.push(status === 'active');
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const allowedSortFields = ['created_at', 'username', 'email', 'last_login'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const usersQuery = `
      SELECT 
        u.*,
        COUNT(DISTINCT m.id) as media_count,
        COUNT(DISTINCT dt.id) as download_count,
        COALESCE(SUM(m.file_size), 0) as total_storage_used
      FROM users u
      LEFT JOIN media m ON u.id = m.uploaded_by
      LEFT JOIN download_tasks dt ON u.id = dt.requested_by
      ${whereClause}
      GROUP BY u.id
      ORDER BY ${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const usersResult = await query(usersQuery, params);

    res.json({
      success: true,
      data: {
        users: usersResult.rows.map(user => ({
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          isActive: user.is_active,
          emailVerified: user.email_verified,
          lastLogin: user.last_login,
          createdAt: user.created_at,
          stats: {
            mediaCount: parseInt(user.media_count),
            downloadCount: parseInt(user.download_count),
            storageUsed: parseInt(user.total_storage_used)
          }
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
    logger.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, isActive } = req.body;

    const userResult = await query(
      'SELECT id, role FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentUser = userResult.rows[0];

    if (req.user.id === id && role !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot change your own admin role'
      });
    }

    const updates = [];
    const params = [];
    let paramIndex = 1;

    if (username !== undefined) {
      updates.push(`username = $${paramIndex}`);
      params.push(username);
      paramIndex++;
    }

    if (email !== undefined) {
      updates.push(`email = $${paramIndex}`);
      params.push(email);
      paramIndex++;
    }

    if (role !== undefined) {
      updates.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      params.push(isActive);
      paramIndex++;
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const updateQuery = `
      UPDATE users 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, username, email, role, is_active, updated_at
    `;

    const updateResult = await query(updateQuery, params);
    const updatedUser = updateResult.rows[0];

    logger.info(`User ${id} updated by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: updatedUser
      }
    });

  } catch (error) {
    logger.error('Update user error:', error);
    
    if (error.code === '23505') { // Unique constraint violation
      return res.status(409).json({
        success: false,
        message: 'Username or email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    const userResult = await query(
      'SELECT username FROM users WHERE id = $1',
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const username = userResult.rows[0].username;

    await transaction(async (client) => {
      const mediaResult = await client.query(
        'SELECT file_path, thumbnail_path FROM media WHERE uploaded_by = $1',
        [id]
      );

      for (const media of mediaResult.rows) {
        try {
          if (media.file_path && await fs.pathExists(media.file_path)) {
            await fs.unlink(media.file_path);
          }
          if (media.thumbnail_path && await fs.pathExists(media.thumbnail_path)) {
            await fs.unlink(media.thumbnail_path);
          }
        } catch (fileError) {
          logger.warn(`Failed to delete media file: ${fileError.message}`);
        }
      }

      await client.query('DELETE FROM users WHERE id = $1', [id]);
    });

    logger.info(`User ${username} (${id}) deleted by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getDownloadTasks = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      userId,
      sortBy = 'created_at',
      sortOrder = 'DESC'
    } = req.query;

    const offset = (page - 1) * limit;
    
    let conditions = [];
    let params = [];
    let paramIndex = 1;

    if (status) {
      conditions.push(`dt.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    if (userId) {
      conditions.push(`dt.requested_by = $${paramIndex}`);
      params.push(userId);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    const allowedSortFields = ['created_at', 'updated_at', 'priority', 'progress'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'created_at';
    const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const countQuery = `SELECT COUNT(*) as total FROM download_tasks dt ${whereClause}`;
    const countResult = await query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const tasksQuery = `
      SELECT 
        dt.*,
        u.username,
        m.title as media_title
      FROM download_tasks dt
      LEFT JOIN users u ON dt.requested_by = u.id
      LEFT JOIN media m ON dt.media_id = m.id
      ${whereClause}
      ORDER BY dt.${sortField} ${sortDirection}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    params.push(limit, offset);
    const tasksResult = await query(tasksQuery, params);

    res.json({
      success: true,
      data: {
        tasks: tasksResult.rows.map(task => ({
          id: task.id,
          url: task.url,
          status: task.status,
          progress: task.progress,
          quality: task.quality,
          format: task.format,
          priority: task.priority,
          errorMessage: task.error_message,
          retryCount: task.retry_count,
          maxRetries: task.max_retries,
          username: task.username,
          mediaTitle: task.media_title,
          mediaId: task.media_id,
          startedAt: task.started_at,
          completedAt: task.completed_at,
          createdAt: task.created_at
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
    logger.error('Get download tasks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get download tasks',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const cancelDownloadTask = async (req, res) => {
  try {
    const { id } = req.params;

    const taskResult = await query(
      'SELECT status FROM download_tasks WHERE id = $1',
      [id]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Download task not found'
      });
    }

    const task = taskResult.rows[0];

    if (task.status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel completed task'
      });
    }

    try {
      const activeJobs = await downloadService.getActiveJobs();
      const waitingJobs = await downloadService.getWaitingJobs();
      
      const allJobs = [...activeJobs, ...waitingJobs];
      const targetJob = allJobs.find(job => job.taskId === id);
      
      if (targetJob) {
        await downloadService.cancelJob(targetJob.id);
      }
    } catch (queueError) {
      logger.warn(`Failed to cancel job in queue: ${queueError.message}`);
    }

    await query(
      'UPDATE download_tasks SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', id]
    );

    logger.info(`Download task ${id} cancelled by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Download task cancelled successfully'
    });

  } catch (error) {
    logger.error('Cancel download task error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel download task',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateConcurrentDownloads = async (req, res) => {
  try {
    const { count } = req.body;

    if (typeof count !== 'number' || count < 1 || count > 20) {
      return res.status(400).json({
        success: false,
        message: 'Concurrent downloads must be between 1 and 20'
      });
    }

    await downloadService.setConcurrentDownloads(count);

    logger.info(`Concurrent downloads updated to ${count} by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Concurrent downloads updated successfully',
      data: {
        concurrentDownloads: count
      }
    });

  } catch (error) {
    logger.error('Update concurrent downloads error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update concurrent downloads',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const getGlobalSettings = async (req, res) => {
  try {
    const settingsResult = await query(
      'SELECT * FROM global_settings ORDER BY setting_key'
    );

    const settings = {};
    settingsResult.rows.forEach(row => {
      let value = row.setting_value;
      
      switch (row.data_type) {
        case 'number':
          value = parseFloat(value);
          break;
        case 'boolean':
          value = value === 'true';
          break;
        case 'json':
          try {
            value = JSON.parse(value);
          } catch (e) {
            
          }
          break;
      }

      settings[row.setting_key] = {
        value,
        dataType: row.data_type,
        description: row.description,
        isPublic: row.is_public,
        updatedAt: row.updated_at
      };
    });

    res.json({
      success: true,
      data: { settings }
    });

  } catch (error) {
    logger.error('Get global settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get global settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const updateGlobalSetting = async (req, res) => {
  try {
    const { key } = req.params;
    const { value, dataType, description, isPublic } = req.body;

    if (!value && value !== false && value !== 0) {
      return res.status(400).json({
        success: false,
        message: 'Setting value is required'
      });
    }

    // Validate data type
    const allowedTypes = ['string', 'number', 'boolean', 'json'];
    if (dataType && !allowedTypes.includes(dataType)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid data type'
      });
    }

    let stringValue;
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value);
    } else {
      stringValue = String(value);
    }

    const updateResult = await query(
      `INSERT INTO global_settings (setting_key, setting_value, data_type, description, is_public)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (setting_key)
       DO UPDATE SET 
         setting_value = $2,
         data_type = COALESCE($3, global_settings.data_type),
         description = COALESCE($4, global_settings.description),
         is_public = COALESCE($5, global_settings.is_public),
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [key, stringValue, dataType, description, isPublic]
    );

    const setting = updateResult.rows[0];

    logger.info(`Global setting ${key} updated by admin ${req.user.username}`);

    res.json({
      success: true,
      message: 'Setting updated successfully',
      data: {
        setting: {
          key: setting.setting_key,
          value: setting.setting_value,
          dataType: setting.data_type,
          description: setting.description,
          isPublic: setting.is_public,
          updatedAt: setting.updated_at
        }
      }
    });

  } catch (error) {
    logger.error('Update global setting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update setting',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

async function getUserStats() {
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE role = 'admin') as admins,
      COUNT(*) FILTER (WHERE role = 'user') as users,
      COUNT(*) FILTER (WHERE is_active = true) as active,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
      COUNT(*) FILTER (WHERE last_login > NOW() - INTERVAL '24 hours') as active_today
    FROM users
  `);

  return result.rows[0];
}

async function getMediaStats() {
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as new_this_week,
      COALESCE(SUM(file_size), 0) as total_size,
      COALESCE(AVG(duration), 0) as avg_duration
    FROM media
  `);

  const stats = result.rows[0];
  stats.total_size = parseInt(stats.total_size);
  stats.avg_duration = parseFloat(stats.avg_duration);

  return stats;
}

async function getDownloadStats() {
  const result = await query(`
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE status = 'queued') as queued,
      COUNT(*) FILTER (WHERE status = 'downloading') as downloading,
      COUNT(*) FILTER (WHERE status = 'completed') as completed,
      COUNT(*) FILTER (WHERE status = 'failed') as failed,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as today
    FROM download_tasks
  `);

  return result.rows[0];
}

async function getStorageStats() {
  try {
    const mediaPath = process.env.MEDIA_STORAGE_PATH || './media';
    const tempPath = process.env.TEMP_DOWNLOAD_PATH || './temp';

    const [mediaSize, tempSize] = await Promise.all([
      getFolderSize(mediaPath),
      getFolderSize(tempPath)
    ]);

    return {
      mediaSize: mediaSize,
      tempSize: tempSize,
      totalSize: mediaSize + tempSize
    };

  } catch (error) {
    logger.error('Error getting storage stats:', error);
    return {
      mediaSize: 0,
      tempSize: 0,
      totalSize: 0
    };
  }
}

async function getFolderSize(folderPath) {
  try {
    if (!await fs.pathExists(folderPath)) {
      return 0;
    }

    let totalSize = 0;
    const files = await fs.readdir(folderPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(folderPath, file.name);
      
      if (file.isDirectory()) {
        totalSize += await getFolderSize(filePath);
      } else {
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }
    }

    return totalSize;
  } catch (error) {
    logger.error(`Error calculating folder size for ${folderPath}:`, error);
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
  updateConcurrentDownloads,
  getGlobalSettings,
  updateGlobalSetting
};