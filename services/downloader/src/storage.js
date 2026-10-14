import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', opus: 'audio/ogg', ogg: 'audio/ogg', flac: 'audio/flac', wav: 'audio/wav', webm: 'audio/webm' };

export function publicReadPolicy(bucket) {
  return JSON.stringify({
    Version: '2012-10-17',
    Statement: [{ Effect: 'Allow', Principal: { AWS: ['*'] }, Action: ['s3:GetObject'], Resource: [`arn:aws:s3:::${bucket}/*`] }],
  });
}

export function createStorage({ env = process.env, client, fetchFn = fetch } = {}) {
  const s3 =
    client ??
    new S3Client({
      endpoint: env.S3_ENDPOINT ?? 'http://localhost:9000',
      region: env.S3_REGION ?? 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: env.S3_ACCESS_KEY ?? 'rustfsadmin', secretAccessKey: env.S3_SECRET_KEY ?? 'rustfsadmin' },
    });
  const audioBucket = env.S3_BUCKET_AUDIO ?? 'audio';
  const coverBucket = env.S3_BUCKET_COVERS ?? 'covers';

  return {
    client: s3,
    async ensureBuckets() {
      for (const bucket of [audioBucket, coverBucket]) {
        try {
          await s3.send(new HeadBucketCommand({ Bucket: bucket }));
        } catch (err) {
          if (err.$metadata?.httpStatusCode !== 404 && err.name !== 'NotFound') throw err;
          await s3.send(new CreateBucketCommand({ Bucket: bucket }));
        }
        await s3.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: publicReadPolicy(bucket) }));
      }
    },
    async uploadAudio(path, key, ext) {
      const { size } = await stat(path);
      await s3.send(
        new PutObjectCommand({ Bucket: audioBucket, Key: key, Body: createReadStream(path), ContentLength: size, ContentType: MIME[ext] ?? 'application/octet-stream', CacheControl: 'public, max-age=31536000, immutable' }),
      );
      return size;
    },
    async uploadCover(url, id) {
      const res = await fetchFn(url, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`cover ${res.status}`);
      const type = res.headers.get('content-type') ?? 'image/jpeg';
      const key = `${id}.${type.includes('webp') ? 'webp' : type.includes('png') ? 'png' : 'jpg'}`;
      const body = Buffer.from(await res.arrayBuffer());
      await s3.send(new PutObjectCommand({ Bucket: coverBucket, Key: key, Body: body, ContentType: type, CacheControl: 'public, max-age=31536000, immutable' }));
      return key;
    },
  };
}
