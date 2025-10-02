import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';

import { loadEnv } from '../src/config/env.js';
import { storage } from '../src/services/firebaseAdmin.js';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..', '..');
const assetsDir = path.resolve(projectRoot, 'frontend', 'src', 'assets', 'characters');

const bucket = storage.bucket();

const files = [
  {
    id: 'emilia-saint',
    local: 'character-aurora.jpg',
  },
  {
    id: 'luna-dj',
    local: 'character-luna.jpg',
  },
  {
    id: 'sora-officer',
    local: 'character-nova.jpg',
  },
];

async function ensureFileExists(filePath) {
  try {
    await fs.access(filePath);
  } catch (error) {
    throw new Error(`找不到檔案: ${filePath}`);
  }
}

async function uploadFile({ id, local }) {
  const sourcePath = path.resolve(assetsDir, local);
  await ensureFileExists(sourcePath);

  const destination = `ai-roles/${id}/portrait.jpg`;

  await bucket.upload(sourcePath, {
    destination,
    metadata: {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    },
    public: true,
    gzip: false,
  });

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${destination}`;
  return { id, publicUrl };
}

async function main() {
  if (!bucket || !bucket.name) {
    throw new Error('無法初始化 Firebase Storage bucket');
  }

  const results = [];
  for (const file of files) {
    const result = await uploadFile(file);
    results.push(result);
    console.log(`${file.id} -> ${result.publicUrl}`);
  }

  return results;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
