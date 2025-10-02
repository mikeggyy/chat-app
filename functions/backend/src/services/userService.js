import { firebaseAdmin, firestore, storage } from './firebaseAdmin.js';
import { buildMembershipRecordFromClaims, normalizeMembershipRecord, DEFAULT_MEMBERSHIP_TIER } from '../utils/membership.js';

const { FieldValue } = firebaseAdmin.firestore;
const usersCollection = firestore.collection('users');

const MAX_DISPLAY_NAME_LENGTH = 80;
const MAX_TAGLINE_LENGTH = 160;
const MAX_DEFAULT_PROMPT_LENGTH = 1200;
const MAX_PHOTO_URL_LENGTH = 1024;
const MAX_PHOTO_STORAGE_PATH_LENGTH = 1024;
const MAX_AVATAR_PRESET_LENGTH = 64;
const AVATAR_PRESET_PATTERN = /^[a-zA-Z0-9_-]+$/;

function sanitizeMembershipPayload(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return normalizeMembershipRecord({ tier: value });
  }

  if (typeof value !== 'object') {
    return null;
  }

  return normalizeMembershipRecord(value);
}

function trimString(input, maxLength) {
  if (typeof input !== 'string') return undefined;
  return input.trim().slice(0, maxLength);
}

function assignIfDefined(target, key, value) {
  if (value === undefined) return;
  target[key] = value;
}

