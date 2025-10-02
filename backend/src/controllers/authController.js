import { auth as firebaseAuth } from '../services/firebaseAdmin.js';
import {
  mapFirebaseUserToProfile,
  upsertUserProfile,
  recordLoginEvent,
} from '../services/userService.js';

const RESERVED_CLAIM_KEYS = new Set([
  'aud',
  'auth_time',
  'exp',
  'firebase',
  'iat',
  'iss',
  'sub',
]);

function extractCustomClaims(claims = {}) {
  return Object.entries(claims)
    .filter(([key]) => !RESERVED_CLAIM_KEYS.has(key))
    .reduce((accumulator, [key, value]) => {
      accumulator[key] = value;
      return accumulator;
    }, {});
}

function sanitizeSessionPayload(body = {}) {
  if (typeof body !== 'object' || body === null) {
    return {
      profileOverrides: {},
      device: {},
      locale: null,
      timezone: null,
    };
  }

  const allowedProfileKeys = new Set([
    'displayName',
    'photoURL',
    'preferences',
    'marketingOptIn',
    'notificationOptIn',
    'preferredLanguage',
  ]);

  const profileOverrides = {};
  if (body.profile && typeof body.profile === 'object') {
    for (const [key, value] of Object.entries(body.profile)) {
      if (!allowedProfileKeys.has(key)) continue;
      profileOverrides[key] = value;
    }
  }

  const allowedDeviceKeys = new Set(['platform', 'osVersion', 'appVersion', 'model']);
  const device = {};
  if (body.device && typeof body.device === 'object') {
    for (const [key, value] of Object.entries(body.device)) {
      if (!allowedDeviceKeys.has(key)) continue;
      if (typeof value === 'string' && value.trim()) {
        device[key] = value.trim().slice(0, 120);
      }
    }
  }

  const locale = typeof body.locale === 'string' ? body.locale.slice(0, 32) : null;
  const timezone = typeof body.timezone === 'string' ? body.timezone.slice(0, 64) : null;

  return {
    profileOverrides,
    device,
    locale,
    timezone,
  };
}

export async function verifyToken(req, res, next) {
  try {
    const { idToken } = req.body ?? {};

    if (typeof idToken !== 'string' || !idToken.trim()) {
      return res.status(400).json({ message: 'idToken is required' });
    }

    const decoded = await firebaseAuth.verifyIdToken(idToken.trim(), true);
    res.json({ data: decoded });
  } catch (error) {
    next(error);
  }
}

export async function establishSession(req, res, next) {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const { uid, claims } = req.user;
    const sanitized = sanitizeSessionPayload(req.body ?? {});

    const userRecord = await firebaseAuth.getUser(uid);
    const profilePayload = mapFirebaseUserToProfile(userRecord, claims, sanitized);
    const profile = await upsertUserProfile(uid, profilePayload);

    const loginEventPayload = {
      ip: req.headers['x-forwarded-for']?.toString()?.split(',')[0]?.trim() || req.ip,
      userAgent: req.headers['user-agent'] ?? null,
      device: sanitized.device,
      locale: sanitized.locale,
      timezone: sanitized.timezone,
      provider: profile.signInProvider,
    };

    try {
      await recordLoginEvent(uid, loginEventPayload);
    } catch (logError) {
      // eslint-disable-next-line no-console
      console.error('Failed to record login event', logError);
    }

    res.json({
      data: {
        profile,
        session: {
          uid,
          loginProvider: profile.signInProvider ?? null,
          customClaims: extractCustomClaims(claims ?? {}),
          issuedAt: Date.now(),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}
