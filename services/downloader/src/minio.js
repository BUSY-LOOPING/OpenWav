import { Client } from 'minio';

export const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT || 'minio',
  port: Number(process.env.MINIO_API_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
});

export const AUDIO_BUCKET = process.env.MINIO_BUCKET_AUDIO || 'audio';
export const TEMP_BUCKET = process.env.MINIO_BUCKET_TEMP || 'temp';