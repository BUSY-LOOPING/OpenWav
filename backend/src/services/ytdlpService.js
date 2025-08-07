import youtubedl from 'youtube-dl-exec';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {logger} from '../config/logger.js';
import { query } from '../config/database.js';
import ffmpeg from 'fluent-ffmpeg';

class YtdlpService {
  constructor() {
    this.downloadPath = process.env.MEDIA_STORAGE_PATH || './media';
    this.tempPath = process.env.TEMP_DOWNLOAD_PATH || './temp';
    this.ytdlpPath = process.env.YTDLP_PATH || 'yt-dlp';
  }

  // Get video/audio information without downloading
  async getMediaInfo(url) {
    try {
      logger.info(`Getting media info for: ${url}`);
      
      const info = await youtubedl(url, {
        dumpSingleJson: true,
        noWarnings: true,
        noCheckCertificates: true,
        // extractFlat: false,
        simulate: true,
        // ytdlpLocation: this.ytdlpPath
      });

      const mediaInfo = {
        id: info.id,
        title: info.title || 'Unknown Title',
        description: info.description || '',
        duration: info.duration || 0,
        uploader: info.uploader || 'Unknown',
        uploadDate: info.upload_date || null,
        viewCount: info.view_count || 0,
        likeCount: info.like_count || 0,
        thumbnail: info.thumbnail || null,
        formats: this.parseFormats(info.formats || []),
        originalUrl: url,
        platform: this.extractPlatform(url),
        metadata: {
          extractor: info.extractor,
          webpage_url: info.webpage_url,
          categories: info.categories || [],
          tags: info.tags || []
        }
      };

      logger.info(`Media info retrieved: ${mediaInfo.title} (${mediaInfo.duration}s)`);
      return mediaInfo;

    } catch (error) {
      logger.error(`Error getting media info for ${url}:`, error);
      throw new Error(`Failed to get media information: ${error.message}`);
    }
  }

