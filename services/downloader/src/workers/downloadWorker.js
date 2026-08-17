import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { pool } from '../db.js';
import { minioClient, AUDIO_BUCKET } from '../minio.js';
import { logger } from '../utils/logger.js';
import { updateTaskStatus } from '../services/taskService.js';
import { emitProgress } from '../services/redisPublisher.js';

const TEMP_DIR = process.env.TEMP_DOWNLOAD_PATH || '/app/temp';
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';
const AUDIO_QUALITY = process.env.DEFAULT_AUDIO_QUALITY || '192k';

export async function processDownloadJob(msg, channel) {
    let taskId = null;
    let tempFile = null;

    try {
        const payload = JSON.parse(msg.content.toString());
        taskId = payload.taskId;
        const { url, format = 'mp3', quality = AUDIO_QUALITY, requestedBy } = payload;

        emitProgress(taskId, 'started', 0);
        logger.jobStart(taskId, url, { format, quality });

        await updateTaskStatus(taskId, 'downloading');

        const metadata = await extractMetadata(taskId, url);
        emitProgress(taskId, 'downloading', 10, metadata.title);

        tempFile = path.join(TEMP_DIR, `${taskId}.${format}`);
        await runYtdlp(taskId, url, tempFile, format, quality, (percent) => {
            emitProgress(taskId, 'downloading', percent, metadata.title);
        });
        emitProgress(taskId, 'uploading', 90, metadata.title);

        const objectName = `${taskId}.${format}`;
        const fileSize = await uploadToMinio(taskId, tempFile, objectName, format);

        const mediaId = await saveMediaRecord({
            taskId,
            url,
            format,
            quality,
            objectName,
            fileSize,
            requestedBy,
            metadata,
        });

        await updateTaskStatus(taskId, 'completed', { mediaId, progress: 100 });
        emitProgress(taskId, 'completed', 100, metadata.title);
        logger.jobSuccess(taskId, objectName, { mediaId, fileSize });

        channel.ack(msg);
    } catch (err) {
        logger.jobFailed(taskId, err);
        emitProgress(taskId, 'failed', null, null, err.message);

        if (taskId) {
            const retryCount = await incrementRetry(taskId);
            const maxRetries = 3;
            if (retryCount >= maxRetries) {
                await updateTaskStatus(taskId, 'failed', { errorMessage: err.message });
                channel.nack(msg, false, false);
            } else {
                await updateTaskStatus(taskId, 'queued', { errorMessage: err.message });
                channel.nack(msg, false, true);
            }
        } else {
            channel.nack(msg, false, false);
        }
    } finally {
        if (tempFile) {
            await fs.unlink(tempFile).catch(() => { });
        }
    }
}

function extractMetadata(taskId, url) {
    return new Promise((resolve, reject) => {
        const args = [
            '--no-playlist',
            '--dump-single-json',
            '--no-warnings',
            url,
        ];

        logger.ytdlp(taskId, `Extracting metadata for ${url}`);

        const proc = spawn(YTDLP, args);
        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });

        proc.on('close', (code) => {
            if (code !== 0) {
                logger.ytdlp(taskId, `Metadata extraction failed: ${stderr}`);
                resolve(buildFallbackMetadata(url));
                return;
            }

            try {
                const raw = JSON.parse(stdout);
                resolve(parseYtdlpMetadata(raw));
            } catch (e) {
                logger.ytdlp(taskId, `Metadata parse failed: ${e.message}`);
                resolve(buildFallbackMetadata(url));
            }
        });
        proc.on('error', () => resolve(buildFallbackMetadata(url)));
    });
}