function parseTimestamp(value) {
  if (typeof value !== 'string' || !value) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeStoragePath(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (trimmed.startsWith('gs://')) {
    return trimmed.replace(/^gs:\/\/[^\/]+\//, '');
  }
  return trimmed.replace(/^\//, '');
}

async function deleteAvatarFromStorage(path) {
  const normalized = normalizeStoragePath(path);
  if (!normalized) {
    return;
  }
  try {
    const bucket = storage.bucket();
    if (!bucket) {
      return;
    }
    const file = bucket.file(normalized);
    await file.delete({ ignoreNotFound: true });
  } catch (error) {
    console.warn('[userService] Failed to delete previous avatar from storage', error);
  }
}
export function mapFirebaseUserToProfile(userRecord, claims = {}, sanitized = {}) {
  const profileOverrides = sanitized.profileOverrides ?? {};

  const providerData = Array.isArray(userRecord?.providerData) ? userRecord.providerData : [];
  const providers = providerData
    .map((provider) => provider?.providerId)
    .filter((providerId) => typeof providerId === 'string' && providerId.length);

  const signInProvider =
    claims?.firebase?.sign_in_provider || providers[0] || 'unknown';

  const displayName =
    trimString(profileOverrides.displayName, 80) ||
    trimString(userRecord?.displayName, 80) ||
    trimString(claims?.name, 80) ||
    null;

  const photoURL =
    trimString(profileOverrides.photoURL, 512) ||
    trimString(userRecord?.photoURL, 512) ||
    trimString(claims?.picture, 512) ||
    null;

  const email =
    trimString(userRecord?.email, 160) ||
    trimString(claims?.email, 160) ||
    null;

  const phoneNumber =
    trimString(userRecord?.phoneNumber, 32) ||
    trimString(claims?.phone_number, 32) ||
    null;

  const preferencesPayload = {};
  const overridesPreferences = profileOverrides.preferences;
  if (overridesPreferences && typeof overridesPreferences === 'object') {
    assignIfDefined(
      preferencesPayload,
      'language',
      trimString(overridesPreferences.language, 16)
    );
    if (typeof overridesPreferences.marketingOptIn === 'boolean') {
      preferencesPayload.marketingOptIn = overridesPreferences.marketingOptIn;
    }
    if (typeof overridesPreferences.notificationOptIn === 'boolean') {
      preferencesPayload.notificationOptIn = overridesPreferences.notificationOptIn;
    }
  }

  if (typeof profileOverrides.preferredLanguage === 'string') {
    assignIfDefined(
      preferencesPayload,
      'language',
      trimString(profileOverrides.preferredLanguage, 16)
    );
  }
  if (typeof profileOverrides.marketingOptIn === 'boolean') {
    preferencesPayload.marketingOptIn = profileOverrides.marketingOptIn;
  }
  if (typeof profileOverrides.notificationOptIn === 'boolean') {
    preferencesPayload.notificationOptIn = profileOverrides.notificationOptIn;
  }

  const authMetadata = userRecord?.metadata ?? {};
  const creationTime = parseTimestamp(authMetadata.creationTime);
  const lastSignInTime = parseTimestamp(authMetadata.lastSignInTime);

  const profileData = {
    displayName,
    photoURL,
    email,
    emailVerified: Boolean(userRecord?.emailVerified || claims?.email_verified),
    phoneNumber,
    providers,
    signInProvider,
  };

  if (Object.keys(preferencesPayload).length) {
    profileData.preferences = preferencesPayload;
  }

  if (sanitized.locale) {
    profileData.locale = sanitized.locale;
  }

  if (sanitized.timezone) {
    profileData.timezone = sanitized.timezone;
  }

  profileData.authMetadata = {
    creationTime,
    lastSignInTime,
  };

  const claimsMembership = buildMembershipRecordFromClaims(claims ?? {});
  const overrideMembership = sanitizeMembershipPayload(profileOverrides.membership);
  const mergedMembership = normalizeMembershipRecord({
    ...(claimsMembership ?? {}),
    ...(overrideMembership ?? {}),
  });

  if (mergedMembership) {
    profileData.membership = mergedMembership;
  }

  if (typeof profileOverrides.status === 'string' && profileOverrides.status) {
    profileData.status = profileOverrides.status;
  }

  return profileData;
}

function defaultPreferences() {
  return {
    language: 'zh-TW',
    marketingOptIn: false,
    notificationOptIn: true,
  };
}

export async function upsertUserProfile(uid, profileData) {
  const docRef = usersCollection.doc(uid);
  const snapshot = await docRef.get();
  const previousData = snapshot.exists ? snapshot.data() ?? {} : {};
  const previousPhotoStoragePath = typeof previousData.photoStoragePath === 'string' ? previousData.photoStoragePath : null;
  const now = FieldValue.serverTimestamp();

  const payload = {
    ...profileData,
    uid,
    updatedAt: now,
    lastLoginAt: now,
  };

  const normalizedMembership = normalizeMembershipRecord(payload.membership);
  if (normalizedMembership) {
    payload.membership = normalizedMembership;
  } else {
    delete payload.membership;
  }

  if (!snapshot.exists) {
    payload.createdAt = now;
    payload.preferences = {
      ...defaultPreferences(),
      ...(profileData.preferences ?? {}),
    };
    if (!payload.membership) {
      payload.membership = { tier: DEFAULT_MEMBERSHIP_TIER, source: 'default' };
    }
    if (!payload.status) {
      payload.status = 'active';
    }
  }

  await docRef.set(payload, { merge: true });
  const updatedSnapshot = await docRef.get();
  const updatedProfile = serializeUserDocument(updatedSnapshot);

  const previousStoragePath = normalizeStoragePath(previousPhotoStoragePath);
  const nextStoragePath = normalizeStoragePath(updatedProfile?.photoStoragePath);
  if (previousStoragePath && previousStoragePath !== nextStoragePath) {
    await deleteAvatarFromStorage(previousPhotoStoragePath);
  }

  return updatedProfile;
}

function sanitizeProfileUpdate(updates = {}) {
  if (!updates || typeof updates !== 'object') {
    return null;
  }

  const sanitized = {};
  let hasChanges = false;
  let avatarChanged = false;

  const assignTrimmableField = (key, maxLength) => {
    if (!(key in updates)) {
      return;
    }

    const value = updates[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        sanitized[key] = trimmed.slice(0, maxLength);
      } else {
        sanitized[key] = FieldValue.delete();
      }
      hasChanges = true;
    } else if (value === null) {
      sanitized[key] = FieldValue.delete();
      hasChanges = true;
    }
  };

  assignTrimmableField('displayName', MAX_DISPLAY_NAME_LENGTH);
  assignTrimmableField('tagline', MAX_TAGLINE_LENGTH);
  assignTrimmableField('defaultPrompt', MAX_DEFAULT_PROMPT_LENGTH);

  if ('photoURL' in updates) {
    const value = updates.photoURL;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        sanitized.photoURL = trimmed.slice(0, MAX_PHOTO_URL_LENGTH);
      } else {
        sanitized.photoURL = FieldValue.delete();
      }
      hasChanges = true;
      avatarChanged = true;
    } else if (value === null) {
      sanitized.photoURL = FieldValue.delete();
      hasChanges = true;
      avatarChanged = true;
    }
  }

  if ('photoStoragePath' in updates) {
    const value = updates.photoStoragePath;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        sanitized.photoStoragePath = trimmed.slice(0, MAX_PHOTO_STORAGE_PATH_LENGTH);
      } else {
        sanitized.photoStoragePath = FieldValue.delete();
      }
      hasChanges = true;
      avatarChanged = true;
    } else if (value === null) {
      sanitized.photoStoragePath = FieldValue.delete();
      hasChanges = true;
      avatarChanged = true;
    }
  }
  if ('avatarPreset' in updates) {
    const value = updates.avatarPreset;
    if (typeof value === 'string') {
      const trimmed = value.trim().slice(0, MAX_AVATAR_PRESET_LENGTH);
      if (trimmed && AVATAR_PRESET_PATTERN.test(trimmed)) {
        sanitized.avatarPreset = trimmed;
        hasChanges = true;
        avatarChanged = true;
      } else if (!trimmed) {
        sanitized.avatarPreset = FieldValue.delete();
        hasChanges = true;
        avatarChanged = true;
      }
    } else if (value === null) {
      sanitized.avatarPreset = FieldValue.delete();
      hasChanges = true;
      avatarChanged = true;
    }
  }

  return hasChanges ? { payload: sanitized, avatarChanged } : null;
}

