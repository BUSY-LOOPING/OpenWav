import amqplib from 'amqplib';
import { logger } from '../config/logger.js';

let channel = null;

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

export function publishDownloadJob(payload) {
  if (!channel) throw new Error('RabbitMQ publisher not connected');
  channel.sendToQueue(
    'downloads',
    Buffer.from(JSON.stringify(payload)),
    { persistent: true }
  );
}