// src/services/youtubeService.js
import { google } from 'googleapis';
import {logger} from '../config/logger.js';

class YouTubeService {
  constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: process.env.YOUTUBE_API_KEY
    });
  }

  // Search for videos by text query
  async searchVideos(query, maxResults = 50) {
    try {
      logger.info(`Searching YouTube for: ${query}`);
      
      const response = await this.youtube.search.list({
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults,
        order: 'relevance',
        videoCategoryId: '10' // Music category
      });

      const videos = response.data.items.map(item => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnail: item.snippet.thumbnails?.medium?.url,
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`
      }));

      logger.info(`Found ${videos.length} videos for query: ${query}`);
      return videos;

    } catch (error) {
      logger.error(`YouTube search failed for query "${query}":`, error);
      throw new Error(`YouTube search failed: ${error.message}`);
    }
  }

  // Get video details by ID
  async getVideoDetails(videoId) {
    try {
      const response = await this.youtube.videos.list({
        part: 'snippet,statistics,contentDetails',
        id: videoId
      });

      if (response.data.items.length === 0) {
        throw new Error('Video not found');
      }

      const video = response.data.items[0];
      return {
        videoId: video.id,
        title: video.snippet.title,
        description: video.snippet.description,
        channelTitle: video.snippet.channelTitle,
        publishedAt: video.snippet.publishedAt,
        duration: video.contentDetails.duration,
        viewCount: video.statistics.viewCount,
        likeCount: video.statistics.likeCount,
        thumbnail: video.snippet.thumbnails?.medium?.url,
        url: `https://www.youtube.com/watch?v=${video.id}`
      };

    } catch (error) {
      logger.error(`Failed to get video details for ID ${videoId}:`, error);
      throw new Error(`Failed to get video details: ${error.message}`);
    }
  }

  // Auto-download top results based on maxDownloads setting
  async autoDownloadByQuery(query, userId, options = {}) {
    try {
      // Get maxDownloads setting from database
      const maxDownloads = await this.getMaxDownloadsSetting();
      
      // Search for videos
      const videos = await this.searchVideos(query, Math.min(maxDownloads * 2, 50));
      
      if (videos.length === 0) {
        throw new Error('No videos found for the search query');
      }

      const downloadPromises = [];
      const selectedVideos = videos.slice(0, maxDownloads);

      // Start downloads for each video
      for (const video of selectedVideos) {
        const downloadPromise = this.queueDownload(video.url, userId, options);
        downloadPromises.push(downloadPromise);
      }

      const results = await Promise.allSettled(downloadPromises);
      
      return {
        query,
        totalFound: videos.length,
        downloadCount: selectedVideos.length,
        downloads: results.map((result, index) => ({
          video: selectedVideos[index],
          success: result.status === 'fulfilled',
          taskId: result.status === 'fulfilled' ? result.value.taskId : null,
          error: result.status === 'rejected' ? result.reason.message : null
        }))
      };

    } catch (error) {
      logger.error(`Auto-download failed for query "${query}":`, error);
      throw error;
    }
  }

  // Queue a single download
  async queueDownload(url, userId, options = {}) {
    const downloadService = await import('./downloadService.js');
    
    return downloadService.default.addDownloadJob(url, {
      userId,
      quality: options.quality || '192k',
      format: options.format || 'mp3',
      audioOnly: options.audioOnly !== false,
      priority: options.priority || 5
    });
  }

  // Get maxDownloads setting from database
  async getMaxDownloadsSetting() {
    try {
      const { query } = await import('../config/database.js');
      const result = await query(
        'SELECT setting_value FROM global_settings WHERE setting_key = $1',
        ['max_auto_downloads']
      );

      return result.rows.length > 0 ? parseInt(result.rows[0].setting_value) : 10;
    } catch (error) {
      logger.warn('Failed to get maxDownloads setting, using default:', error);
      return 10; 
    }
  }
}

export default new YouTubeService();
