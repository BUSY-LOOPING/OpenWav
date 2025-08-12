import express from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import playlistService from '../services/playlistService.js';
import { logger } from '../config/logger.js';

const router = express.Router();

router.get('/charts/hot-100/latest', async (req, res, next) => {
  logger.info('hot-100');
  try {
    const playlist = await playlistService.getLatestChartPlaylist('hot-100');
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Hot 100 playlist not found' });
    }
    res.json({ success: true, playlist });
  } catch (error) {
    next(error);
  }
});

router.get('/charts/radio-songs/latest', async (req, res, next) => {
  try {
    const playlist = await playlistService.getLatestChartPlaylist('radio-songs');
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Radio Songs playlist not found' });
    }
    res.json({ success: true, playlist });
  } catch (error) {
    next(error);
  }
});

router.get('/charts/billboard-200/latest', async (req, res, next) => {
  
  try {
    const playlist = await playlistService.getLatestChartPlaylist('billboard-200');
    if (!playlist) {
      return res.status(404).json({ success: false, message: 'Billboard 200 playlist not found' });
    }
    res.json({ success: true, playlist });
  } catch (error) {
    next(error);
  }
});

router.get('/search/:query', async (req, res, next) => {
  logger.info("search");
  try {
    const playlists = await playlistService.searchPlaylists(req.params.query);
    
    res.json({
      success: true,
      playlists
    });
  } catch (error) {
    next(error);
  }
});

router.get('/public', optionalAuth, async (req, res, next) => {
  logger.info('public');
  try {
    const playlists = await playlistService.getPublicPlaylists();
    res.json({ success: true, playlists });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticateToken, async (req, res, next) => {
  try {
    const playlist = await playlistService.createPlaylist({
      ...req.body,
      created_by: req.user.id
    });

    res.status(201).json({
      success: true,
      playlist
    });
  } catch (error) {
    next(error);
  }
});

router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const playlists = await playlistService.getUserPlaylists(req.user.id);
    
    res.json({
      success: true,
      playlists
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const playlist = await playlistService.getPlaylistById(req.params.id, req.user.id);
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: 'Playlist not found'
      });
    }

    res.json({
      success: true,
      playlist
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/tracks', authenticateToken, async (req, res, next) => {
  try {
    const { mediaId, position } = req.body;
    
    await playlistService.addTrackToPlaylist(
      req.params.id, 
      mediaId, 
      req.user.id, 
      position
    );

    res.json({
      success: true,
      message: 'Track added to playlist'
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/tracks/:mediaId', authenticateToken, async (req, res, next) => {
  try {
    await playlistService.removeTrackFromPlaylist(
      req.params.id, 
      req.params.mediaId, 
      req.user.id
    );

    res.json({
      success: true,
      message: 'Track removed from playlist'
    });
  } catch (error) {
    next(error);
  }
});

export default router;
