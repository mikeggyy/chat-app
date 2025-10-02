import { mapRoleToConversationMetadata } from './roleMappers.js';

const DEFAULT_INTIMACY_LEVEL = 1;
const DEFAULT_INTIMACY_LABEL = '親密度等級 ' + DEFAULT_INTIMACY_LEVEL;

export const DEFAULT_INTIMACY = {
  level: DEFAULT_INTIMACY_LEVEL,
  label: DEFAULT_INTIMACY_LABEL,
};

export function buildDefaultIntimacyLabel(level = DEFAULT_INTIMACY_LEVEL) {
  if (Number.isFinite(level) && level > 0) {
    const normalizedLevel = Math.trunc(level);
    return '親密度等級 ' + normalizedLevel;
  }
  return DEFAULT_INTIMACY_LABEL;
}

export function sanitizeIntimacyLabel(label, fallback = DEFAULT_INTIMACY_LABEL) {
  if (typeof label !== 'string') {
    return fallback;
  }

  const trimmed = label.trim();
  if (!trimmed || trimmed.includes('�')) {
    return fallback;
  }

  const legacyMatch = trimmed.match(/^親密等級\s*(\d+)/);
  if (legacyMatch) {
    return '親密度等級 ' + legacyMatch[1];
  }

  return trimmed;
}

export function normalizeIntimacy(source) {
  if (!source || typeof source !== 'object') {
    return { ...DEFAULT_INTIMACY };
  }

  const rawLevel = typeof source.level === 'number' ? source.level : DEFAULT_INTIMACY.level;
  const level = Number.isFinite(rawLevel) && rawLevel > 0 ? Math.trunc(rawLevel) : DEFAULT_INTIMACY.level;
  const fallbackLabel = buildDefaultIntimacyLabel(level);
  let label = sanitizeIntimacyLabel(source.label, fallbackLabel);

  const match = label.match(/^親密度等級\s*(\d+)/);
  if (match) {
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed !== level) {
      label = fallbackLabel;
    }
  }

  return { level, label };
}

export function buildConversationMetadataFromRole(role) {
  const mapped = mapRoleToConversationMetadata(role);
  return {
    aiRoleId: mapped?.aiRoleId ?? role?.id ?? null,
    aiName: mapped?.aiName ?? role?.name ?? 'AI 夥伴',
    aiPersona: mapped?.aiPersona ?? role?.persona ?? '',
    bio: mapped?.bio ?? role?.summary ?? role?.persona ?? '',
    tags: Array.isArray(mapped?.tags) ? mapped.tags : Array.isArray(role?.tags) ? role.tags : [],
    image: mapped?.image ?? role?.portraitImageUrl ?? role?.coverImageUrl ?? null,
    profile: mapped?.profile ?? role?.profile ?? null,
    card: mapped?.card ?? null,
  };
}
