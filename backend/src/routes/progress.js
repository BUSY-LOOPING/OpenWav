import express from 'express';
import { query } from '../config/database.js';
import { addProgressListener, removeProgressListener } from '../config/redis.js';
import { vertifyToken } from '../middleware/auth.js';

const router = express.Router();
// router.use(authenticateToken);

router.get('/:taskId', async (req, res) => {
    try {
        const { taskId } = req.params;
        const token = req.headers.authorization?.split(' ')[1] ?? req.query.token;
        await vertifyToken(token)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        const result = await query(
            'SELECT status, progress FROM download_tasks WHERE id = $1',
            [taskId]
        );
        const task = result.rows[0];

        if (!task) {
            res.write(`data: ${JSON.stringify({ taskId, status: 'not_found' })}\n\n`);
            res.end();
            return;
        }

        // Already terminal — send current state and close immediately
        if (task.status === 'completed' || task.status === 'failed') {
            res.write(`data: ${JSON.stringify({ taskId, status: task.status, progress: task.progress })}\n\n`);
            res.end();
            return;
        }

        addProgressListener(taskId, res);
        const heartbeat = setInterval(() => {
            if (!res.writableEnded) {
                res.write(': ping\n\n');
            }
        }, 15000);

        req.on('close', () => {
            clearInterval(heartbeat);
            removeProgressListener(taskId, res);
        });

    } catch (err) {
        res.write(`data: ${JSON.stringify({ taskId, status: 'error', error: err.message })}\n\n`);
        res.end();
    }
});

export default router;