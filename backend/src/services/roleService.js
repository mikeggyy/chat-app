import crypto from 'node:crypto';
import { firebaseAdmin, firestore } from './firebaseAdmin.js';
import { seedAiRoles } from '../data/aiRolesSeed.js';

const { FieldValue } = firebaseAdmin.firestore;
const rolesCollection = firestore.collection('ai_roles');

const ROLE_ID_LENGTH = 10;
const ROLE_ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const ROLE_ID_MAX_ATTEMPTS = 12;
const DEFAULT_ROLE_GENDER = '無性別';
const GENDER_ALIASES = new Map([
  ['male', '男'],
  ['m', '男'],
  ['boy', '男'],
  ['男性', '男'],
  ['man', '男'],
  ['男', '男'],
  ['gentleman', '男'],
  ['sir', '男'],
  ['女', '女'],
  ['female', '女'],
  ['f', '女'],
  ['girl', '女'],
  ['女性', '女'],
  ['woman', '女'],
  ['lady', '女'],
  ['madam', '女'],
  ['無性別', '無性別'],
  ['none', '無性別'],
  ['無', '無性別'],
  ['未指定', '無性別'],
  ['unknown', '無性別'],
  ['n/a', '無性別'],
  ['na', '無性別'],
  ['undefined', '無性別'],
  ['neutral', '無性別'],
]);
const GENDER_CANONICAL_VALUES = ['男', '女', '無性別'];

function requestError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function trimString(value, maxLength) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return typeof maxLength === 'number' && maxLength > 0
    ? trimmed.slice(0, maxLength)
    : trimmed;
}

function requireString(fieldName, value, maxLength) {
  const trimmed = trimString(value, maxLength);
  if (!trimmed) {
    throw requestError(`${fieldName} 為必填欄位`);
  }
  return trimmed;
}

function optionalString(value, maxLength) {
  return trimString(value, maxLength);
}


function normalizeGenderValue(value) {
  const trimmed = trimString(value);
  if (!trimmed) {
    return null;
  }

  const lower = trimmed.toLowerCase();
  if (GENDER_ALIASES.has(lower)) {
    return GENDER_ALIASES.get(lower);
  }
  if (GENDER_ALIASES.has(trimmed)) {
    return GENDER_ALIASES.get(trimmed);
  }
  if (GENDER_CANONICAL_VALUES.includes(trimmed)) {
    return trimmed;
  }

  return null;
}

function sanitizeGender(value, { required = false } = {}) {
  const normalized = normalizeGenderValue(value);
  if (normalized) {
    return normalized;
  }

  const hasValue = typeof value === 'string' ? value.trim().length > 0 : value != null;
  if (required || hasValue) {
    throw requestError('性別僅能為 男、女 或 無性別');
  }

  return null;
}

function generateRoleIdCandidate() {
  const bytes = crypto.randomBytes(ROLE_ID_LENGTH);
  const alphabetLength = ROLE_ID_ALPHABET.length;
  let id = '';

  for (let index = 0; index < bytes.length; index += 1) {
    const charIndex = bytes[index] % alphabetLength;
    id += ROLE_ID_ALPHABET.charAt(charIndex);
  }

  return id;
}

async function generateUniqueRoleDocId() {
  for (let attempt = 0; attempt < ROLE_ID_MAX_ATTEMPTS; attempt += 1) {
    const candidate = generateRoleIdCandidate();
    const snapshot = await rolesCollection.doc(candidate).get();
    if (!snapshot.exists) {
      return candidate;
    }
  }

  throw requestError('無法產生唯一的角色 ID，請稍後再試');
}
async function findRoleDocBySlug(slugValue) {
  const trimmed = trimString(slugValue);
  if (!trimmed) {
    return null;
  }

  const normalized = slugify(trimmed);
  if (!normalized) {
    return null;
  }

  const snapshot = await rolesCollection.where('slug', '==', normalized).limit(1).get();
  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return { docRef: doc.ref, snapshot: doc };
}

async function ensureUniqueSlug(slug, excludeDocId) {
  const normalized = slugify(slug);
  if (!normalized) {
    throw requestError('slug 為必填欄位');
  }

  const snapshot = await rolesCollection.where('slug', '==', normalized).limit(1).get();
  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    if (!excludeDocId || doc.id !== excludeDocId) {
      throw requestError('角色代稱已存在，請使用其他代稱。', 409);
    }
  }

  return normalized;
}

