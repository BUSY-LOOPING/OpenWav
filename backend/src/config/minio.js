import { Client } from 'minio';

export const minioPublicClient = new Client({
  endPoint: process.env.MINIO_PUBLIC_ENDPOINT || 'localhost',
  port: Number(process.env.MINIO_API_PORT) || 9000,
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ROOT_USER,
  secretKey: process.env.MINIO_ROOT_PASSWORD,
});

