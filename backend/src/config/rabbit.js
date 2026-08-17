import amqplib from 'amqplib';
import { logger } from '../config/logger.js';

let channel = null;

export const EXCHANGE_DOWNLOAD   = 'downloads.exchange';
export const QUEUE_DOWNLOAD      = 'downloads';
export const QUEUE_PLAYLIST      = 'playlists';
export const QUEUE_DOWNLOAD_DEAD = 'downloads.dead';

const ROUTING_KEY_DOWNLOAD  = QUEUE_DOWNLOAD;
const ROUTING_KEY_PLAYLIST  = QUEUE_PLAYLIST;
const ROUTING_KEY_DEAD      = QUEUE_DOWNLOAD_DEAD;

export async function connectPublisher() {
  const conn = await amqplib.connect(process.env.RABBITMQ_URL);
  const ch = await conn.createChannel();

  await ch.assertExchange('downloads.exchange', 'direct', { durable: true });
  await ch.assertQueue('downloads.dead', { durable: true });
  await ch.assertQueue('downloads', {
    durable: true,
    arguments: {
      'x-dead-letter-exchange': 'downloads.exchange',
      'x-dead-letter-routing-key': 'downloads.dead',
    },
  });
  await ch.bindQueue('downloads', 'downloads.exchange', 'downloads');
  await ch.bindQueue('downloads.dead', 'downloads.exchange', 'downloads.dead');

  channel = ch;
  logger.info('Download publisher connected to RabbitMQ');
}


export function getChannel() {
    return channel;
}