async function resolveRoleDocument(identifier) {
  const trimmed = trimString(identifier);
  if (!trimmed) {
    return null;
  }

  const directRef = rolesCollection.doc(trimmed);
  const directSnapshot = await directRef.get();
  if (directSnapshot.exists) {
    return { docRef: directRef, snapshot: directSnapshot };
  }

  return findRoleDocBySlug(trimmed);
}
function sanitizeStringArray(value, { fieldName, maxItems = 8, maxLength = 64, allowEmpty = false }) {
  const source = Array.isArray(value) ? value : [];
  const sanitized = [];
  const seen = new Set();

  for (const entry of source) {
    const item = trimString(entry, maxLength);
    if (!item || seen.has(item)) continue;
    sanitized.push(item);
    seen.add(item);
    if (sanitized.length >= maxItems) break;
  }

  if (!allowEmpty && sanitized.length === 0) {
    throw requestError(`${fieldName} 至少需要一個項目`);
  }

  return sanitized;
}

function sanitizeTraits(value) {
  const traits = typeof value === 'object' && value !== null ? value : {};
  const tone = optionalString(traits.tone, 32);
  const energy = optionalString(traits.energy, 32);
  const alignment = optionalString(traits.alignment, 32);
  const payload = {};

  if (tone) payload.tone = tone;
  if (energy) payload.energy = energy;
  if (alignment) payload.alignment = alignment;

  return payload;
}

function sanitizePrompt(value) {
  const prompt = typeof value === 'object' && value !== null ? value : {};
  const system = requireString('prompt.system', prompt.system, 4096);
  const goals = sanitizeStringArray(prompt.goals, {
    fieldName: 'prompt.goals',
    maxItems: 6,
    maxLength: 200,
    allowEmpty: true,
  });
  const styleGuide = sanitizeStringArray(prompt.styleGuide, {
    fieldName: 'prompt.styleGuide',
    maxItems: 6,
    maxLength: 220,
    allowEmpty: true,
  });

  const payload = {
    system,
  };

  if (goals.length) payload.goals = goals;
  if (styleGuide.length) payload.styleGuide = styleGuide;

  return payload;
}

function sanitizeGuardrails(value) {
  const guardrails = typeof value === 'object' && value !== null ? value : {};
  const disallowedTopics = sanitizeStringArray(guardrails.disallowedTopics, {
    fieldName: 'guardrails.disallowedTopics',
    maxItems: 12,
    maxLength: 160,
    allowEmpty: true,
  });
  const escalation = optionalString(guardrails.escalation, 400);
  const payload = {};

  if (disallowedTopics.length) payload.disallowedTopics = disallowedTopics;
  if (escalation) payload.escalation = escalation;

  return payload;
}


function sanitizeProfile(value) {
  const profile = typeof value === 'object' && value !== null ? value : {};
  const gender = sanitizeGender(profile.gender);
  const age = optionalString(profile.age, 16);
  const occupation = optionalString(profile.occupation, 120);
  const hometown = optionalString(profile.hometown, 80);
  const interests = sanitizeStringArray(profile.interests, {
    fieldName: 'profile.interests',
    maxItems: 10,
    maxLength: 40,
    allowEmpty: true,
  });
  const personality = optionalString(profile.personality, 220);
  const scenario = optionalString(profile.scenario, 220);
  const relationshipGoals = optionalString(profile.relationshipGoals, 200);
  const backstory = optionalString(profile.backstory, 400);
  const conversationHooks = sanitizeStringArray(profile.conversationHooks, {
    fieldName: 'profile.conversationHooks',
    maxItems: 8,
    maxLength: 120,
    allowEmpty: true,
  });
  const signatureItems = sanitizeStringArray(profile.signatureItems, {
    fieldName: 'profile.signatureItems',
    maxItems: 6,
    maxLength: 60,
    allowEmpty: true,
  });
  const languages = sanitizeStringArray(profile.languages, {
    fieldName: 'profile.languages',
    maxItems: 6,
    maxLength: 40,
    allowEmpty: true,
  });

  const payload = {};
  if (gender) payload.gender = gender;
  if (age) payload.age = age;
  if (occupation) payload.occupation = occupation;
  if (hometown) payload.hometown = hometown;
  if (interests.length) payload.interests = interests;
  if (personality) payload.personality = personality;
  if (scenario) payload.scenario = scenario;
  if (relationshipGoals) payload.relationshipGoals = relationshipGoals;
  if (backstory) payload.backstory = backstory;
  if (conversationHooks.length) payload.conversationHooks = conversationHooks;
  if (signatureItems.length) payload.signatureItems = signatureItems;
  if (languages.length) payload.languages = languages;

  return payload;
}

