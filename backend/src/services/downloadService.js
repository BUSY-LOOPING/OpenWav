import Bull from 'bull';
import {logger} from '../config/logger.js';
import { query, transaction } from '../config/database.js';
import ytdlpService from './ytdlpService.js';
import {createMedia} from './mediaService.js';


class DownloadService {
  constructor() {
    this.downloadQueue = null;
    this.isInitialized = false;
    this.concurrentDownloads = parseInt(process.env.CONCURRENT_DOWNLOADS) || 3;
    this.maxConcurrentDownloads = parseInt(process.env.MAX_CONCURRENT_DOWNLOADS) || 10;
    this.io = null;
  }

  //download queue
  async initialize(io = null) { // Accept io parameter
    if (this.isInitialized) return;

    // Store io instance
    this.io = io;

    try {
      // Create Bull queue for downloads
      this.downloadQueue = new Bull('media downloads', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
          password: process.env.REDIS_PASSWORD || undefined
        },
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
          removeOnComplete: 50,
          removeOnFail: 20
        }
      });

      // Set up job processing
      this.downloadQueue.process('download', this.concurrentDownloads, this.processDownload.bind(this));

      // Set up event listeners
      this.setupEventListeners();

      // Load concurrent downloads setting from database
      await this.loadConcurrentDownloadsSetting();

      this.isInitialized = true;
      logger.info(`Download service initialized with ${this.concurrentDownloads} concurrent downloads`);

    } catch (error) {
      logger.error('Failed to initialize download service:', error);
      throw error;
    }
  }

  // Helper method to emit progress updates
  emitProgress(taskId, jobId, progress, title = null, status = 'progress', error = null) {
    if (this.io) {
      this.io.emit('downloadProgress', {
        taskId,
        jobId,
        progress,
        title,
        status,
        error,
        timestamp: new Date().toISOString()
      });
    }
  }

  // Load concurrent downloads setting from database
  async loadConcurrentDownloadsSetting() {
    try {
      const result = await query(
        'SELECT setting_value FROM global_settings WHERE setting_key = $1',
        ['max_concurrent_downloads']
      );

      if (result.rows.length > 0) {
        const dbConcurrent = parseInt(result.rows[0].setting_value);
        if (dbConcurrent > 0 && dbConcurrent <= this.maxConcurrentDownloads) {
          await this.setConcurrentDownloads(dbConcurrent);
        }
      }
    } catch (error) {
      logger.warn('Failed to load concurrent downloads setting:', error.message);
    }
  }

  // Set up queue event listeners
  setupEventListeners() {
    this.downloadQueue.on('completed', async (job, result) => {
      logger.info(`Download job ${job.id} completed: ${result.title}`);
      await this.onJobCompleted(job, result);
    });

    this.downloadQueue.on('failed', async (job, err) => {
      logger.error(`Download job ${job.id} failed:`, err);
      await this.onJobFailed(job, err);
    });

    this.downloadQueue.on('progress', async (job, progress) => {
      logger.debug(`Download job ${job.id} progress: ${progress}%`);
      await this.onJobProgress(job, progress);
    });

    this.downloadQueue.on('stalled', async (job) => {
      logger.warn(`Download job ${job.id} stalled`);
      await this.onJobStalled(job);
    });

    this.downloadQueue.on('active', async (job) => {
      logger.info(`Download job ${job.id} started: ${job.data.url}`);
      await this.onJobStarted(job);
    });
  }

  // Add download job to queue
  async addDownloadJob(url, options = {}) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const {
      userId,
      quality = '192k',
      format = 'mp3',
      audioOnly = true,
      priority = 5
    } = options;

    try {
      // Validate URL first
      await ytdlpService.validateUrl(url);

      // Check user download limits
      if (userId) {
        const canDownload = await this.checkUserDownloadLimits(userId);
        if (!canDownload) {
          throw new Error('Daily download limit exceeded');
        }
      }

      // Create download task in database
      const taskResult = await query(
      `INSERT INTO download_tasks (url, requested_by, quality, format, priority, status)
      VALUES ($1, $2, $3, $4, $5, 'queued')
      RETURNING id, created_at`,
      [url, userId, quality, format, priority]
    );

      const taskId = taskResult.rows[0].id;

      // Add job to queue
      const job = await this.downloadQueue.add('download', {
        taskId,
        url,
        userId,
        quality,
        format,
        audioOnly,
        createdAt: taskResult.rows[0].created_at
      }, {
        priority: 10 - priority, // Bull uses higher numbers for higher priority
        delay: 0
      });

      // Emit job queued event
      this.emitProgress(taskId, job.id, 0, null, 'queued');

      logger.info(`Download job queued: ${url} (Task ID: ${taskId}, Job ID: ${job.id})`);

      return {
        taskId,
        jobId: job.id,
        estimatedStart: await this.getEstimatedStartTime()
      };

    } catch (error) {
      logger.error('Failed to add download job:', error);
      throw error;
    }
  }

  // Process download job
  async processDownload(job) {
    const { taskId, url, userId, quality, format, audioOnly } = job.data;

    try {
      logger.info(`Processing download job ${job.id}: ${url}`);

      // Update task status to downloading
      await query(
        'UPDATE download_tasks SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['downloading', taskId]
      );

      // Emit job started event
      this.emitProgress(taskId, job.id, 0, null, 'started');

      // Progress callback with Socket.IO emission
      const onProgress = async (progress) => {
        job.progress(progress);
        await query(
          'UPDATE download_tasks SET progress = $1 WHERE id = $2',
          [progress, taskId]
        );
        
        // Emit real-time progress
        this.emitProgress(taskId, job.id, progress);
      };

      // Download the media
      const downloadResult = await ytdlpService.downloadMedia(url, {
        quality,
        format,
        audioOnly,
        userId,
        taskId,
        onProgress,
        useCookies: true
      });

      // Save media to database
      const media = await createMedia({
        title: downloadResult.title,
        description: downloadResult.description,
        url: downloadResult.originalUrl,
        platform: downloadResult.platform,
        duration: downloadResult.duration,
        filePath: downloadResult.relativePath,
        thumbnailPath: downloadResult.thumbnailPath,
        fileSize: downloadResult.fileSize,
        format: downloadResult.format,
        quality: downloadResult.quality,
        status: 'completed',
        uploadedBy: userId,
        metadata: downloadResult.metadata
      });

      // Update task with completion info
      await query(
        `UPDATE download_tasks 
         SET status = $1, progress = 100, completed_at = CURRENT_TIMESTAMP, media_id = $2
         WHERE id = $3`,
        ['completed', media.id, taskId]
      );

      // Emit completion event
      this.emitProgress(taskId, job.id, 100, downloadResult.title, 'completed');

      logger.info(`Download completed: ${downloadResult.title}`);
      return downloadResult;

    } catch (error) {
      logger.error(`Download job ${job.id} failed:`, error);

      // Update task with error
      await query(
        `UPDATE download_tasks 
         SET status = $1, error_message = $2, retry_count = retry_count + 1
         WHERE id = $3`,
        ['failed', error.message, taskId]
      );

      // Emit failure event
      this.emitProgress(taskId, job.id, null, null, 'failed', error.message);

      throw error;
    }
  }

  // Check user download limits
  async checkUserDownloadLimits(userId) {
    try {
      const limitResult = await query(
        'SELECT setting_value FROM global_settings WHERE setting_key = $1',
        ['max_downloads_per_user_per_day']
      );

      if (limitResult.rows.length === 0) {
        return true; // No limit set
      }

      const dailyLimit = parseInt(limitResult.rows[0].setting_value);
      if (dailyLimit <= 0) {
        return true; // No limit
      }

      // Count downloads in last 24 hours
      const countResult = await query(
        `SELECT COUNT(*) as count FROM download_tasks 
         WHERE requested_by = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId]
      );

      const currentCount = parseInt(countResult.rows[0].count);
      return currentCount < dailyLimit;

    } catch (error) {
      logger.error('Error checking user download limits:', error);
      return true; // Allow download on error
    }
  }

  // Get queue statistics
  async getQueueStats() {
    if (!this.downloadQueue) {
      return null;
    }

    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.downloadQueue.getWaiting(),
        this.downloadQueue.getActive(),
        this.downloadQueue.getCompleted(),
        this.downloadQueue.getFailed(),
        this.downloadQueue.getDelayed()
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
        concurrentDownloads: this.concurrentDownloads,
        maxConcurrentDownloads: this.maxConcurrentDownloads
      };

    } catch (error) {
      logger.error('Error getting queue stats:', error);
      return null;
    }
  }

  // Get active jobs
  async getActiveJobs() {
    if (!this.downloadQueue) {
      return [];
    }

    try {
      const activeJobs = await this.downloadQueue.getActive();
      return activeJobs.map(job => ({
        id: job.id,
        taskId: job.data.taskId,
        url: job.data.url,
        progress: job.progress(),
        startedAt: job.processedOn,
        data: job.data
      }));

    } catch (error) {
      logger.error('Error getting active jobs:', error);
      return [];
    }
  }

  // Get waiting jobs
  async getWaitingJobs() {
    if (!this.downloadQueue) {
      return [];
    }

    try {
      const waitingJobs = await this.downloadQueue.getWaiting();
      return waitingJobs.map(job => ({
        id: job.id,
        taskId: job.data.taskId,
        url: job.data.url,
        priority: job.opts.priority,
        createdAt: job.data.createdAt,
        position: job.id, // Approximation
        data: job.data
      }));

    } catch (error) {
      logger.error('Error getting waiting jobs:', error);
      return [];
    }
  }

  // Update concurrent downloads (admin function)
  async setConcurrentDownloads(count) {
    if (count < 1 || count > this.maxConcurrentDownloads) {
      throw new Error(`Concurrent downloads must be between 1 and ${this.maxConcurrentDownloads}`);
    }

    if (this.downloadQueue) {
      // Update queue concurrency
    this.downloadQueue.concurrency = count;
    }

    this.concurrentDownloads = count;

    // Update database setting
    await query(
      `INSERT INTO global_settings (setting_key, setting_value, data_type, description)
       VALUES ($1, $2, 'number', 'Maximum number of concurrent downloads')
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $2, updated_at = CURRENT_TIMESTAMP`,
      ['max_concurrent_downloads', count.toString()]
    );

    logger.info(`Concurrent downloads updated to: ${count}`);
  }

  // Cancel job
  async cancelJob(jobId) {
    if (!this.downloadQueue) {
      throw new Error('Download service not initialized');
    }

    try {
      const job = await this.downloadQueue.getJob(jobId);
      if (!job) {
        throw new Error('Job not found');
      }

      await job.remove();

      // Update task status
      if (job.data.taskId) {
        await query(
          'UPDATE download_tasks SET status = $1 WHERE id = $2',
          ['cancelled', job.data.taskId]
        );

        // Emit cancellation event
        this.emitProgress(job.data.taskId, jobId, null, null, 'cancelled');
      }

      logger.info(`Job ${jobId} cancelled`);
      return true;

    } catch (error) {
      logger.error(`Error cancelling job ${jobId}:`, error);
      throw error;
    }
  }

  // Event handlers
  async onJobCompleted(job, result) {
    // Job completion is handled in processDownload
  }

  async onJobFailed(job, error) {
    // Job failure is handled in processDownload
  }

  async onJobProgress(job, progress) {
    // Progress updates are handled in processDownload
  }

  async onJobStalled(job) {
    logger.warn(`Job ${job.id} stalled, will be retried`);
    // Emit stalled event
    if (job.data.taskId) {
      this.emitProgress(job.data.taskId, job.id, null, null, 'stalled');
    }
  }

  async onJobStarted(job) {
    if (job.data.taskId) {
      await query(
        'UPDATE download_tasks SET status = $1, started_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['downloading', job.data.taskId]
      );
    }
  }

  // Estimate start time for new jobs
  async getEstimatedStartTime() {
    try {
      const stats = await this.getQueueStats();
      if (!stats) return null;

      // Simple estimation: assume average download time of 2 minutes
      const avgDownloadTime = 2 * 60 * 1000; // 2 minutes in ms
      const estimatedDelay = Math.ceil(stats.waiting / this.concurrentDownloads) * avgDownloadTime;
      
      return new Date(Date.now() + estimatedDelay);

    } catch (error) {
      logger.error('Error estimating start time:', error);
      return null;
    }
  }

  // Clean up old jobs
  async cleanupOldJobs() {
    try {
      if (this.downloadQueue) {
        await this.downloadQueue.clean(24 * 60 * 60 * 1000, 'completed'); // Remove completed jobs older than 24h
        await this.downloadQueue.clean(24 * 60 * 60 * 1000, 'failed'); // Remove failed jobs older than 24h
      }

      // Clean up old database records
      const hoursToKeep = await this.getCleanupHours();
      await query(
        `DELETE FROM download_tasks 
         WHERE status IN ('completed', 'failed', 'cancelled') 
         AND updated_at < NOW() - INTERVAL '${hoursToKeep} hours'`
      );

      logger.info('Old download jobs cleaned up');

    } catch (error) {
      logger.error('Error cleaning up old jobs:', error);
    }
  }

  async getCleanupHours() {
    try {
      const result = await query(
        'SELECT setting_value FROM global_settings WHERE setting_key = $1',
        ['cleanup_failed_downloads_after_hours']
      );
      
      return result.rows.length > 0 ? parseInt(result.rows[0].setting_value) : 24;
    } catch (error) {
      return 24; // Default to 24 hours
    }
  }
}

export default new DownloadService();