  // Download media file
  async downloadMedia(url, options = {}) {
    // Default options
    const {
      quality = '720p',
      format = 'mp3',
      audioOnly = true,
      userId = null,
      taskId = null
    } = options;


    try {
      logger.info(`Starting download: ${url} (quality: ${quality}, format: ${format})`);

      // Get media info first
      const mediaInfo = await this.getMediaInfo(url);
      
      // Generate unique filename
      const fileId = uuidv4();
      const sanitizedTitle = this.sanitizeFilename(mediaInfo.title);
      const extension = audioOnly ? 'mp3' : format;
      const filename = `${fileId}_${sanitizedTitle}.${extension}`;
      
      // Create subdirectories
      const typeDir = audioOnly ? 'audio' : 'video';
      const outputDir = path.join(this.downloadPath, typeDir);
      await fs.ensureDir(outputDir);
      await fs.ensureDir(this.tempPath);
      
      const outputPath = path.join(outputDir, filename);

      const tempOutputPath = path.join(this.tempPath, filename);
      // Progress tracking
      let progress = 0;
      const updateProgress = async (newProgress) => {
        progress = newProgress;
        if (taskId) {
          await this.updateTaskProgress(taskId, progress);
        }
        logger.debug(`Download progress for ${mediaInfo.title}: ${progress}%`);
      };

      // Configure download options
      const downloadOptions = this.buildDownloadOptions({
        audioOnly,
        quality,
        format,
        outputPath: tempOutputPath,
        onProgress: updateProgress
      });

      // Start download
      await updateProgress(5);
      const result = await youtubedl(url, downloadOptions);

       const downloadedFiles = await fs.readdir(this.tempPath);
      const matchedFile = downloadedFiles.find(filename => filename.startsWith(fileId));

      if (!matchedFile) {
        throw new Error(`Downloaded file not found in temp directory for job ${fileId}`);
      }

      const actualTempFilePath = path.join(this.tempPath, matchedFile);
      logger.info(`Found downloaded file: ${matchedFile}`);

      await updateProgress(50);

      let finalFilePath = outputPath;

      // Convert to MP3 if the downloaded file is not already MP3 and audioOnly is true
      
      if (audioOnly && !matchedFile.endsWith('.mp3')) {
        logger.info(`Converting ${matchedFile} to MP3...`);
        
        const mp3TempPath = path.join(this.tempPath, `${fileId}_converted.mp3`);
        
        await this.convertToMp3(actualTempFilePath, mp3TempPath, quality);
        
        // Remove the original downloaded file
        await fs.remove(actualTempFilePath);
        
        // Update the file path to the converted MP3
        finalFilePath = outputPath; // This already has .mp3 extension
        
        await updateProgress(85);
        
        // Move the converted MP3 to final location
        await fs.move(mp3TempPath, finalFilePath);
        
        logger.info(`Converted and moved MP3 file to: ${finalFilePath}`);
      } else {
        // If it's already MP3 or not audio-only, just move it
        await updateProgress(85);
        await fs.move(actualTempFilePath, finalFilePath);
      }

      await updateProgress(95);


      // Get file stats
      const stats = await fs.stat(outputPath);
      
      // Download thumbnail/cover if available
      let thumbnailPath = null;
      if (mediaInfo.thumbnail) {
        try {
          thumbnailPath = await this.downloadThumbnail(mediaInfo.thumbnail, fileId);
        } catch (error) {
          logger.warn(`Failed to download thumbnail: ${error.message}`);
        }
      }

      const downloadResult = {
        id: fileId,
        title: mediaInfo.title,
        description: mediaInfo.description,
        duration: mediaInfo.duration,
        filePath: outputPath,
        relativePath: path.relative(process.cwd(), outputPath),
        thumbnailPath,
        fileSize: stats.size,
        format: extension,
        quality: quality,
        platform: mediaInfo.platform,
        originalUrl: url,
        metadata: mediaInfo.metadata,
        downloadedAt: new Date()
      };

      logger.info(`Download completed: ${mediaInfo.title} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
      return downloadResult;

    } catch (error) {
      logger.error(`Download failed for ${url}:`, error);
      
      // Update task status if provided
      if (taskId) {
        await this.updateTaskStatus(taskId, 'failed', error.message);
      }
      
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  async convertToMp3(inputPath, outputPath, quality = '192k') {
    return new Promise((resolve, reject) => {
      const audioBitrate = this.parseAudioQuality(quality);
      
      ffmpeg(inputPath)
        .audioCodec('libmp3lame')
        .audioBitrate(audioBitrate + 'k')
        .format('mp3')
        .on('start', (commandLine) => {
          logger.info(`FFmpeg conversion started: ${commandLine}`);
        })
        .on('progress', (progress) => {
          logger.debug(`FFmpeg conversion progress: ${progress.percent}%`);
        })
        .on('end', () => {
          logger.info(`FFmpeg conversion completed: ${outputPath}`);
          resolve();
        })
        .on('error', (err) => {
          logger.error(`FFmpeg conversion error: ${err.message}`);
          reject(err);
        })
        .save(outputPath);
    });
  }

  // Build yt-dlp download options
  buildDownloadOptions({ audioOnly, quality, format, outputPath, onProgress }) {
    const options = {
      output: outputPath,
      noWarnings: true,
      noCheckCertificates: true,
      writeInfoJson: false,
      writeDescription: false,
      writeAnnotations: false,
      writeThumbnail: false,
      embedSubs: false,
      writeAutoSub: false,
      // ytdlpLocation: this.ytdlpPath
    };

    if (audioOnly) {
      options.extractAudio = true;
      options.audioFormat = format || 'mp3';
      options.audioQuality = this.parseAudioQuality(quality);
      options.preferFreeFormats = false; 
      delete options.mergeOutputFormat;
    } else {
      // Video download options
      const videoFormat = this.buildVideoFormat(quality, format);
      if (videoFormat) {
        options.format = videoFormat;
      }
      if (['mp4', 'mkv', 'webm'].includes(format)) {
        options.mergeOutputFormat = format;
      }
      
    }

    // Add progress hook if available
    if (onProgress && typeof onProgress === 'function') {
      // Note: youtube-dl-exec doesn't directly support progress callbacks
      // This would need to be implemented using the exec method with custom parsing
    }

    return options;
  }

  // Parse available formats from media info
  parseFormats(formats) {
    const videoFormats = [];
    const audioFormats = [];

    formats.forEach(format => {
      if (format.vcodec && format.vcodec !== 'none') {
        videoFormats.push({
          formatId: format.format_id,
          resolution: format.resolution || `${format.width}x${format.height}`,
          fps: format.fps,
          vcodec: format.vcodec,
          acodec: format.acodec,
          filesize: format.filesize,
          quality: this.getQualityLabel(format.height)
        });
      } else if (format.acodec && format.acodec !== 'none') {
        audioFormats.push({
          formatId: format.format_id,
          acodec: format.acodec,
          abr: format.abr,
          filesize: format.filesize
        });
      }
    });

    return { video: videoFormats, audio: audioFormats };
  }

  // Build video format string for yt-dlp
  buildVideoFormat(quality, format) {
    const heightMap = {
      '144p': 144,
      '240p': 240,
      '360p': 360,
      '480p': 480,
      '720p': 720,
      '1080p': 1080,
      '1440p': 1440,
      '2160p': 2160
    };

    const maxHeight = heightMap[quality] || 720;
    
    // Return format that downloads best video and audio separately then merges
    return `best[height<=${maxHeight}]+bestaudio/best[height<=${maxHeight}]`;
  }

  // Parse audio quality
  parseAudioQuality(quality) {
    if (quality.endsWith('k')) {
      return quality.slice(0, -1);
    }
    return '192'; // Default to 192k
  }

  // Get quality label from height
  getQualityLabel(height) {
    if (!height) return 'unknown';
    if (height >= 2160) return '2160p';
    if (height >= 1440) return '1440p';
    if (height >= 1080) return '1080p';
    if (height >= 720) return '720p';
    if (height >= 480) return '480p';
    if (height >= 360) return '360p';
    if (height >= 240) return '240p';
    return '144p';
  }

  // Download thumbnail/cover image
  async downloadThumbnail(thumbnailUrl, fileId) {
    try {
      const response = await fetch(thumbnailUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      const extension = this.getThumbnailExtension(thumbnailUrl);
      const filename = `${fileId}_thumbnail.${extension}`;
      const thumbnailDir = path.join(this.downloadPath, 'thumbnails');
      
      await fs.ensureDir(thumbnailDir);
      const thumbnailPath = path.join(thumbnailDir, filename);
      
      await fs.writeFile(thumbnailPath, Buffer.from(buffer));
      
      logger.info(`Thumbnail downloaded: ${filename}`);
      return path.relative(process.cwd(), thumbnailPath);

    } catch (error) {
      logger.error(`Thumbnail download failed:`, error);
      throw error;
    }
  }

  // Extract platform from URL
  extractPlatform(url) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return 'youtube';
    } else if (url.includes('vimeo.com')) {
      return 'vimeo';
    } else if (url.includes('soundcloud.com')) {
      return 'soundcloud';
    } else if (url.includes('dailymotion.com')) {
      return 'dailymotion';
    }
    return 'unknown';
  }

  // Sanitize filename for filesystem
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
      .substring(0, 100);
  }

  // Get thumbnail extension from URL
  getThumbnailExtension(url) {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
    return match ? match[1] : 'jpg';
  }

  // Update task progress in database
  async updateTaskProgress(taskId, progress) {
    try {
      await query(
        'UPDATE download_tasks SET progress = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [progress, taskId]
      );
    } catch (error) {
      logger.error(`Failed to update task progress: ${error.message}`);
    }
  }

  // Update task status in database
  async updateTaskStatus(taskId, status, errorMessage = null) {
    try {
      const updateTime = status === 'downloading' ? 'started_at' : 
                        status === 'completed' ? 'completed_at' : 'updated_at';
      
      await query(
        `UPDATE download_tasks 
         SET status = $1, error_message = $2, ${updateTime} = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [status, errorMessage, taskId]
      );
    } catch (error) {
      logger.error(`Failed to update task status: ${error.message}`);
    }
  }

  // Validate URL
  async validateUrl(url) {
    try {
      // Basic URL validation
      new URL(url);
      
      // Check against allowed domains if configured
      const allowedDomainsResult = await query(
        'SELECT setting_value FROM global_settings WHERE setting_key = $1',
        ['allowed_domains']
      );
      
      if (allowedDomainsResult.rows.length > 0) {
        const allowedDomains = JSON.parse(allowedDomainsResult.rows[0].setting_value);
        const urlDomain = new URL(url).hostname;
        
        const isAllowed = allowedDomains.some(domain => 
          urlDomain === domain || urlDomain.endsWith(`.${domain}`)
        );
        
        if (!isAllowed) {
          throw new Error(`Domain ${urlDomain} is not allowed`);
        }
      }
      
      return true;
    } catch (error) {
      throw new Error(`Invalid URL: ${error.message}`);
    }
  }
}

export default new YtdlpService();
