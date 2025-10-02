import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { storage } from './firebaseAdmin.js';

const TARGET_MAX_BYTES = 1 * 1024 * 1024; // 1MB
const QUALITY_STEPS = [90, 80, 70, 60, 50, 45, 40];
const RESIZE_STEPS = [null, 768, 640, 512, 448];
const OUTPUT_MIME_TYPE = 'image/webp';
const OUTPUT_EXTENSION = 'webp';

function ensureBuffer(input) {
  if (!input || !(input instanceof Uint8Array) || input.length === 0) {
    throw new Error('Avatar buffer is empty');
  }
}

function sanitizeUserId(uid) {
  if (typeof uid !== 'string' || !uid.trim()) {
    return 'anonymous';
  }
  return uid.trim().toLowerCase().replace(/[^a-z0-9_-]/gi, '');
}

function buildStoragePath(uid) {
  const safeUid = sanitizeUserId(uid);
  const timestamp = Date.now();
  const token = randomUUID().replace(/-/g, '');
  return 'avatars/users/' + safeUid + '/' + timestamp + '-' + token + '.' + OUTPUT_EXTENSION;
}

async function generateCompressedBuffer(buffer) {
  ensureBuffer(buffer);

  for (const resize of RESIZE_STEPS) {
    for (const quality of QUALITY_STEPS) {
      let transformer = sharp(buffer).rotate();
      if (resize) {
        transformer = transformer.resize({
          width: resize,
          height: resize,
          fit: 'inside',
          withoutEnlargement: true,
        });
      }
      const output = await transformer.webp({ quality, effort: 5 }).toBuffer();
      if (output.length <= TARGET_MAX_BYTES) {
        return output;
      }
    }
  }

  const fallback = await sharp(buffer)
    .rotate()
    .resize({
      width: 384,
      height: 384,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 35, effort: 5 })
    .toBuffer();

  if (fallback.length > TARGET_MAX_BYTES) {
    throw new Error('頭像壓縮失敗，請改用較小的圖片');
  }

  return fallback;
}

export async function processAvatarUpload({ buffer, mimeType, userId }) {
  ensureBuffer(buffer);

  if (!storage) {
    throw new Error('Storage service is not available');
  }

  const bucket = storage.bucket();
  if (!bucket) {
    throw new Error('Storage bucket is not configured');
  }

  const compressedBuffer = await generateCompressedBuffer(buffer);
  const storagePath = buildStoragePath(userId);
  const downloadToken = randomUUID();
  const file = bucket.file(storagePath);

  await file.save(compressedBuffer, {
    contentType: OUTPUT_MIME_TYPE,
    resumable: false,
    metadata: {
      contentType: OUTPUT_MIME_TYPE,
      cacheControl: 'public, max-age=31536000, immutable',
      metadata: {
        firebaseStorageDownloadTokens: downloadToken,
        originalMimeType: mimeType || null,
      },
    },
  });

  const encodedPath = encodeURIComponent(storagePath);
  const bucketName = bucket.name;
  const downloadURL = 'https://firebasestorage.googleapis.com/v0/b/' +
    bucketName +
    '/o/' +
    encodedPath +
    '?alt=media&token=' +
    downloadToken;

  return {
    downloadURL,
    storagePath,
    contentType: OUTPUT_MIME_TYPE,
    size: compressedBuffer.length,
  };
}
