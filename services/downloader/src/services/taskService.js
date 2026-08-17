import { pool } from '../db.js';
import { logger } from '../utils/logger.js';


export async function updateTaskStatus(taskId, status, extra = {}) {
    const fields = ['status = $2', 'updated_at = NOW()'];
    const values = [taskId, status];
    let i = 3;

    if (extra.progress !== undefined) { fields.push(`progress = $${i++}`);      values.push(extra.progress); }
    if (extra.mediaId)                { fields.push(`media_id = $${i++}`);      values.push(extra.mediaId); }
    if (extra.errorMessage)           { fields.push(`error_message = $${i++}`); values.push(extra.errorMessage); }
    if (status === 'downloading')     { fields.push('started_at = NOW()'); }
    if (status === 'completed' || status === 'failed') { fields.push('completed_at = NOW()'); }

    try {
        await pool.query(
            `UPDATE download_tasks SET ${fields.join(', ')} WHERE id = $1`,
            values
        );
        logger.info(`[task:${taskId}] status → ${status}`);
    } catch (err) {
        logger.error(`[task:${taskId}] updateTaskStatus failed:`, err.message);
        throw err;
    }
}


export async function updatePlaylistStatus(playlistId, status, extra = {}) {
    const fields = ['status = $2', 'updated_at = NOW()'];
    const values = [playlistId, status];
    let i = 3;

    if (extra.totalTracks)  { fields.push(`total_tracks = $${i++}`);  values.push(extra.totalTracks); }
    if (extra.errorMessage) { fields.push(`error_message = $${i++}`); values.push(extra.errorMessage); }

    try {
        await pool.query(
            `UPDATE playlist_tasks SET ${fields.join(', ')} WHERE id = $1`,
            values
        );
        logger.info(`[playlist:${playlistId}] status → ${status}`);
    } catch (err) {
        logger.error(`[playlist:${playlistId}] updatePlaylistStatus failed:`, err.message);
        throw err;
    }
}