import { loadEnv } from '../config/env.js';

export const DEFAULT_MEMBERSHIP_TIER = 'visitor';
export const MEMBERSHIP_TIER_ORDER = ['visitor', 'basic', 'basic_plus', 'vip', 'vip_plus'];

const ALIAS_REGISTRY = new Map();

function sanitizeAlias(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  const stringValue = String(value).trim().toLowerCase();
  if (!stringValue) {
    return null;
  }

  return stringValue.replace(/[\\s_\\-\\+]+/g, '');
}

function registerTierAliases(canonical, aliases) {
  const sanitizedCanonical = sanitizeAlias(canonical);
  if (!sanitizedCanonical) {
    return;
  }

  const existing = ALIAS_REGISTRY.get(canonical) ?? new Set();
  existing.add(sanitizedCanonical);

  for (const alias of aliases) {
    const sanitizedAlias = sanitizeAlias(alias);
    if (sanitizedAlias) {
      existing.add(sanitizedAlias);
    }
  }

  ALIAS_REGISTRY.set(canonical, existing);
}

registerTierAliases('visitor', [
  'visitor',
  'guest',
  'tourist',
  'free',
  'freemium',
  'trial',
  'intro',
  '遊客',
  '訪客',
]);

registerTierAliases('basic', [
  'basic',
  'standard',
  'member',
  'starter',
  'core',
  'essential',
  'base',
  'classic',
  'entry',
  '基礎',
  '標準',
]);

registerTierAliases('basic_plus', [
  'basicplus',
  'basicboost',
  'basicboosted',
  'basicupgrade',
  'basicupgraded',
  'basiccoin',
  'basiccoins',
  'memberplus',
  'standardplus',
  'starterplus',
  'coreplus',
  'essentialplus',
  'classicplus',
  'entryplus',
  'silver',
  'silverplus',
  '基礎plus',
  '基礎金幣',
  '基礎升級',
  '基礎增幅',
  '普通金幣',
  '金幣基礎',
]);

registerTierAliases('vip', [
  'vip',
  'premium',
  'platinum',
  'pro',
  '尊榮',
  '白金',
  '貴賓',
  'advance',
  'advanced',
  '尊爵',
  '星級',
]);

registerTierAliases('vip_plus', [
  'vipplus',
  'vipboost',
  'vipboosted',
  'vipupgrade',
  'vipupgraded',
  'vipcoin',
  'vipcoins',
  'premiumplus',
  'platinumplus',
  'proplus',
  'privileged',
  'elite',
  'ultra',
  'ultimate',
  'max',
  'boost',
  'boosted',
  'gold',
  'goldplus',
  'coin',
  'coins',
  'coinplus',
  'upgrade',
  'upgraded',
  'o1',
  'o1preview',
  '金幣',
  '金幣升級',
  '金幣升級ai智能',
  '超頻',
  '超進化',
  '尊榮plus',
  '白金plus',
  '貴賓plus',
  '尊爵plus',
]);

const NUMERIC_TIER_MAP = new Map([
  [0, 'visitor'],
  [1, 'basic'],
  [2, 'vip'],
  [3, 'elite'],
]);

function inferFromSanitizedString(value) {
  if (!value) {
    return null;
  }

  for (const [canonical, aliases] of ALIAS_REGISTRY.entries()) {
    if (aliases.has(value)) {
      return canonical;
    }
  }

  const includes = (needle) => value.includes(needle);

  if (
    includes('vipplus') ||
    includes('vipboost') ||
    includes('vipcoin') ||
    includes('premiumplus') ||
    includes('platinumplus') ||
    includes('proplus') ||
    (includes('vip') && (includes('plus') || includes('boost') || includes('coin') || includes('gold'))) ||
    includes('elite') ||
    includes('ultra') ||
    includes('ultimate') ||
    includes('max')
  ) {
    return 'vip_plus';
  }

  if (
    includes('basicplus') ||
    includes('basicboost') ||
    includes('basiccoin') ||
    includes('memberplus') ||
    includes('standardplus') ||
    includes('starterplus') ||
    includes('coreplus') ||
    includes('essentialplus') ||
    includes('classicplus') ||
    includes('entryplus') ||
    includes('silver') ||
    (includes('basic') && (includes('plus') || includes('boost') || includes('coin'))) ||
    (includes('member') && (includes('plus') || includes('coin')))
  ) {
    return 'basic_plus';
  }

  if (
    includes('vip') ||
    includes('premium') ||
    includes('platinum') ||
    includes('prestige') ||
    includes('尊榮') ||
    includes('白金') ||
    includes('貴賓') ||
    includes('尊爵')
  ) {
    return 'vip';
  }

  if (
    includes('basic') ||
    includes('standard') ||
    includes('member') ||
    includes('starter') ||
    includes('core') ||
    includes('essential') ||
    includes('classic') ||
    includes('entry')
  ) {
    return 'basic';
  }

  if (includes('coin') || includes('gold') || includes('boost')) {
    return 'vip_plus';
  }

  if (includes('free') || includes('guest') || includes('tourist') || includes('trial')) {
    return 'visitor';
  }

  return null;
}
export function normalizeMembershipTier(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    const mapped = NUMERIC_TIER_MAP.get(value);
    if (mapped) {
      return mapped;
    }
    const floored = Math.max(0, Math.min(4, Math.trunc(value)));
    return NUMERIC_TIER_MAP.get(floored) ?? null;
  }

  const sanitized = sanitizeAlias(value);
  if (!sanitized) {
    return null;
  }

  return inferFromSanitizedString(sanitized);
}