function parseYtdlpMetadata(raw) {

    const platform = detectPlatform(raw.webpage_url || raw.original_url || '');

    return {
        title: raw.title || raw.fulltitle || 'Unknown Title',
        description: raw.description || null,
        duration: raw.duration || null,
        thumbnailUrl: raw.thumbnail || pickBestThumbnail(raw.thumbnails),
        viewCount: 0,
        likeCount: 0,
        platform,
        uploader: raw.uploader || raw.channel || null,
        uploaderUrl: raw.uploader_url || raw.channel_url || null,
        uploadDate: raw.upload_date ? parseUploadDate(raw.upload_date) : null,
        tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 20) : [],
        categories: Array.isArray(raw.categories) ? raw.categories : [],
        language: raw.language || null,
        ageLimit: raw.age_limit || 0,
        webpage_url: raw.webpage_url || raw.original_url || null,
        extractor: raw.extractor || null,
        artists: parseArtistNames(raw),
        album: raw.album || null,
        raw: {
            id: raw.id,
            extractor: raw.extractor,
            extractor_key: raw.extractor_key,
            channel_id: raw.channel_id,
            playlist: raw.playlist || null,
            playlist_id: raw.playlist_id || null,
        },
    };
}

function buildFallbackMetadata(url) {
    return {
        title: url,
        description: null,
        duration: null,
        thumbnailUrl: null,
        platform: detectPlatform(url),
        uploader: null,
        uploaderUrl: null,
        viewCount: null,
        likeCount: null,
        uploadDate: null,
        tags: [],
        categories: [],
        language: null,
        ageLimit: 0,
        webpage_url: url,
        extractor: null,
        artists: [],
        album: null,
        raw: {},
    };
}

function detectPlatform(url) {
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    if (/soundcloud\.com/.test(url)) return 'soundcloud';
    if (/vimeo\.com/.test(url)) return 'vimeo';
    return 'unknown';
}

function pickBestThumbnail(thumbnails) {
    if (!Array.isArray(thumbnails) || thumbnails.length === 0) return null;
    const sorted = [...thumbnails]
        .filter(t => t.url)
        .sort((a, b) => (b.width || 0) - (a.width || 0));
    return sorted[0]?.url || null;
}

