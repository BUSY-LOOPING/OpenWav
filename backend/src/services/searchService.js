import youtubeService from './youtubeService.js';
import { query } from '../config/database.js';
import {logger} from '../config/logger.js';

class SearchService {
  async unifiedSearch(searchQuery, userId, options = {}) {
    try {
      const { limit = 20, includeYoutube = true } = options;
      
      logger.info(`Performing unified search for: "${searchQuery}"`);
    
      const localResults = await this.searchLocalMedia(searchQuery, limit);
      
      let youtubeResults = [];
      if (includeYoutube) {
        youtubeResults = await this.searchYouTubeMedia(searchQuery, limit);
        
        youtubeResults = this.filterDuplicateResults(localResults, youtubeResults);
      }
      
      return {
        local: localResults,
        youtube: youtubeResults,
        total: localResults.length + youtubeResults.length,
        query: searchQuery
      };
      
    } catch (error) {
      logger.error(`Unified search failed for "${searchQuery}":`, error);
      throw error;
    }
  }

  async searchLocalMedia(searchQuery, limit = 20) {
    try {
      const result = await query(
        `SELECT 
          m.id,
          m.title,
          m.description,
          m.duration,
          m.format,
          m.quality,
          m.file_size,
          m.thumbnail_path,
          m.created_at,
          m.url as original_url,
          json_agg(
            json_build_object(
              'id', a.id,
              'name', a.name,
              'role', ma.role
            )
          ) FILTER (WHERE a.id IS NOT NULL) as artists
         FROM media m
         LEFT JOIN media_artists ma ON m.id = ma.media_id
         LEFT JOIN artists a ON ma.artist_id = a.id
         WHERE m.status = 'completed' 
           AND (
             m.title ILIKE $1 
             OR m.description ILIKE $1
             OR EXISTS (
               SELECT 1 FROM media_artists ma2 
               JOIN artists a2 ON ma2.artist_id = a2.id 
               WHERE ma2.media_id = m.id AND a2.name ILIKE $1
             )
           )
         GROUP BY m.id
         ORDER BY 
           CASE WHEN m.title ILIKE $2 THEN 1 ELSE 2 END,
           m.created_at DESC
         LIMIT $3`,
        [`%${searchQuery}%`, `${searchQuery}%`, limit]
      );

      return result.rows.map(row => ({
        ...row,
        source: 'local',
        isDownloaded: true,
        canPlay: true,
        streamUrl: `/api/media/${row.id}/stream`,
        downloadUrl: null
      }));
      
    } catch (error) {
      logger.error('Local media search failed:', error);
      throw error;
    }
  }

  // Search YouTube API
  async searchYouTubeMedia(searchQuery, limit = 20) {
    try {
      const videos = await youtubeService.searchVideos(searchQuery, limit);
      
      return videos.map(video => ({
        id: video.videoId,
        title: video.title,
        description: video.description,
        duration: null, 
        format: null,
        quality: null,
        file_size: null,
        thumbnail_path: video.thumbnail,
        created_at: video.publishedAt,
        original_url: video.url,
        artists: [{
          id: null,
          name: video.channelTitle,
          role: 'channel'
        }],
        source: 'youtube',
        isDownloaded: false,
        canPlay: false,
        streamUrl: null,
        downloadUrl: video.url,
        videoId: video.videoId
      }));
      
    } catch (error) {
      logger.error('YouTube search failed:', error);
      return [];
    }
  }

  // Filter out YouTube results that already exist locally
  filterDuplicateResults(localResults, youtubeResults) {
    const localTitles = new Set(
      localResults.map(item => 
        this.normalizeTitle(item.title)
      )
    );
    
    const localUrls = new Set(
      localResults
        .filter(item => item.original_url)
        .map(item => item.original_url)
    );

    return youtubeResults.filter(ytItem => {
      const normalizedTitle = this.normalizeTitle(ytItem.title);
      
      // Filter out if we already have this title or URL
      return !localTitles.has(normalizedTitle) && !localUrls.has(ytItem.original_url);
    });
  }

  normalizeTitle(title) {
    return title
      .toLowerCase()
      .replace(/[\[\](){}]/g, '') // Remove brackets
      .replace(/\s+/g, ' ') // Normalize spaces
      .replace(/official|video|music|audio|hd|4k/gi, '') // Remove common words
      .trim();
  }

  async checkIfExists(youtubeUrl) {
    try {
      const result = await query(
        'SELECT id FROM media WHERE url = $1 AND status = $2',
        [youtubeUrl, 'completed']
      );
      
      return result.rows.length > 0 ? result.rows[0].id : null;
    } catch (error) {
      logger.error('Failed to check if media exists:', error);
      return null;
    }
  }
}

export default new SearchService();