function extractFromObject(source, keys) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  for (const key of keys) {
    if (source[key] === undefined) {
      continue;
    }
    const tier = normalizeMembershipTier(source[key]);
    if (tier) {
      return tier;
    }
  }

  return null;
}

function extractFromNestedPaths(source, paths) {
  if (!source || typeof source !== 'object') {
    return null;
  }

  for (const path of paths) {
    let cursor = source;
    let failed = false;

    for (const segment of path) {
      if (!cursor || typeof cursor !== 'object') {
        failed = true;
        break;
      }
      cursor = cursor[segment];
    }

    if (!failed) {
      const tier = normalizeMembershipTier(cursor);
      if (tier) {
        return tier;
      }
    }
  }

  return null;
}

const CLAIM_DIRECT_KEYS = [
  'membershipTier',
  'membership_level',
  'membershipLevel',
  'tier',
  'plan',
  'subscriptionTier',
  'subscription',
  'entitlementTier',
  'aiTier',
  'aiAccess',
  'accessTier',
  'role',
  'membership',
  'level',
];

const CLAIM_NESTED_PATHS = [
  ['membership', 'tier'],
  ['membership', 'level'],
  ['membership', 'plan'],
  ['membership', 'name'],
  ['entitlements', 'ai', 'tier'],
  ['entitlements', 'aiTier'],
  ['entitlements', 'membership', 'tier'],
  ['tiers', 'ai'],
  ['tiers', 'primary'],
];

function extractTierFromArray(value) {
  if (!Array.isArray(value)) {
    return null;
  }

  for (const entry of value) {
    const tier = normalizeMembershipTier(entry);
    if (tier) {
      return tier;
    }
    if (entry && typeof entry === 'object') {
      const nestedTier = normalizeMembershipTier(entry.tier ?? entry.level ?? entry.name);
      if (nestedTier) {
        return nestedTier;
      }
    }
  }

  return null;
}

export function extractTierFromClaims(claims = {}) {
  if (!claims || typeof claims !== 'object') {
    return null;
  }

  const directTier = extractFromObject(claims, CLAIM_DIRECT_KEYS);
  if (directTier) {
    return directTier;
  }

  const nestedTier = extractFromNestedPaths(claims, CLAIM_NESTED_PATHS);
  if (nestedTier) {
    return nestedTier;
  }

  if (Array.isArray(claims.roles)) {
    const tierFromRoles = extractTierFromArray(claims.roles);
    if (tierFromRoles) {
      return tierFromRoles;
    }
  }

  if (Array.isArray(claims.entitlements)) {
    const tierFromEntitlements = extractTierFromArray(claims.entitlements);
    if (tierFromEntitlements) {
      return tierFromEntitlements;
    }
  }

  return null;
}

export function extractTierFromProfile(profile = {}) {
  if (!profile || typeof profile !== 'object') {
    return null;
  }

  const fromDirectKeys = extractFromObject(profile, [
    'membershipTier',
    'plan',
    'tier',
  ]);
  if (fromDirectKeys) {
    return fromDirectKeys;
  }

  const fromMembership = extractFromObject(profile.membership ?? {}, [
    'tier',
    'level',
    'plan',
  ]);
  if (fromMembership) {
    return fromMembership;
  }

  return null;
}

export function extractTierFromConversation(conversation = {}) {
  if (!conversation || typeof conversation !== 'object') {
    return null;
  }

  const tier = extractFromObject(conversation, [
    'membershipTier',
    'lastMembershipTier',
    'accessTier',
    'userTier',
  ]);
  if (tier) {
    return tier;
  }

  return null;
}

