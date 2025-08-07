import express from 'express';
const router = express.Router();
import downloadController from '../controllers/downloadController.js';
import { authenticateToken } from '../middleware/auth.js';

router.get('/', authenticateToken, downloadController.getAllDownloadsForUser);

router.post('/', authenticateToken, downloadController.createDownloadTask);

router.get('/:id', authenticateToken, downloadController.getDownloadById);

export default router;
