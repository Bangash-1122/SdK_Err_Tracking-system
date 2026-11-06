import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';

export const s3Client = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT || undefined,
  credentials:
    env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
      ? {
          accessKeyId: env.S3_ACCESS_KEY_ID,
          secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        }
      : undefined,
  forcePathStyle: true, // Necessary for local MinIO / S3-compatible alternatives
});

export interface PresignedUploadOptions {
  key: string;
  bucket?: string;
  contentType?: string;
  expiresInSeconds?: number;
}

export async function generatePresignedUploadUrl(
  options: PresignedUploadOptions
): Promise<string> {
  const {
    key,
    bucket = env.S3_BUCKET_NAME,
    contentType = 'application/octet-stream',
    expiresInSeconds = 900, // 15 minutes default
  } = options;

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

export interface PresignedDownloadOptions {
  key: string;
  bucket?: string;
  expiresInSeconds?: number;
}

export async function generatePresignedDownloadUrl(
  options: PresignedDownloadOptions
): Promise<string> {
  const {
    key,
    bucket = env.S3_BUCKET_NAME,
    expiresInSeconds = 3600, // 1 hour default
  } = options;

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(key: string, bucket = env.S3_BUCKET_NAME): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3Client.send(command);
}

