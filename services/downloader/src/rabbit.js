import amqplib from 'amqplib';
import { logger } from './utils/logger.js';
import { processDownloadJob } from './workers/downloadWorker.js';
import { processPlaylistJob } from './workers/playlistWorker.js';


export const EXCHANGE_DOWNLOAD   = 'downloads.exchange';
export const QUEUE_DOWNLOAD      = 'downloads';
export const QUEUE_PLAYLIST      = 'playlists';
export const QUEUE_DOWNLOAD_DEAD = 'downloads.dead';

const ROUTING_KEY_DOWNLOAD  = QUEUE_DOWNLOAD;
const ROUTING_KEY_PLAYLIST  = QUEUE_PLAYLIST;
const ROUTING_KEY_DEAD      = QUEUE_DOWNLOAD_DEAD;

let connection = null;
let channel    = null;

export async function connectRabbit(retries = 10, delayMs = 3000) {
    for (let i = 1; i <= retries; i++) {
        try {
            connection = await amqplib.connect(process.env.RABBITMQ_URL);
            channel    = await connection.createChannel();

            await setupTopology(channel);
            await attachConsumers(channel);

            connection.on('error', (err) => {
                logger.rabbitError(err, { context: 'connection error' });
            });

            connection.on('close', () => {
                logger.rabbit('Connection closed — reconnecting in 5s');
                setTimeout(() => connectRabbit(), 5000);
            });

            logger.rabbit('Connected');
            return channel;
        } catch (err) {
            logger.rabbit(`Connection attempt ${i}/${retries} failed — retrying in ${delayMs}ms`);
            if (i === retries) throw err;
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }
}

async function setupTopology(ch) {
    await ch.assertExchange(EXCHANGE_DOWNLOAD, 'direct', { durable: true });

    await ch.assertQueue(QUEUE_DOWNLOAD_DEAD, { durable: true });
    await ch.bindQueue(QUEUE_DOWNLOAD_DEAD, EXCHANGE_DOWNLOAD, ROUTING_KEY_DEAD);

    await ch.assertQueue(QUEUE_DOWNLOAD, {
        durable: true,
        arguments: {
            'x-dead-letter-exchange':    EXCHANGE_DOWNLOAD,
            'x-dead-letter-routing-key': ROUTING_KEY_DEAD,
        },
    });
    await ch.bindQueue(QUEUE_DOWNLOAD, EXCHANGE_DOWNLOAD, ROUTING_KEY_DOWNLOAD);

    await ch.assertQueue(QUEUE_PLAYLIST, {
        durable: true,
        arguments: {
            'x-dead-letter-exchange':    EXCHANGE_DOWNLOAD,
            'x-dead-letter-routing-key': ROUTING_KEY_DEAD,
        },
    });
    await ch.bindQueue(QUEUE_PLAYLIST, EXCHANGE_DOWNLOAD, ROUTING_KEY_PLAYLIST);

    ch.prefetch(Number(process.env.CONCURRENT_DOWNLOADS) || 3);
}

async function attachConsumers(ch) {
    ch.consume(QUEUE_DOWNLOAD, (msg) => {
        if (!msg) return; 
        processDownloadJob(msg, ch);
    });

    ch.consume(QUEUE_PLAYLIST, (msg) => {
        if (!msg) return;
        processPlaylistJob(msg, ch);
    });

    logger.rabbit(`Consuming: ${QUEUE_DOWNLOAD}, ${QUEUE_PLAYLIST}`);
}

export function getChannel() {
    return channel;
}