export async function getUserProfile(uid) {
  if (typeof uid !== 'string' || !uid) {
    throw new Error('uid is required');
  }

  const docRef = usersCollection.doc(uid);
  const snapshot = await docRef.get();
  return serializeUserDocument(snapshot);
}

export async function updateUserProfile(uid, updates = {}) {
  if (typeof uid !== 'string' || !uid) {
    throw new Error('uid is required');
  }

  const sanitized = sanitizeProfileUpdate(updates);
  if (!sanitized) {
    return null;
  }

  const docRef = usersCollection.doc(uid);
  const snapshot = await docRef.get();
  const previousData = snapshot.exists ? snapshot.data() ?? {} : {};
  const previousPhotoStoragePath = typeof previousData.photoStoragePath === 'string' ? previousData.photoStoragePath : null;
  const now = FieldValue.serverTimestamp();

  const payload = {
    ...sanitized.payload,
    updatedAt: now,
  };

  if (sanitized.avatarChanged) {
    payload.avatarUpdatedAt = now;
  }

  if (!snapshot.exists) {
    payload.uid = uid;
    payload.createdAt = now;
    payload.preferences = defaultPreferences();
    payload.status = 'active';
    payload.membership = { tier: DEFAULT_MEMBERSHIP_TIER, source: 'default' };
  }

  await docRef.set(payload, { merge: true });
  const updatedSnapshot = await docRef.get();
  const updatedProfile = serializeUserDocument(updatedSnapshot);

  if (sanitized.avatarChanged) {
    const previousStoragePath = normalizeStoragePath(previousPhotoStoragePath);
    const nextStoragePath = normalizeStoragePath(updatedProfile?.photoStoragePath);
    if (previousStoragePath && previousStoragePath !== nextStoragePath) {
      await deleteAvatarFromStorage(previousPhotoStoragePath);
    }
  }

  return updatedProfile;
}

export function serializeUserDocument(snapshot) {
  if (!snapshot?.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};
  const toMillis = (value) =>
    typeof value?.toMillis === 'function' ? value.toMillis() : value ?? null;
  const membership = normalizeMembershipRecord(data.membership);
  const preferences =
    data.preferences && typeof data.preferences === 'object' && !Array.isArray(data.preferences)
      ? data.preferences
      : defaultPreferences();

  return {
    uid: snapshot.id,
    displayName: data.displayName ?? null,
    photoURL: data.photoURL ?? null,
    photoStoragePath: typeof data.photoStoragePath === 'string' ? data.photoStoragePath : null,
    avatarPreset:
      typeof data.avatarPreset === 'string' && data.avatarPreset ? data.avatarPreset : null,
    tagline: typeof data.tagline === 'string' ? data.tagline : null,
    defaultPrompt: typeof data.defaultPrompt === 'string' ? data.defaultPrompt : null,
    email: data.email ?? null,
    emailVerified: Boolean(data.emailVerified),
    phoneNumber: data.phoneNumber ?? null,
    providers: Array.isArray(data.providers) ? data.providers : [],
    signInProvider: data.signInProvider ?? null,
    status: data.status ?? 'active',
    preferences,
    locale: data.locale ?? null,
    timezone: data.timezone ?? null,
    membership: membership ?? { tier: DEFAULT_MEMBERSHIP_TIER },
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
    lastLoginAt: toMillis(data.lastLoginAt),
    avatarUpdatedAt: toMillis(data.avatarUpdatedAt),
    authMetadata: data.authMetadata ?? {},
  };
}

export async function recordLoginEvent(uid, event = {}) {
  const docRef = usersCollection.doc(uid).collection('sessions').doc();

  const sanitizedEvent = {};
  const stringFields = new Map([
    ['ip', 64],
    ['userAgent', 256],
    ['provider', 64],
    ['locale', 32],
    ['timezone', 64],
  ]);

  for (const [key, maxLength] of stringFields.entries()) {
    const value = trimString(event[key], maxLength);
    if (value) {
      sanitizedEvent[key] = value;
    }
  }

  if (event.device && typeof event.device === 'object') {
    const allowedDeviceKeys = ['platform', 'osVersion', 'appVersion', 'model'];
    const devicePayload = {};
    for (const key of allowedDeviceKeys) {
      const value = trimString(event.device[key], 120);
      if (value) {
        devicePayload[key] = value;
      }
    }
    if (Object.keys(devicePayload).length) {
      sanitizedEvent.device = devicePayload;
    }
  }

  sanitizedEvent.createdAt = FieldValue.serverTimestamp();

  await docRef.set(sanitizedEvent, { merge: false });
  return docRef.id;
}









