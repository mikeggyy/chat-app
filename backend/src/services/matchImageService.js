import { openai } from './openaiClient.js';
import { firebaseAdmin, firestore, storage } from './firebaseAdmin.js';

const DEFAULT_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1';
const DEFAULT_IMAGE_SIZE = process.env.OPENAI_IMAGE_SIZE ?? '1024x1024';

function normalizeBucketName(bucket) {
  if (!bucket) return null;
  return bucket.replace(/^gs:\/\//, '');
}

function resolveBucketName(overrideBucket) {
  const normalizedOverride = normalizeBucketName(overrideBucket);
  if (normalizedOverride) {
    return normalizedOverride;
  }

  const appOptions = firebaseAdmin.app().options ?? {};
  if (appOptions.storageBucket) {
    return appOptions.storageBucket;
  }

  const envBucket =
    process.env.FIREBASE_STORAGE_BUCKET || process.env.FIREBASE_STORAGE_BUCKET_NAME;
  if (envBucket) {
    return normalizeBucketName(envBucket);
  }

  return null;
}

function buildRoleImagePrompt(role, overridePrompt) {
  if (overridePrompt) {
    return overridePrompt;
  }

  const name = role?.name ?? 'AI companion persona';
  const persona = role?.persona ?? '';
  const summary = role?.summary ?? role?.bio ?? '';
  const tags = Array.isArray(role?.tags) ? role.tags.join(', ') : '';
  const tone = role?.traits?.tone ?? '';
  const energy = role?.traits?.energy ?? '';

  const traits = [tags, tone, energy]
    .filter((value) => typeof value === 'string' && value.trim().length)
    .join(', ');

  const accent = role?.accentColor ? `with ${role.accentColor} accent lighting` : '';

  return [
    `High detail portrait of ${name}.`,
    persona ? `Persona: ${persona}.` : '',
    summary ? `Mood: ${summary}.` : '',
    traits ? `Key traits: ${traits}.` : '',
    accent,
    'Digital illustration, cinematic lighting, futuristic aesthetic, 4k, no text, no typography, focus on character, shoulders up, rich color palette.',
  ]
    .filter(Boolean)
    .join(' ');
}

function normalizeObjectPath(roleId, overridePath) {
  if (overridePath) {
    return overridePath.replace(/^\//, '');
  }
  return `match/roles/${roleId}/cover.png`;
}

export async function generateRoleCoverImage(role, options = {}) {
  if (!role || !role.id) {
    throw new Error('A valid role object with id is required when generating images.');
  }

  if (!options.force && role.coverImageUrl) {
    return {
      skipped: true,
      reason: 'coverImageUrl already exists. Pass force=true to regenerate the image.',
      url: role.coverImageUrl,
    };
  }

  const bucketName = resolveBucketName(options.bucket);

  if (!bucketName) {
    throw new Error(
      'Firebase Storage bucket is not configured. Set FIREBASE_STORAGE_BUCKET or FIREBASE_STORAGE_BUCKET_NAME.'
    );
  }

  const bucket = storage.bucket(bucketName);
  const objectPath = normalizeObjectPath(role.id, options.objectPath);
  const prompt = buildRoleImagePrompt(role, options.prompt);
  const model = options.model ?? DEFAULT_IMAGE_MODEL;
  const size = options.size ?? DEFAULT_IMAGE_SIZE;

  const imageResponse = await openai.images.generate({
    model,
    prompt,
    size,
    response_format: 'b64_json',
  });

  const imageData = imageResponse?.data?.[0]?.b64_json;
  if (!imageData) {
    throw new Error('OpenAI image API did not return image data.');
  }

  const buffer = Buffer.from(imageData, 'base64');
  const file = bucket.file(objectPath);

  await file.save(buffer, {
    metadata: {
      contentType: 'image/png',
      cacheControl: 'public,max-age=31536000,immutable',
    },
    resumable: false,
  });

  if (options.makePublic !== false) {
    try {
      await file.makePublic();
    } catch (error) {
      console.warn(
        '[match-image] makePublic failed. Falling back to signed URLs if the bucket is private.',
        error
      );
    }
  }

  const filePathForUrl = encodeURI(objectPath).replace(/%5C/g, '/');
  const publicUrl =
    options.publicUrl ?? `https://storage.googleapis.com/${bucket.name}/${filePathForUrl}`;

  const docRef = firestore.collection('ai_roles').doc(role.id);
  const timestamp = firebaseAdmin.firestore.FieldValue.serverTimestamp();
  const updatePayload = {
    coverImageUrl: publicUrl,
    updatedAt: timestamp,
  };

  if (!role.portraitImageUrl || options.alwaysUpdatePortrait) {
    updatePayload.portraitImageUrl = publicUrl;
  }

  await docRef.set(updatePayload, { merge: true });

  return {
    bucket: bucket.name,
    objectPath,
    url: publicUrl,
    prompt,
    model,
    size,
  };
}