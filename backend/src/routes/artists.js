import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import artistService from '../services/artistService.js';

const router = express.Router();

router.get('/search/:query', async (req, res, next) => {
  try {
    const artists = await artistService.searchArtists(req.params.query);
    
    res.json({
      success: true,
      artists
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const artist = await artistService.getArtistWithMedia(req.params.id);
    
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: 'Artist not found'
      });
    }

    res.json({
      success: true,
      artist
    });
  } catch (error) {
    next(error);
  }
});

export default router;