const ALLOWED_STATUSES = new Set(['draft', 'review', 'published', 'retired']);

function sanitizeVisibility(value) {
  const visibility = typeof value === 'object' && value !== null ? value : {};
  const status = (optionalString(visibility.status, 32) ?? 'draft').toLowerCase();

  if (!ALLOWED_STATUSES.has(status)) {
    throw requestError('visibility.status 不在允許清單內');
  }

  const scope = optionalString(visibility.scope, 64) ?? 'private';

  return { status, scope };
}

const ALLOWED_ACCESS = new Set(['free', 'freemium', 'premium', 'vip']);

function sanitizePricing(value) {
  const pricing = typeof value === 'object' && value !== null ? value : {};
  const access = (optionalString(pricing.access, 24) ?? 'free').toLowerCase();

  if (!ALLOWED_ACCESS.has(access)) {
    throw requestError('pricing.access 不在允許清單內');
  }

  const coins = typeof pricing.coins === 'number' && pricing.coins >= 0 ? Math.round(pricing.coins) : 0;

  return { access, coins };
}

function sanitizeMetrics(value) {
  const metrics = typeof value === 'object' && value !== null ? value : {};
  const normalize = (input) => (typeof input === 'number' && input >= 0 ? Math.round(input) : 0);

  return {
    likes: normalize(metrics.likes),
    favorites: normalize(metrics.favorites),
    conversationCount: normalize(metrics.conversationCount),
  };
}

function slugify(input) {
  const trimmed = trimString(input);
  if (!trimmed) return null;

  const normalized = trimmed.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const slug = normalized
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/-{2,}/g, '-')
    .replace(/(^-|-$)/g, '')
    .toLowerCase();

  return slug || null;
}

function sanitizeRolePayload(input) {
  if (!input || typeof input !== 'object') {
    throw requestError('角色資料格式不正確');
  }

  const slugSource =
    input.slug ??
    input.slugId ??
    input.publicId ??
    input.legacyId ??
    input.id ??
    input.name;
  const slug = slugify(slugSource);
  if (!slug) {
    throw requestError('slug 為必填欄位');
  }

  const gender = sanitizeGender(input.gender, { required: true }) ?? DEFAULT_ROLE_GENDER;
  const profile = sanitizeProfile(input.profile);
  const normalizedProfile = profile && typeof profile === 'object' ? { ...profile } : {};
  if (!normalizedProfile.gender) {
    normalizedProfile.gender = gender;
  }

  const payload = {
    slug,
    gender,
    name: requireString('name', input.name, 80),
    persona: requireString('persona', input.persona, 120),
    summary: requireString('summary', input.summary, 400),
    tags: sanitizeStringArray(input.tags, {
      fieldName: 'tags',
      maxItems: 12,
      maxLength: 32,
    }),
    sampleMessages: sanitizeStringArray(input.sampleMessages, {
      fieldName: 'sampleMessages',
      maxItems: 6,
      maxLength: 160,
      allowEmpty: true,
    }),
    coverImageUrl: requireString('coverImageUrl', input.coverImageUrl, 512),
    portraitImageUrl: optionalString(input.portraitImageUrl, 512),
    accentColor: optionalString(input.accentColor, 16),
    traits: sanitizeTraits(input.traits),
    profile: normalizedProfile,
    prompt: sanitizePrompt(input.prompt),
    guardrails: sanitizeGuardrails(input.guardrails),
    visibility: sanitizeVisibility(input.visibility),
    pricing: sanitizePricing(input.pricing),
    metrics: sanitizeMetrics(input.metrics),
  };

  return payload;
}

function toMillis(value) {
  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }
  return value ?? null;
}