export function resolveMembershipTier({
  explicitTier,
  claims,
  profile,
  conversation,
  fallbackTier = DEFAULT_MEMBERSHIP_TIER,
} = {}) {
  const normalizedExplicit = normalizeMembershipTier(explicitTier);
  if (normalizedExplicit) {
    return { tier: normalizedExplicit, source: 'explicit' };
  }

  const tierFromClaims = extractTierFromClaims(claims);
  if (tierFromClaims) {
    return { tier: tierFromClaims, source: 'claims' };
  }

  const tierFromProfile = extractTierFromProfile(profile);
  if (tierFromProfile) {
    return { tier: tierFromProfile, source: 'profile' };
  }

  const tierFromConversation = extractTierFromConversation(conversation);
  if (tierFromConversation) {
    return { tier: tierFromConversation, source: 'conversation' };
  }

  const normalizedFallback = normalizeMembershipTier(fallbackTier) ?? DEFAULT_MEMBERSHIP_TIER;
  return { tier: normalizedFallback, source: 'default' };
}

function parseTemporalValue(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric) && Number.isFinite(numeric)) {
      return numeric;
    }

    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  return null;
}

export function normalizeMembershipRecord(record) {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const tier = normalizeMembershipTier(record.tier ?? record.level ?? record.name);
  if (!tier) {
    return null;
  }

  const normalized = { tier };

  const startedAt = parseTemporalValue(record.startedAt ?? record.startAt ?? record.activatedAt);
  if (startedAt) {
    normalized.startedAt = startedAt;
  }

  const expiresAt = parseTemporalValue(record.expiresAt ?? record.expireAt ?? record.validUntil ?? record.endsAt);
  if (expiresAt) {
    normalized.expiresAt = expiresAt;
  }

  const updatedAt = parseTemporalValue(record.updatedAt ?? record.syncedAt ?? record.refreshedAt);
  if (updatedAt) {
    normalized.updatedAt = updatedAt;
  }

  if (record.source && typeof record.source === 'string') {
    normalized.source = record.source;
  }

  return normalized;
}

export function buildMembershipRecordFromClaims(claims = {}) {
  const tier = extractTierFromClaims(claims);
  if (!tier) {
    return null;
  }

  const record = { tier, source: 'claims' };

  const startedAt = parseTemporalValue(
    claims.membershipStartedAt ??
      claims.membershipStartAt ??
      claims.membership?.startedAt ??
      claims.membership?.startAt ??
      claims.membership?.activatedAt
  );

  if (startedAt) {
    record.startedAt = startedAt;
  }

  const expiresAt = parseTemporalValue(
    claims.membershipExpiresAt ??
      claims.membershipExpireAt ??
      claims.membership?.expiresAt ??
      claims.membership?.expireAt ??
      claims.membership?.validUntil ??
      claims.membership?.endsAt
  );

  if (expiresAt) {
    record.expiresAt = expiresAt;
  }

  const updatedAt = parseTemporalValue(
    claims.membershipUpdatedAt ??
      claims.membership?.updatedAt ??
      claims.membership?.syncedAt
  );
  if (updatedAt) {
    record.updatedAt = updatedAt;
  }

  return record;
}

const MODEL_ENV_MAP = {
  visitor: 'OPENAI_MODEL_VISITOR',
  basic: 'OPENAI_MODEL_BASIC',
  vip: 'OPENAI_MODEL_VIP',
  elite: 'OPENAI_MODEL_ELITE',
};

const MODEL_FALLBACK_MAP = {
  visitor: 'gpt-4o-mini',
  basic: 'gpt-4o',
  vip: 'gpt-4.1',
  elite: 'o1-preview',
};

export function resolveModelForTier(tier) {
  const normalizedTier = normalizeMembershipTier(tier) ?? DEFAULT_MEMBERSHIP_TIER;
  loadEnv();

  const envKey = MODEL_ENV_MAP[normalizedTier];
  const envValue = envKey ? process.env[envKey] : null;
  if (typeof envValue === 'string' && envValue.trim()) {
    return envValue.trim();
  }

  return MODEL_FALLBACK_MAP[normalizedTier] ?? MODEL_FALLBACK_MAP[DEFAULT_MEMBERSHIP_TIER];
}

export function selectModelForContext({
  explicitTier,
  claims,
  profile,
  conversation,
  fallbackTier,
} = {}) {
  const { tier, source } = resolveMembershipTier({
    explicitTier,
    claims,
    profile,
    conversation,
    fallbackTier,
  });

  const model = resolveModelForTier(tier);
  return {
    tier,
    model,
    source,
  };
}