function parseUploadDate(yyyymmdd) {
    if (!yyyymmdd || yyyymmdd.length !== 8) return null;
    return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function runYtdlp(
    taskId,
    url,
    outputPath,
    format,
    quality,
    onProgress) {
    return new Promise((resolve, reject) => {
        const args = [
            '--no-playlist',
            '-x',
            '--audio-format', format,
            '--audio-quality', quality,
            '--newline',
            '--no-warnings',
            '-o', outputPath,
            url,
        ];

        const proc = spawn(YTDLP, args);

        proc.stdout.on('data', (d) => {
            const line = d.toString().trim();
            logger.ytdlp(taskId, line);

            // "[download]  45.3% of ..."
            const match = line.match(/\[download\]\s+([\d.]+)%/);
            if (match && onProgress) {
                const rawPercent = parseFloat(match[1]);
                const mapped = 10 + (rawPercent * 0.8);
                onProgress(Math.round(mapped));
            }
        });

        proc.stderr.on('data', (d) => {
            logger.ytdlp(taskId, `stderr: ${d.toString().trim()}`);
        });

        proc.on('close', (code) => {
            code === 0 ? resolve() : reject(new Error(`yt-dlp exited with code ${code}`));
        });

        proc.on('error', reject);
    });
}

async function uploadToMinio(taskId, filePath, objectName, format) {
    const mimeTypes = {
        mp3: 'audio/mpeg',
        m4a: 'audio/mp4',
        opus: 'audio/opus',
        flac: 'audio/flac',
        wav: 'audio/wav',
    };

    const stat = await fs.stat(filePath);
    const fileSize = stat.size;

    logger.minio(`Uploading ${objectName} (${fileSize} bytes)`);
    await minioClient.fPutObject(AUDIO_BUCKET, objectName, filePath, {
        'Content-Type': mimeTypes[format] || 'audio/mpeg',
    });
    logger.minio(`Uploaded ${objectName}`);
    return fileSize;
}

function parseArtistNames(raw) {
    const value = raw.artist || raw.creator || raw.uploader || raw.channel || null;
    if (!value) return [];
    return value
        .split(/,|feat\.|ft\.|&|\bx\b/i)
        .map(a => a.trim())
        .filter(Boolean);
}

function slugify(value) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, '')
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function saveMediaRecord({ taskId, url, format, quality, objectName, fileSize, requestedBy, metadata }) {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const mediaResult = await client.query(
            `INSERT INTO media (
                title, description, url, platform, duration,
                file_path, thumbnail_path, file_size,
                format, quality, status, uploaded_by, metadata
            ) VALUES (
                $1, $2, $3, $4, $5,
                $6, $7, $8,
                $9, $10, 'completed', $11, $12
            )
            ON CONFLICT DO NOTHING
            RETURNING id`,
            [
                metadata.title,
                metadata.description,
                url,
                metadata.platform,
                metadata.duration,
                objectName,
                metadata.thumbnailUrl,
                fileSize,
                format,
                quality,
                requestedBy || null,
                JSON.stringify({
                    uploader: metadata.uploader,
                    uploaderUrl: metadata.uploaderUrl,
                    viewCount: metadata.viewCount,
                    likeCount: metadata.likeCount,
                    uploadDate: metadata.uploadDate,
                    tags: metadata.tags,
                    categories: metadata.categories,
                    language: metadata.language,
                    ageLimit: metadata.ageLimit,
                    webpage_url: metadata.webpage_url,
                    extractor: metadata.extractor,
                    raw: metadata.raw,
                }),
            ]
        );

        let mediaId;
        if (mediaResult.rows.length === 0) {
            const existing = await client.query(
                'SELECT id FROM media WHERE url = $1 AND format = $2',
                [url, format]
            );
            mediaId = existing.rows[0]?.id;
        } else {
            mediaId = mediaResult.rows[0].id;
        }

        await client.query(
            'UPDATE download_tasks SET media_id = $1 WHERE id = $2',
            [mediaId, taskId]
        );

        for (const name of metadata.artists) {
            const slug = slugify(name);
            const artistResult = await client.query(
                `INSERT INTO artists (name, slug)
                 VALUES ($1, $2)
                 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [name, slug]
            );
            const artistId = artistResult.rows[0].id;
            await client.query(
                `INSERT INTO media_artists (media_id, artist_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [mediaId, artistId]
            );
        }

        if (metadata.album) {
            const slug = slugify(metadata.album);
            const albumResult = await client.query(
                `INSERT INTO albums (name, slug)
                 VALUES ($1, $2)
                 ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
                 RETURNING id`,
                [metadata.album, slug]
            );
            const albumId = albumResult.rows[0].id;
            await client.query(
                `INSERT INTO media_albums (media_id, album_id)
                 VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`,
                [mediaId, albumId]
            );
        }

        await client.query('COMMIT');
        return mediaId;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

// async function updateTaskStatus(taskId, status, extra = {}) {
//     const fields = ['status = $2', 'updated_at = NOW()'];
//     const values = [taskId, status];
//     let i = 3;

//     if (extra.progress !== undefined) { fields.push(`progress = $${i++}`); values.push(extra.progress); }
//     if (extra.mediaId) { fields.push(`media_id = $${i++}`); values.push(extra.mediaId); }
//     if (extra.errorMessage) { fields.push(`error_message = $${i++}`); values.push(extra.errorMessage); }
//     if (status === 'downloading') { fields.push('started_at = NOW()'); }
//     if (status === 'completed' || status === 'failed') { fields.push('completed_at = NOW()'); }

//     await pool.query(
//         `UPDATE download_tasks SET ${fields.join(', ')} WHERE id = $1`,
//         values
//     );
// }

async function incrementRetry(taskId) {
    const result = await pool.query(
        `UPDATE download_tasks
         SET retry_count = retry_count + 1, updated_at = NOW()
         WHERE id = $1
         RETURNING retry_count`,
        [taskId]
    );
    return result.rows[0]?.retry_count ?? 0;
}