export function serializeAiRoleDocument(snapshot) {
  if (!snapshot?.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};
  const visibility = data.visibility ?? {};
  const pricing = data.pricing ?? {};
  const metrics = data.metrics ?? {};

  const slugSource =
    data.slug ??
    data.slugId ??
    data.publicId ??
    data.legacyId ??
    data.id ??
    snapshot.id;
  const slug = slugify(slugSource) ?? snapshot.id;
  const gender = normalizeGenderValue(data.gender) ?? DEFAULT_ROLE_GENDER;

  const profileSource =
    data.profile && typeof data.profile === 'object' ? { ...data.profile } : {};
  if (!profileSource.gender) {
    profileSource.gender = gender;
  }

  return {
    id: snapshot.id,
    slug,
    gender,
    name: data.name ?? null,
    persona: data.persona ?? null,
    summary: data.summary ?? null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    sampleMessages: Array.isArray(data.sampleMessages) ? data.sampleMessages : [],
    coverImageUrl: data.coverImageUrl ?? null,
    portraitImageUrl: data.portraitImageUrl ?? null,
    accentColor: data.accentColor ?? null,
    traits: data.traits ?? {},
    profile: profileSource,
    prompt: data.prompt ?? {},
    guardrails: data.guardrails ?? {},
    visibility: {
      status: visibility.status ?? 'draft',
      scope: visibility.scope ?? 'private',
    },
    pricing: {
      access: pricing.access ?? 'free',
      coins: typeof pricing.coins === 'number' ? pricing.coins : 0,
    },
    metrics: {
      likes: typeof metrics.likes === 'number' ? metrics.likes : 0,
      favorites: typeof metrics.favorites === 'number' ? metrics.favorites : 0,
      conversationCount:
        typeof metrics.conversationCount === 'number' ? metrics.conversationCount : 0,
    },
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

export async function seedRolesIfNeeded(seed = seedAiRoles) {
  if (!Array.isArray(seed) || !seed.length) {
    return;
  }

  for (const role of seed) {
    const sanitized = sanitizeRolePayload(role);
    const existing = await findRoleDocBySlug(sanitized.slug);
    if (existing) {
      continue;
    }

    const docId = await generateUniqueRoleDocId();
    const docRef = rolesCollection.doc(docId);
    const now = FieldValue.serverTimestamp();

    await docRef.set(
      {
        ...sanitized,
        id: docId,
        createdAt: now,
        updatedAt: now,
        seed: {
          appliedAt: now,
          source: 'default',
        },
      },
      { merge: false }
    );
  }
}

export async function listAiRoles({ ensureSeed = true, status } = {}) {
  if (ensureSeed) {
    await seedRolesIfNeeded();
  }

  const snapshot = await rolesCollection.get();
  const roles = snapshot.docs.map(serializeAiRoleDocument).filter(Boolean);

  if (!status) {
    return roles;
  }

  return roles.filter((role) => role.visibility?.status === status);
}

export async function getAiRoleById(id, { ensureSeed = false } = {}) {
  const trimmed = trimString(id);
  if (!trimmed) {
    throw requestError('角色 ID 格式不正確');
  }

  if (ensureSeed) {
    await seedRolesIfNeeded();
  }

  const resolved = await resolveRoleDocument(trimmed);
  if (!resolved) {
    throw requestError('找不到指定的 AI 角色', 404);
  }

  const role = serializeAiRoleDocument(resolved.snapshot);
  if (!role) {
    throw requestError('找不到指定的 AI 角色', 404);
  }

  return role;
}

export async function createAiRole(payload) {
  const sanitized = sanitizeRolePayload(payload);
  const normalizedSlug = await ensureUniqueSlug(sanitized.slug);
  const docId = await generateUniqueRoleDocId();
  const docRef = rolesCollection.doc(docId);
  const now = FieldValue.serverTimestamp();

  await docRef.set(
    {
      ...sanitized,
      slug: normalizedSlug,
      id: docId,
      createdAt: now,
      updatedAt: now,
    },
    { merge: false }
  );

  const saved = await docRef.get();
  return serializeAiRoleDocument(saved);
}

export async function updateAiRole(id, payload) {
  const trimmed = trimString(id);
  if (!trimmed) {
    throw requestError('角色 ID 格式不正確');
  }

  const resolved = await resolveRoleDocument(trimmed);
  if (!resolved) {
    throw requestError('找不到指定的 AI 角色', 404);
  }

  const sanitized = sanitizeRolePayload(payload);
  const normalizedSlug = await ensureUniqueSlug(sanitized.slug, resolved.docRef.id);
  const now = FieldValue.serverTimestamp();

  await resolved.docRef.set(
    {
      ...sanitized,
      slug: normalizedSlug,
      id: resolved.docRef.id,
      updatedAt: now,
    },
    { merge: true }
  );

  const saved = await resolved.docRef.get();
  return serializeAiRoleDocument(saved);
}
