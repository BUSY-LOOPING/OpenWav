import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import youtubeService from '../services/youtubeService.js';

const router = express.Router();

router.get('/search', authenticateToken, async (req, res, next) => {
  try {
    const { q: query, maxResults = 50 } = req.query;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const videos = await youtubeService.searchVideos(query, parseInt(maxResults));
    
    res.json({
      success: true,
      query,
      count: videos.length,
      videos
    });
  } catch (error) {
    next(error);
  }
});

router.get('/video/:videoId', authenticateToken, async (req, res, next) => {
  try {
    const { videoId } = req.params;
    const video = await youtubeService.getVideoDetails(videoId);
    
    res.json({
      success: true,
      video
    });
  } catch (error) {
    next(error);
  }
});

// Auto-download videos by search query
router.post('/auto-download', authenticateToken, async (req, res, next) => {
  try {
    const { query, quality = '192k', format = 'mp3' } = req.body;
    const userId = req.user.id;
    
    if (!query) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    const result = await youtubeService.autoDownloadByQuery(query, userId, {
      quality,
      format
    });
    
    res.json({
      success: true,
      message: `Started ${result.downloadCount} downloads for query: ${query}`,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

router.post('/download', authenticateToken, async (req, res, next) => {
  try {
    const { url, videoId, quality = '192k', format = 'mp3' } = req.body;
    const userId = req.user.id;
    
    let downloadUrl = url;
    if (!url && videoId) {
      downloadUrl = `https://www.youtube.com/watch?v=${videoId}`;
    }
    
    if (!downloadUrl) {
      return res.status(400).json({
        success: false,
        message: 'URL or video ID is required'
      });
    }

    const result = await youtubeService.queueDownload(downloadUrl, userId, {
      quality,
      format
    });
    
    res.json({
      success: true,
      message: 'Download queued successfully',
      ...result
    });
  } catch (error) {
    next(error);
  }
});

export default router;
