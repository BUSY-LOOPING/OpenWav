import { v4 as uuidv4 } from 'uuid';
import downloadService from '../services/downloadService.js';
import {query} from '../config/database.js';

 async function createDownloadTask(req, res, next) {
  try {
    const userId = req.user.id;
    const { url, format, quality } = req.body;

    if (!url || !format) {
      return res.status(400).json({ error: 'Missing url or format' });
    }

    const addedTask = await downloadService.addDownloadJob(url, {
      userId,
      format,
      quality
    });

    res.status(201).json({
      message: 'Download task queued',
      taskId: addedTask.taskId,
      jobId: addedTask.jobId,
      position: addedTask.position,
      estimatedStart: addedTask.estimatedStart
    });
  } catch (err) {
    next(err);
  }
};

async function getAllDownloadsForUser(req, res, next) {
  
  try {
    const userId = req.user.id;
    const result = await query('SELECT * FROM download_tasks WHERE requested_by = $1 AND status = $2 ORDER BY created_at DESC', [userId, 'completed']);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
};

async function getDownloadById(req, res, next) {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const result = await query('SELECT * FROM downloads WHERE id = $1 AND user_id = $2', [id, userId]);
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
};

async function getDownloadStatus(req, res, next) {
  try {
    const userId = req.user.id;
    
    const activeDownloads = await downloadService.getActiveJobs();
    const waitingDownloads = await downloadService.getWaitingJobs();
    const queueStats = await downloadService.getQueueStats();
    
    const completedResult = await query(`
      SELECT dt.*, m.file_path, m.file_size 
      FROM download_tasks dt
      LEFT JOIN media m ON dt.media_id = m.id
      WHERE dt.requested_by = $1 AND dt.status = 'completed'
      ORDER BY dt.completed_at DESC 
      LIMIT 10
    `, [userId]);
    
    res.json({
      queue: queueStats,
      active: activeDownloads,
      waiting: waitingDownloads,
      recentlyCompleted: completedResult.rows
    });
  } catch (err) {
    next(err);
  }
};

export default{
  createDownloadTask,
  getAllDownloadsForUser,
  getDownloadById,
  getDownloadStatus
}
