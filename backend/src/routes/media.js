import express from "express";
import { authenticateToken, optionalAuth } from '../middleware/auth.js';
import mediaController from '../controllers/mediaController.js';

const router = express.Router();

router.get('/', optionalAuth, mediaController.getMediaList);

router.get('/:id', optionalAuth, mediaController.getMediaDetails);

router.get('/:id/stream', optionalAuth, mediaController.streamMedia);

router.post('/:id/like', authenticateToken, mediaController.toggleLike);

router.patch('/:id/progress', authenticateToken, mediaController.updateWatchProgress);

router.get('/user/history', authenticateToken, mediaController.getWatchHistory);

export default router;
