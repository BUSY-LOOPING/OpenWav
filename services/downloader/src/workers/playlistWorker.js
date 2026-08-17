import { spawn } from 'child_process';
import { pool } from '../db.js';
import { publishDownloadJob } from '../services/downloadPublisher.js';
import { updatePlaylistStatus } from '../services/taskService.js';
import { logger } from '../utils/logger.js';

const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

export async function processPlaylistJob(msg, channel) {
    let playlistId = null;

    try {
        const payload = JSON.parse(msg.content.toString());
        playlistId = payload.taskId;
        const { url, format = 'mp3', quality = '192k', userId  } = payload;

        await updatePlaylistStatus(playlistId, 'resolving');

        const entries = await extractPlaylistEntries(playlistId, url);

        if (entries.length === 0) {
            await updatePlaylistStatus(playlistId, 'failed', { errorMessage: 'No tracks found in playlist' });
            channel.nack(msg, false, false);
            return; 
        }

        await updatePlaylistStatus(playlistId, 'queuing', { totalTracks: entries.length });

        for (const entry of entries) {
            const childTaskId = await insertChildTask({
                playlistId,
                url: entry.url,
                format,
                quality,
                requestedBy: userId,
            });

            await publishDownloadJob({
                taskId: childTaskId,
                url: entry.url,
                format,
                quality,
                requestedBy: userId,
            });
        }

        channel.ack(msg);
    } catch (err) {
        logger.jobFailed(playlistId, err);
        if (playlistId) await updatePlaylistStatus(playlistId, 'failed', { errorMessage: err.message });
        channel.nack(msg, false, false);
    }
}

function extractPlaylistEntries(taskId, url) {
    return new Promise((resolve, reject) => {
        const args = [
            '--flat-playlist',
            '--dump-single-json',
            '--no-warnings',
            url,
        ];

        logger.ytdlp(taskId, `Extracting playlist entries for ${url}`);

        const proc = spawn(YTDLP, args);
        let stdout = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { logger.ytdlp(taskId, `stderr: ${d.toString().trim()}`); });

        proc.on('close', (code) => {
            if (code !== 0) return reject(new Error('Playlist extraction failed'));
            try {
                const raw = JSON.parse(stdout);

                if (!raw.entries) {
                    return resolve([{
                        id:  raw.id,
                        url: raw.webpage_url || url,
                    }]);
                }

                const entries = raw.entries.map((e) => ({
                    id:  e.id,
                    url: e.url ?? `https://www.youtube.com/watch?v=${e.id}`,
                }));

                resolve(entries);
            } catch (e) {
                reject(e);
            }
        });

        proc.on('error', reject);
    });
}

async function insertChildTask({ playlistId, url, format, quality, requestedBy }) {
    const result = await pool.query(
        `INSERT INTO download_tasks (url, format, quality, requested_by, status, playlist_id)
         VALUES ($1, $2, $3, $4, 'queued', $5)
         RETURNING id`,
        [url, format, quality, requestedBy, playlistId]
    );
    return result.rows[0].id;
}