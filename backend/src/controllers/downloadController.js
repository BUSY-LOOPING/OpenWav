import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/database.js';
import ytdlpService from '../services/ytdlpService.js';
import { publishDownloadJob, publishPlaylistJob } from '../services/downloadPublisher.js';

async function checkUserDownloadLimits(userId) {
    const limitResult = await query(
        'SELECT setting_value FROM global_settings WHERE setting_key = $1',
        ['max_downloads_per_user_per_day']
    );
    if (!limitResult.rows.length) return true;

    const dailyLimit = parseInt(limitResult.rows[0].setting_value);
    if (dailyLimit <= 0) return true;

    const countResult = await query(
        `SELECT COUNT(*) as count FROM download_tasks
     WHERE requested_by = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
        [userId]
    );
    return parseInt(countResult.rows[0].count) < dailyLimit;
}

async function createDownloadTask(req, res, next) {
    try {
        const userId = req.user.id;
        const { url, format = 'mp3', quality = '192k' } = req.body;

        if (!url || !format) {
            return res.status(400).json({ error: 'Missing url or format' });
        }
        await ytdlpService.validateUrl(url);

        const canDownload = await checkUserDownloadLimits(userId);
        if (!canDownload) {
            return res.status(429).json({ error: 'Daily download limit exceeded' });
        }

        if (isPlaylistUrl(url)) {
            return createPlaylistTask(req, res, next);
        }

        const taskResult = await query(
            `INSERT INTO download_tasks (url, requested_by, quality, format, status)
       VALUES ($1, $2, $3, $4, 'queued') RETURNING id, created_at`,
            [url, userId, quality, format]
        );

        const taskId = taskResult.rows[0].id;

        // Publish to RabbitMQ — downloader picks this up
        publishDownloadJob({ taskId, url, userId, quality, format });

        res.status(201).json({
            message: 'Download task queued',
            taskId,
            type: 'track'
        });
    } catch (err) {
        next(err);
    }
}

function isPlaylistUrl(url) {
    return (
        url.includes('list=') ||
        url.includes('/playlist') ||
        (url.includes('soundcloud.com') && url.includes('/sets/'))
    );
}

async function getAllDownloadsForUser(req, res, next) {

    try {
        const userId = req.user.id;
        const { status } = req.query;
        const result = await query(
            `SELECT * FROM download_tasks 
     WHERE requested_by = $1 
     ${status ? 'AND status = $2' : ''}
     ORDER BY created_at DESC`,
            status ? [userId, status] : [userId]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
};

async function getDownloadById(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;
        const result = await query('SELECT * FROM downloads WHERE id = $1 AND requested_by = $2', [id, userId]);
        if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
};

async function getDownloadStatus(req, res, next) {
    try {
        const userId = req.user.id;

        const result = await query(`
      SELECT 
        dt.*,
        m.file_path,
        m.file_size,
        m.title as media_title
      FROM download_tasks dt
      LEFT JOIN media m ON dt.media_id = m.id
      WHERE dt.requested_by = $1
      ORDER BY dt.created_at DESC
      LIMIT 20
    `, [userId]);

        const grouped = {
            active: result.rows.filter(r => r.status === 'downloading'),
            queued: result.rows.filter(r => r.status === 'queued'),
            completed: result.rows.filter(r => r.status === 'completed'),
            failed: result.rows.filter(r => r.status === 'failed'),
        };

        res.json(grouped);
    } catch (err) {
        next(err);
    }
}

async function createPlaylistTask(req, res, next) {
    try {
        const userId = req.user.id;
        const { url, format = 'mp3', quality = '192k' } = req.body;

        if (!url) return res.status(400).json({ error: 'Missing url' });

        await ytdlpService.validateUrl(url);

        const canDownload = await checkUserDownloadLimits(userId);
        if (!canDownload) {
            return res.status(429).json({ error: 'Daily download limit exceeded' });
        }

        const playlistResult = await query(
            `INSERT INTO playlist_tasks (url, requested_by, quality, format, status)
       VALUES ($1, $2, $3, $4, 'queued')
       RETURNING id, created_at`,
            [url, userId, quality, format]
        );

        const playlistId = playlistResult.rows[0].id;

        publishPlaylistJob({ playlistId, url, userId, quality, format });

        res.status(201).json({
            message: 'Playlist download queued',
            playlistId,
            type: 'playlist'
        });
    } catch (err) {
        next(err);
    }
}

async function getPlaylistStatus(req, res, next) {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const playlist = await query(
            `SELECT * FROM playlist_tasks WHERE id = $1 AND requested_by = $2`,
            [id, userId]
        );
        if (!playlist.rows.length) return res.status(404).json({ error: 'Not found' });

        const tasks = await query(
            `SELECT * FROM download_tasks WHERE playlist_id = $1 ORDER BY created_at ASC`,
            [id]
        );

        const rows = tasks.rows;
        const total = rows.length;
        const completed = rows.filter(r => r.status === 'completed').length;
        const failed = rows.filter(r => r.status === 'failed').length;

        res.json({
            playlist: playlist.rows[0],
            tasks: rows,
            summary: { total, completed, failed, pending: total - completed - failed },
        });
    } catch (err) {
        next(err);
    }
}



export default {
    createDownloadTask,
    createPlaylistTask,
    getAllDownloadsForUser,
    getDownloadById,
    getDownloadStatus,
    getPlaylistStatus
}
