import amqplib from 'amqplib';
import { logger } from './utils/logger.js';

export const QUEUE_DOWNLOAD = 'downloads';
export const QUEUE_DOWNLOAD_DEAD = 'downloads.dead';
export const EXCHANGE_DOWNLOAD = 'downloads.exchange';
 
let connection = null;
let channel = null;
 
export async function connectRabbit(retries = 10, delayMs = 3000) {
  for (let i = 1; i <= retries; i++) {
    try {
      connection = await amqplib.connect(process.env.RABBITMQ_URL);
      channel = await connection.createChannel();

      await channel.assertExchange(EXCHANGE_DOWNLOAD, 'direct', { durable: true });

      await channel.assertQueue(QUEUE_DOWNLOAD_DEAD, { durable: true });

      await channel.assertQueue(QUEUE_DOWNLOAD, {
        durable: true,
        arguments: {
          'x-dead-letter-exchange': EXCHANGE_DOWNLOAD,
          'x-dead-letter-routing-key': QUEUE_DOWNLOAD_DEAD,
        },
      });

      await channel.bindQueue(QUEUE_DOWNLOAD, EXCHANGE_DOWNLOAD, QUEUE_DOWNLOAD);
      await channel.bindQueue(QUEUE_DOWNLOAD_DEAD, EXCHANGE_DOWNLOAD, QUEUE_DOWNLOAD_DEAD);

      channel.prefetch(Number(process.env.CONCURRENT_DOWNLOADS) || 3);

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

export function getChannel() {
  return channel;
}