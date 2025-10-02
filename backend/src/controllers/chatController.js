import { firestore } from '../services/firebaseAdmin.js';
import { getAiRoleById } from '../services/roleService.js';
import { streamChatCompletion } from '../services/openaiClient.js';
import {
  normalizeIntimacy,
  sanitizeIntimacyLabel,
  buildDefaultIntimacyLabel,
  buildConversationMetadataFromRole,
} from '../utils/conversationHelpers.js';
import {
  selectModelForContext,
  normalizeMembershipTier,
  DEFAULT_MEMBERSHIP_TIER,
} from '../utils/membership.js';

const SYSTEM_PROMPT = 'You are an empathetic AI companion that follows safety guardrails and replies in Traditional Chinese. Always begin every response with三個 tokens：[[scene:場景]] [[tone:語氣]] [[action:行為]]，括號內請填 2-8 個字並緊貼當前情境。緊接著輸出主要句子（不要再顯示括號或標籤），讓語氣、行為、地點自然融入語境並保持真誠溫柔。';
const SUGGESTION_PROMPT =
  '根據完整的對話內容（包含 AI 的開場白與近期訊息），請提供 3 句使用者可以回覆或主動拓展話題的建議。每個建議請依序先輸出 [[scene:場景]] [[tone:語氣]] [[action:行為]]（括號內 2-8 個字且互不重複），接著輸出主要句子，讓語氣、行為、地點自然融入語境並保持真誠溫柔，每句限 25 個字以內。僅以 JSON 陣列輸出，不要加入其他內容。';

const SUGGESTION_MODEL = (process.env.OPENAI_SUGGESTION_MODEL || '').trim() || 'gpt-4.1-mini';

function conversationCollection(uid) {
  return firestore.collection('users').doc(uid).collection('conversations');
}

function toMillis(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value.toMillis === 'function') {
    try {
      return value.toMillis();
    } catch (error) {
      return null;
    }
  }
  return null;
}

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeTags(input) {
  if (!Array.isArray(input)) {
    return [];
  }
  const tags = [];
  for (const tag of input) {
    const normalized = normalizeString(tag);
    if (normalized) {
      tags.push(normalized);
    }
  }
  return tags;
}

function normalizeSampleMessages(input) {
  if (Array.isArray(input)) {
    return input.map((item) => normalizeString(item)).filter(Boolean);
  }
  if (typeof input === 'string') {
    const normalized = normalizeString(input);
    return normalized ? [normalized] : [];
  }
  if (input && typeof input === 'object') {
    if (Array.isArray(input.messages)) {
      return normalizeSampleMessages(input.messages);
    }
    if (Array.isArray(input.samples)) {
      return normalizeSampleMessages(input.samples);
    }
  }
  return [];
}

function mergeSampleMessages(...sources) {
  const seen = new Set();
  const merged = [];
  for (const source of sources) {
    const normalized = normalizeSampleMessages(source);
    for (const entry of normalized) {
      if (!seen.has(entry)) {
        seen.add(entry);
        merged.push(entry);
      }
    }
  }
  return merged;
}

function normalizeCardPayload(card) {
  if (!card || typeof card !== 'object') {
    return null;
  }

  const persona = normalizeString(card.persona ?? card.aiPersona ?? card.character ?? '');
  const summary =
    normalizeString(card.summary) ||
    normalizeString(card.bio) ||
    normalizeString(card.subtitle) ||
    normalizeString(card.description) ||
    normalizeString(card.greeting) ||
    persona;
  const name = normalizeString(card.name) || 'AI 夥伴';
  const portraitImageUrl =
    normalizeString(card.portraitImageUrl) ||
    normalizeString(card.image) ||
    normalizeString(card.avatar) ||
    null;
  const coverImageUrl = normalizeString(card.coverImageUrl) || portraitImageUrl || null;
  const tags = normalizeTags(card.tags);
  const sampleMessages = mergeSampleMessages(
    card.sampleMessages,
    card.samples,
    card.greeting,
    card.exampleMessages,
    card.examples
  );

  return {
    ...card,
    id: typeof card.id === 'string' ? card.id : null,
    name,
    persona,
    summary,
    tags,
    portraitImageUrl,
    coverImageUrl,
    sampleMessages,
    profile: card.profile ?? null,
  };
}
async function buildConversationDefaults(conversationId) {
  const role = await getAiRoleById(conversationId, { ensureSeed: true });
  const metadata = buildConversationMetadataFromRole(role) ?? {};
  const now = Date.now();

  const fallbackCard = role
    ? {
        id: role.id ?? conversationId,
        name: role.name ?? 'AI 夥伴',
        persona: role.persona ?? '',
        summary: role.summary ?? role.persona ?? '',
        tags: Array.isArray(role.tags) ? role.tags : [],
        portraitImageUrl: role.portraitImageUrl ?? role.coverImageUrl ?? null,
        coverImageUrl: role.coverImageUrl ?? null,
        sampleMessages: role.sampleMessages ?? [],
        profile: role.profile ?? null,
        pricing: role.pricing ?? null,
        metrics: role.metrics ?? null,
        accentColor: role.accentColor ?? null,
      }
    : null;
  const card = normalizeCardPayload(metadata.card ?? fallbackCard);

  const intimacy = normalizeIntimacy(metadata.intimacy);
  const defaultIntimacyLabel = buildDefaultIntimacyLabel(intimacy.level);
  let intimacyLabel = defaultIntimacyLabel;
  if (typeof metadata.intimacyLabel === 'string') {
    const sanitizedLabel = sanitizeIntimacyLabel(metadata.intimacyLabel, defaultIntimacyLabel);
    const labelMatch = sanitizedLabel.match(/^親密度等級\s*(\d+)/);
    if (labelMatch) {
      const parsed = Number.parseInt(labelMatch[1], 10);
      intimacyLabel = parsed === intimacy.level ? sanitizedLabel : defaultIntimacyLabel;
    } else if (sanitizedLabel.length) {
      intimacyLabel = sanitizedLabel;
    }
  }
  const normalizedIntimacy = { ...intimacy, label: intimacyLabel };

  const summary =
    normalizeString(metadata.summary) ||
    normalizeString(metadata.bio) ||
    card?.summary ||
    normalizeString(role?.summary) ||
    normalizeString(role?.persona) ||
    '';
  const aiRoleId = metadata.aiRoleId ?? card?.id ?? role?.id ?? conversationId;
  const aiName =
    normalizeString(metadata.aiName) ||
    (card ? card.name : '') ||
    normalizeString(role?.name) ||
    'AI 夥伴';
  const aiPersona =
    normalizeString(metadata.aiPersona) ||
    normalizeString(card?.persona) ||
    normalizeString(role?.persona) ||
    '';
  const tagsFromMetadata = normalizeTags(metadata.tags);
  const tags = tagsFromMetadata.length ? tagsFromMetadata : card?.tags ?? [];
  const image =
    normalizeString(metadata.image) ||
    card?.portraitImageUrl ||
    card?.coverImageUrl ||
    normalizeString(role?.portraitImageUrl) ||
    normalizeString(role?.coverImageUrl) ||
    null;
  const sampleMessages = mergeSampleMessages(
    metadata.sampleMessages,
    card?.sampleMessages,
    role?.sampleMessages
  );

  const payload = {
    conversationId,
    aiRoleId,
    aiName,
    aiPersona,
    bio: summary,
    summary,
    tags,
    image,
    card,
    sampleMessages,
    imageStoragePath: metadata.imageStoragePath ?? null,
    intimacy: normalizedIntimacy,
    intimacyLabel,
    membershipTier: DEFAULT_MEMBERSHIP_TIER,
    lastModel: null,
    lastModelSource: null,
    lastModelAt: null,
    unreadCount: 0,
    isFavorite: false,
    lastMessage: '',
    lastMessageAt: null,
    archivedAt: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  return payload;
}

function normalizeConversationDocument(doc) {
  if (!doc?.exists) {
    return null;
  }

  const data = doc.data() ?? {};
  const intimacy = normalizeIntimacy(data.intimacy);
  const card = normalizeCardPayload(data.card ?? null);
  const storedIntimacyLabel =
    typeof doc.get === 'function' ? doc.get('intimacyLabel') : data.intimacyLabel;
  const defaultIntimacyLabel = buildDefaultIntimacyLabel(intimacy.level);
  let intimacyLabel = defaultIntimacyLabel;
  if (typeof storedIntimacyLabel === 'string') {
    const sanitizedLabel = sanitizeIntimacyLabel(storedIntimacyLabel, defaultIntimacyLabel);
    const labelMatch = sanitizedLabel.match(/^親密度等級\s*(\d+)/);
    if (labelMatch) {
      const parsed = Number.parseInt(labelMatch[1], 10);
      intimacyLabel = parsed === intimacy.level ? sanitizedLabel : defaultIntimacyLabel;
    } else if (sanitizedLabel.length) {
      intimacyLabel = sanitizedLabel;
    }
  }
  const normalizedIntimacy = { ...intimacy, label: intimacyLabel };

  const conversationId = data.conversationId ?? doc.id;
  const aiRoleId = data.aiRoleId ?? card?.id ?? conversationId;
  const aiName =
    normalizeString(data.aiName) ||
    (card ? card.name : '') ||
    'AI 夥伴';
  const aiPersona =
    normalizeString(data.aiPersona) ||
    normalizeString(card?.persona) ||
    '';
  const summary =
    normalizeString(data.summary) ||
    normalizeString(data.bio) ||
    (card ? card.summary : '') ||
    aiPersona;
  const tagsFromData = normalizeTags(data.tags);
  const tags = tagsFromData.length ? tagsFromData : card?.tags ?? [];
  const image =
    normalizeString(data.image) ||
    card?.portraitImageUrl ||
    card?.coverImageUrl ||
    null;
  const sampleMessages = mergeSampleMessages(
    data.sampleMessages,
    data.samples,
    card?.sampleMessages
  );

  const normalizedCard = card
    ? {
        ...card,
        summary: card.summary || summary,
        persona: card.persona || aiPersona,
        tags: card.tags ?? tags,
        sampleMessages,
      }
    : null;

  const membershipTierRaw =
    typeof doc.get === 'function' ? doc.get('membershipTier') : data.membershipTier;
  const membershipTier = normalizeMembershipTier(membershipTierRaw) ?? DEFAULT_MEMBERSHIP_TIER;
  const lastModel = typeof data.lastModel === 'string' ? data.lastModel.trim() || null : null;
  const lastModelSource =
    typeof data.lastModelSource === 'string' ? data.lastModelSource.trim() || null : null;
  const lastModelAtRaw = typeof doc.get === 'function' ? doc.get('lastModelAt') : data.lastModelAt;
  const lastModelAt = toMillis(lastModelAtRaw);
  const archivedAtRaw = typeof doc.get === 'function' ? doc.get('archivedAt') : data.archivedAt;
  const archivedAt = toMillis(archivedAtRaw);
  const isArchived = typeof data.isArchived === 'boolean' ? data.isArchived : Boolean(archivedAt);

  return {
    id: doc.id,
    conversationId,
    aiRoleId,
    aiName,
    aiPersona,
    bio: summary,
    summary,
    tags,
    image,
    imageStoragePath: typeof data.imageStoragePath === 'string' ? data.imageStoragePath : null,
    card: normalizedCard,
    sampleMessages,
    intimacy: normalizedIntimacy,
    intimacyLabel,
    membershipTier,
    lastModel,
    lastModelSource,
    lastModelAt,
    unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
    isFavorite: Boolean(data.isFavorite),
    lastMessage: typeof data.lastMessage === 'string' ? data.lastMessage : '',
    lastMessageAt: typeof data.lastMessageAt === 'number' ? data.lastMessageAt : null,
    lastClearedAt: typeof data.lastClearedAt === 'number' ? data.lastClearedAt : null,
    archivedAt,
    isArchived,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : null,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : null,
  };
}

async function ensureConversationDocument(uid, conversationId) {
  const conversationRef = conversationCollection(uid).doc(conversationId);
  const snapshot = await conversationRef.get();

  if (snapshot.exists) {
    let conversation = normalizeConversationDocument(snapshot);
    const updates = {};

    const metadataMissing =
      !normalizeString(conversation?.aiName) ||
      !conversation?.card ||
      !normalizeString(conversation.card.summary) ||
      !normalizeString(conversation.summary) ||
      !Array.isArray(conversation.sampleMessages) ||
      conversation.sampleMessages.length === 0;

    if (metadataMissing) {
      try {
        const defaults = await buildConversationDefaults(conversationId);
        const patch = {
          aiRoleId: defaults.aiRoleId,
          aiName: defaults.aiName,
          aiPersona: defaults.aiPersona,
          bio: defaults.bio,
          summary: defaults.summary,
          tags: defaults.tags,
          card: defaults.card,
        };
        if (!Array.isArray(conversation.sampleMessages) || !conversation.sampleMessages.length) {
          patch.sampleMessages = defaults.sampleMessages;
        }
        if (!normalizeString(conversation.image) && defaults.image) {
          patch.image = defaults.image;
        }
        await conversationRef.set(patch, { merge: true });
        conversation = { ...conversation, ...patch };
      } catch (error) {
        // ignore metadata refresh errors
      }
    }

    const normalizedTier = normalizeMembershipTier(conversation?.membershipTier);
    if (!normalizedTier) {
      updates.membershipTier = DEFAULT_MEMBERSHIP_TIER;
      conversation = { ...conversation, membershipTier: DEFAULT_MEMBERSHIP_TIER };
    } else if (normalizedTier !== conversation.membershipTier) {
      updates.membershipTier = normalizedTier;
      conversation = { ...conversation, membershipTier: normalizedTier };
    }

    if (conversation.lastModel && typeof conversation.lastModel !== 'string') {
      updates.lastModel = String(conversation.lastModel);
    }

    if (Object.keys(updates).length) {
      try {
        await conversationRef.set(updates, { merge: true });
      } catch (patchError) {
        // ignore membership/model patch errors
      }
      conversation = { ...conversation, ...updates };
    }

    return { conversationRef, conversation, created: false };
  }

  const defaults = await buildConversationDefaults(conversationId);
  await conversationRef.set(defaults, { merge: false });

  return {
    conversationRef,
    conversation: { ...defaults, id: conversationId },
    created: true,
  };
}

async function fetchMessages(uid, conversationId, limit = 40) {
  const messagesSnapshot = await conversationCollection(uid)
    .doc(conversationId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .limit(limit)
    .get();

  return messagesSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));
}

function ensureAssistantContext(history = [], conversation) {
  const normalizedHistory = Array.isArray(history) ? [...history] : [];
  const hasAssistantMessage = normalizedHistory.some((entry) =>
    entry && entry.sender === 'ai' && typeof entry.message === 'string' && entry.message.trim()
  );

  if (hasAssistantMessage) {
    return normalizedHistory;
  }

  const fallbackMessages = mergeSampleMessages(
    conversation?.sampleMessages,
    conversation?.card?.sampleMessages,
    conversation?.card?.greeting,
    conversation?.greeting
  );

  const fallback = fallbackMessages.find((entry) => typeof entry === 'string' && entry.trim());
  if (!fallback) {
    return normalizedHistory;
  }

  normalizedHistory.unshift({
    id: 'synthetic-assistant-intro',
    sender: 'ai',
    message: fallback,
    createdAt: conversation?.createdAt ?? Date.now(),
    synthetic: true,
  });

  return normalizedHistory;
}

function buildPromptFromHistory(history) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  for (const entry of history) {
    if (!entry?.message) continue;
    const role = entry.sender === 'ai' ? 'assistant' : 'user';
    messages.push({ role, content: entry.message });
  }

  return messages;
}

function extractSuggestionText(entry, depth = 0) {
  if (!entry || depth > 6) {
    return '';
  }

  if (typeof entry === 'string') {
    return entry;
  }

  if (Array.isArray(entry)) {
    for (const item of entry) {
      const extracted = extractSuggestionText(item, depth + 1);
      if (extracted) {
        return extracted;
      }
    }
    return '';
  }

  if (typeof entry !== 'object') {
    return '';
  }

  const directKeys = ['text', 'value', 'message', 'content', 'suggestion', 'output'];

  for (const key of directKeys) {
    if (!(key in entry)) {
      continue;
    }
    const value = entry[key];
    if (typeof value === 'string') {
      return value;
    }
    if (value && typeof value === 'object') {
      const extracted = extractSuggestionText(value, depth + 1);
      if (extracted) {
        return extracted;
      }
    }
  }

  for (const value of Object.values(entry)) {
    const extracted = extractSuggestionText(value, depth + 1);
    if (extracted) {
      return extracted;
    }
  }

  return '';
}

function sanitizeSuggestionList(list, { max = 3 } = {}) {
  if (!Array.isArray(list)) {
    return [];
  }

  const maxCount = typeof max === 'number' && max > 0 ? max : 3;
  const seen = new Set();
  const normalized = [];

  for (const entry of list) {
    const queue = Array.isArray(entry) ? entry : [entry];

    for (const candidate of queue) {
      const extracted = extractSuggestionText(candidate);
      if (!extracted || typeof extracted !== 'string') {
        continue;
      }

      let textValue = extracted.trim();
      if (!textValue) {
        continue;
      }

      textValue = textValue
        .replace(/^["']+/, '')
        .replace(/["']+$/, '')
        .trim();

      if (!textValue) {
        continue;
      }

      const key = textValue.toLowerCase();
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      normalized.push(textValue);

      if (normalized.length === maxCount) {
        break;
      }
    }

    if (normalized.length === maxCount) {
      break;
    }
  }

  return normalized;
}

const FALLBACK_SUGGESTION_TOKEN_PRESETS = {
  music: [
    { scene: '[[scene:月光舞台]]', tone: '[[tone:俏皮眨眼]]', action: '[[action:遞上耳機]]' },
    { scene: '[[scene:屋頂派對]]', tone: '[[tone:柔和點頭]]', action: '[[action:陪你搖擺]]' },
    { scene: '[[scene:DJ台前]]', tone: '[[tone:熱情大笑]]', action: '[[action:牽起你的手]]' },
  ],
  comfort: [
    { scene: '[[scene:窗邊沙發]]', tone: '[[tone:柔和細語]]', action: '[[action:遞上熱茶]]' },
    { scene: '[[scene:靜謐夜色]]', tone: '[[tone:溫柔相伴]]', action: '[[action:輕握你的手]]' },
    { scene: '[[scene:柔軟毯子下]]', tone: '[[tone:低聲安慰]]', action: '[[action:陪你呼吸]]' },
  ],
  adventure: [
    { scene: '[[scene:星圖桌前]]', tone: '[[tone:自信微笑]]', action: '[[action:指向航線]]' },
    { scene: '[[scene:夜空甲板]]', tone: '[[tone:爽朗笑聲]]', action: '[[action:攬你入懷]]' },
    { scene: '[[scene:旅程地圖前]]', tone: '[[tone:鼓舞眼神]]', action: '[[action:牽你向前]]' },
  ],
  mentor: [
    { scene: '[[scene:書房暖燈]]', tone: '[[tone:耐心微笑]]', action: '[[action:攤開筆記]]' },
    { scene: '[[scene:靜謐書桌]]', tone: '[[tone:專注點頭]]', action: '[[action:推上茶杯]]' },
    { scene: '[[scene:窗邊書架]]', tone: '[[tone:溫暖凝視]]', action: '[[action:陪你思考]]' },
  ],
  default: [
    { scene: '[[scene:溫暖角落]]', tone: '[[tone:柔和微笑]]', action: '[[action:端上熱茶]]' },
    { scene: '[[scene:夜色沙發]]', tone: '[[tone:細心傾聽]]', action: '[[action:握住你的手]]' },
    { scene: '[[scene:靜夜窗邊]]', tone: '[[tone:溫柔陪伴]]', action: '[[action:一起呼吸]]' },
  ],
};

const FALLBACK_SUGGESTION_SENTENCES = {
  music(name) {
    return [
      `${name}想聽你今晚的節奏。`,
      `想跟${name}討論下一首嗎？`,
      `要不要和${name}續攤聊聊心情？`,
    ];
  },
  comfort(name) {
    return [
      `想和${name}慢慢梳理剛才的情緒嗎？`,
      `${name}在這裡，慢慢說就好。`,
      `需要${name}陪你喘口氣嗎？`,
    ];
  },
  adventure(name) {
    return [
      `想跟${name}計畫下一段旅程嗎？`,
      `${name}準備好一起探索新路線。`,
      `告訴${name}此刻最想追的星光？`,
    ];
  },
  mentor(name) {
    return [
      `想請${name}幫忙梳理一下想法嗎？`,
      `告訴${name}現在的疑問，我在聽。`,
      `和${name}討論下一個目標好嗎？`,
    ];
  },
  default(name) {
    return [
      `想跟${name}聊聊剛才的感覺嗎？`,
      `${name}在這裡，慢慢說給我聽。`,
      `要不要告訴${name}下一步計畫？`,
    ];
  },
};

function inferFallbackSuggestionCluster(conversation) {
  const segments = [];

  const collect = (value) => {
    const normalized = normalizeString(value);
    if (normalized) {
      segments.push(normalized.toLowerCase());
    }
  };

  collect(conversation?.aiPersona);
  collect(conversation?.summary);
  collect(conversation?.bio);
  collect(conversation?.card?.persona);
  collect(conversation?.card?.summary);

  const tags = Array.isArray(conversation?.tags) ? conversation.tags : [];
  const cardTags = Array.isArray(conversation?.card?.tags) ? conversation.card.tags : [];
  for (const tag of [...tags, ...cardTags]) {
    collect(tag);
  }

  const haystack = segments.join(' ');

  if (/dj|音樂|派對|舞池|節奏|混音|樂迷|舞台|beat/.test(haystack)) {
    return 'music';
  }
  if (/療癒|溫柔|陪伴|傾聽|治癒|安慰|守護|暖/.test(haystack)) {
    return 'comfort';
  }
  if (/冒險|旅|星|宇宙|航|探|遠征/.test(haystack)) {
    return 'adventure';
  }
  if (/老師|學習|導師|教練|顧問|研究|策略/.test(haystack)) {
    return 'mentor';
  }

  return 'default';
}

function extractDisplayName(conversation) {
  const candidates = [
    normalizeString(conversation?.aiName),
    normalizeString(conversation?.card?.name),
    'AI夥伴',
  ].filter(Boolean);

  let raw = candidates[0];
  const segments = raw.split(/[\s、,，·•・]+/).filter(Boolean);
  if (segments.length > 1) {
    raw = segments[segments.length - 1];
  }

  const trimmed = raw.trim();
  if (trimmed.length <= 6) {
    return trimmed;
  }

  return trimmed.slice(-6);
}

function buildFallbackSuggestions(conversation, desiredCount = 3) {
  if (desiredCount <= 0) {
    return [];
  }

  const cluster = inferFallbackSuggestionCluster(conversation);
  const tokens = FALLBACK_SUGGESTION_TOKEN_PRESETS[cluster] ?? FALLBACK_SUGGESTION_TOKEN_PRESETS.default;
  const name = extractDisplayName(conversation);
  const sentenceBuilder = FALLBACK_SUGGESTION_SENTENCES[cluster] ?? FALLBACK_SUGGESTION_SENTENCES.default;
  const sentences = sentenceBuilder(name);
  const normalized = [];
  const seen = new Set();

  const tokenPool = tokens.length ? tokens : FALLBACK_SUGGESTION_TOKEN_PRESETS.default;
  const sentencePool = sentences.length ? sentences : FALLBACK_SUGGESTION_SENTENCES.default(name);

  let index = 0;
  while (normalized.length < desiredCount && index < 12) {
    const token = tokenPool[index % tokenPool.length];
    const sentence = sentencePool[index % sentencePool.length];

    if (token && sentence) {
      const suggestion = `${token.scene} ${token.tone} ${token.action} ${sentence}`;
      const key = suggestion.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        normalized.push(suggestion);
      }
    }

    index += 1;
  }

  return normalized;
}
export async function listConversations(req, res, next) {
  try {
    const snapshot = await conversationCollection(req.user.uid)
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .get();

    const conversations = [];

    for (const doc of snapshot.docs) {
      let conversation = normalizeConversationDocument(doc);
      if (!conversation) {
        continue;
      }

      const needsMetadataRefresh =
        !normalizeString(conversation.aiName) ||
        !conversation.card ||
        !normalizeString(conversation.card.summary) ||
        !normalizeString(conversation.summary) ||
        !Array.isArray(conversation.sampleMessages) ||
        conversation.sampleMessages.length === 0;

      if (needsMetadataRefresh) {
        try {
          const defaults = await buildConversationDefaults(conversation.conversationId);
          const patch = {
            aiRoleId: defaults.aiRoleId,
            aiName: defaults.aiName,
            aiPersona: defaults.aiPersona,
            bio: defaults.bio,
            summary: defaults.summary,
            tags: defaults.tags,
            card: defaults.card,
          };
          if (!Array.isArray(conversation.sampleMessages) || !conversation.sampleMessages.length) {
            patch.sampleMessages = defaults.sampleMessages;
          }
          if (!normalizeString(conversation.image) && defaults.image) {
            patch.image = defaults.image;
          }
          await doc.ref.set(patch, { merge: true });
          conversation = { ...conversation, ...patch };
        } catch (metadataError) {
          // ignore metadata refresh errors
        }
      }

      conversations.push(conversation);
    }

    res.json({
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
}

export async function createConversation(req, res, next) {
  try {
    const rawId = typeof req.body?.conversationId === 'string' ? req.body.conversationId.trim() : '';

    if (!rawId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const payload = req.body ?? {};
    const cardPayload = normalizeCardPayload(payload.card ?? null);

    const tags =
      payload.tags !== undefined
        ? normalizeTags(payload.tags)
        : cardPayload?.tags ?? undefined;
    const sampleMessages = mergeSampleMessages(
      payload.sampleMessages,
      cardPayload?.sampleMessages
    );

    const aiName = normalizeString(payload.aiName ?? cardPayload?.name);
    const aiPersona = normalizeString(payload.aiPersona ?? cardPayload?.persona);
    const summaryInput =
      payload.summary ??
      payload.bio ??
      cardPayload?.summary ??
      cardPayload?.persona ??
      aiPersona;
    const summary = normalizeString(summaryInput);

    const image =
      payload.image === null
        ? null
        : payload.image !== undefined
          ? normalizeString(payload.image)
          : undefined;

    const intimacyPayload = payload.intimacy ?? null;
    const hasIntimacy = intimacyPayload && typeof intimacyPayload === 'object';

    const { conversationRef, conversation, created } = await ensureConversationDocument(
      req.user.uid,
      rawId
    );

    const updates = {};

    if (cardPayload) {
      updates.card = cardPayload;
    }

    if (tags !== undefined) {
      updates.tags = tags;
    }

    if (sampleMessages.length) {
      updates.sampleMessages = sampleMessages;
    }

    if (aiName) {
      updates.aiName = aiName;
    }

    if (aiPersona) {
      updates.aiPersona = aiPersona;
    }

    if (summary) {
      updates.bio = summary;
      updates.summary = summary;
    }

    if (image !== undefined) {
      updates.image = image && image.length ? image : null;
    }

    if (payload.imageStoragePath !== undefined) {
      updates.imageStoragePath =
        typeof payload.imageStoragePath === 'string' ? payload.imageStoragePath : null;
    }

    if (typeof payload.isFavorite === 'boolean') {
      updates.isFavorite = payload.isFavorite;
    }

    if (hasIntimacy) {
      const intimacy = normalizeIntimacy(intimacyPayload);
      updates.intimacy = intimacy;

      const defaultLabel = buildDefaultIntimacyLabel(intimacy.level);
      const sanitizedLabel = sanitizeIntimacyLabel(
        typeof payload.intimacyLabel === 'string' ? payload.intimacyLabel : '',
        defaultLabel
      );
      const match = sanitizedLabel.match(/^親密度等級\s*(\d+)/);
      updates.intimacyLabel =
        match && Number.parseInt(match[1], 10) === intimacy.level
          ? sanitizedLabel
          : defaultLabel;
    } else if (typeof payload.intimacyLabel === 'string') {
      updates.intimacyLabel = sanitizeIntimacyLabel(
        payload.intimacyLabel,
        buildDefaultIntimacyLabel()
      );
    }

    updates.updatedAt = Date.now();

    if (Object.keys(updates).length) {
      await conversationRef.set(updates, { merge: true });
    }

    const latestSnapshot = await conversationRef.get();
    const normalized = normalizeConversationDocument(latestSnapshot) ?? conversation;

    res.status(created ? 201 : 200).json({ data: normalized });
  } catch (error) {
    next(error);
  }
}

export async function getConversationMessages(req, res, next) {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const messages = await fetchMessages(req.user.uid, conversationId, 60);

    res.json({
      data: {
        messages,
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function clearConversationMessages(req, res, next) {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const { conversationRef } = await ensureConversationDocument(req.user.uid, conversationId);
    const batch = firestore.batch();

    const snapshot = await conversationRef.collection('messages').get();
    snapshot.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    const timestamp = Date.now();
    await conversationRef.set(
      {
        updatedAt: timestamp,
        lastClearedAt: timestamp,
        lastMessage: '',
        lastMessageAt: null,
      },
      { merge: true }
    );

    res.json({
      data: { cleared: true },
    });
  } catch (error) {
    next(error);
  }
}

export async function updateConversation(req, res, next) {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const { image, imageStoragePath } = req.body ?? {};
    const payload = {};

    if (typeof image === "string") {
      const trimmed = image.trim();
      payload.image = trimmed.length ? trimmed : null;
    } else if (image === null) {
      payload.image = null;
    }

    if (typeof imageStoragePath === "string") {
      payload.imageStoragePath = imageStoragePath;
    } else if (imageStoragePath === null) {
      payload.imageStoragePath = null;
    }

    if (!Object.keys(payload).length) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    payload.updatedAt = Date.now();

    const { conversationRef } = await ensureConversationDocument(req.user.uid, conversationId);
    await conversationRef.set(payload, { merge: true });

    const snapshot = await conversationRef.get();
    const conversation = normalizeConversationDocument(snapshot);

    res.json({ data: conversation });
  } catch (error) {
    next(error);
  }
}

export async function deleteConversation(req, res, next) {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const conversationRef = conversationCollection(req.user.uid).doc(conversationId);
    const snapshot = await conversationRef.get();

    if (snapshot.exists) {
      const batch = firestore.batch();
      const messagesSnapshot = await conversationRef.collection('messages').get();
      messagesSnapshot.forEach((doc) => batch.delete(doc.ref));
      batch.delete(conversationRef);
      await batch.commit();
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req, res, next) {
  try {
    const { conversationId, message } = req.body;

    if (!conversationId || !message) {
      return res.status(400).json({ message: 'conversationId and message are required' });
    }

    const text = typeof message === 'string' ? message.trim() : '';
    if (!text) {
      return res.status(400).json({ message: 'message must not be empty' });
    }

    const { conversationRef, conversation } = await ensureConversationDocument(req.user.uid, conversationId);
    const messagesCollection = conversationRef.collection('messages');

    const modelSelection = selectModelForContext({
      claims: req.user?.claims,
      conversation,
    });

    const userTimestamp = Date.now();
    const userMessageData = {
      sender: 'user',
      message: text,
      createdAt: userTimestamp,
    };

    const userMessageRef = await messagesCollection.add(userMessageData);

    const history = await fetchMessages(req.user.uid, conversationId, 40);
    const historyWithContext = ensureAssistantContext(history, conversation);
    const prompt = buildPromptFromHistory(historyWithContext);

    const response = await streamChatCompletion(prompt, {
      stream: false,
      model: modelSelection.model,
      metadata: {
        source: 'chat.sendMessage',
        conversationId,
        roleId: conversation?.aiRoleId ?? conversationId,
        membershipTier: modelSelection.tier,
        modelSource: modelSelection.source ?? null,
      },
    });
    const reply = response.output?.[0]?.content?.[0]?.text ?? '';
    const trimmedReply = typeof reply === 'string' ? reply.trim() : '';

    const aiTimestamp = Date.now();
    const aiMessageData = {
      sender: 'ai',
      message: trimmedReply,
      createdAt: aiTimestamp,
    };

    const aiMessageRef = await messagesCollection.add(aiMessageData);

    const latestTimestamp = aiMessageRef ? aiTimestamp : userTimestamp;

    await conversationRef.set(
      {
        updatedAt: latestTimestamp,
        lastMessageAt: latestTimestamp,
        lastMessage: trimmedReply || text,
        lastMessageSender: trimmedReply ? 'ai' : 'user',
        unreadCount: 0,
        archivedAt: null,
        isArchived: false,
        membershipTier: modelSelection.tier,
        lastModel: modelSelection.model,
        lastModelSource: modelSelection.source ?? null,
        lastModelAt: aiTimestamp,
      },
      { merge: true }
    );

    res.json({
      data: {
        userMessage: { id: userMessageRef.id, ...userMessageData },
        aiMessage: { id: aiMessageRef.id, ...aiMessageData },
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function generateSuggestions(req, res, next) {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ message: 'conversationId is required' });
    }

    const conversationSnapshot = await conversationCollection(req.user.uid).doc(conversationId).get();
    const conversation = normalizeConversationDocument(conversationSnapshot);

    const modelSelection = selectModelForContext({
      claims: req.user?.claims,
      conversation,
    });

    const history = await fetchMessages(req.user.uid, conversationId, 40);
    const historyWithContext = ensureAssistantContext(history, conversation);
    const prompt = buildPromptFromHistory(historyWithContext);
    prompt.push({ role: 'user', content: SUGGESTION_PROMPT });

    const response = await streamChatCompletion(prompt, {
      stream: false,
      temperature: 0.9,
      model: SUGGESTION_MODEL,
      metadata: {
        source: 'chat.generateSuggestions',
        conversationId,
        roleId: conversation?.aiRoleId ?? conversationId,
        membershipTier: modelSelection.tier,
        modelSource: modelSelection.source ?? null,
      },
    });

    const rawContent = response.output?.[0]?.content?.[0] ?? null;
    let textPayload = '';

    if (rawContent) {
      if (typeof rawContent.text === 'string') {
        textPayload = rawContent.text;
      } else if (rawContent.text) {
        textPayload = extractSuggestionText(rawContent.text) || '';
      }

      if (!textPayload && typeof rawContent.value === 'string') {
        textPayload = rawContent.value;
      } else if (!textPayload && rawContent.value) {
        textPayload = extractSuggestionText(rawContent.value) || '';
      }

      if (!textPayload && typeof rawContent.content === 'string') {
        textPayload = rawContent.content;
      } else if (!textPayload && rawContent.content) {
        textPayload = extractSuggestionText(rawContent.content) || '';
      }

      if (!textPayload) {
        textPayload = extractSuggestionText(rawContent) || '';
      }
    }

    if (!textPayload && typeof response.output_text === 'string') {
      textPayload = response.output_text;
    }

    const text = typeof textPayload === 'string' && textPayload.trim().length ? textPayload : '[]';
    let suggestions = [];
    const extractSuggestionArray = (value) => {
      if (Array.isArray(value)) {
        return value;
      }
      if (value && typeof value === 'object') {
        if (Array.isArray(value.suggestions)) {
          return value.suggestions;
        }
      }
      return null;
    };

    try {
      const parsed = JSON.parse(text);
      const extracted = extractSuggestionArray(parsed);
      if (Array.isArray(extracted)) {
        suggestions = extracted;
      }
    } catch (parseError) {
      const withoutCodeFence = text
        .replace(new RegExp('```[a-zA-Z]*\s*', 'g'), '')
        .replace(/```/g, '')
        .trim();

      let extracted = null;
      try {
        const reparsed = JSON.parse(withoutCodeFence);
        extracted = extractSuggestionArray(reparsed);
      } catch (secondaryParseError) {
        extracted = null;
      }

      if (Array.isArray(extracted)) {
        suggestions = extracted;
      } else {
        const quotedMatches = Array.from(withoutCodeFence.matchAll(/"([^"\r\n]{1,200})"/g))
          .map((match) => match[1].trim())
          .filter((match) => match.length);

        if (quotedMatches.length) {
          suggestions = quotedMatches;
        } else {
          suggestions = withoutCodeFence
            .split(/\r?\n/)
            .map((line) => line.trim().replace(/^[-•E]\s*/, ''))
            .map((line) => line.replace(/^[\s,]+/, '').replace(/[\s,]+$/, '').trim())
            .map((line) => line.replace(/^["']+/, '').replace(/["']+$/, '').trim())
            .filter((line) => line.length);
        }
      }
    }

    suggestions = sanitizeSuggestionList(suggestions, { max: 3 });

    if (suggestions.length < 3) {
      const fallbackCandidates = buildFallbackSuggestions(conversation, 3);
      const seenKeys = new Set(suggestions.map((entry) => entry.toLowerCase()));
      for (const candidate of fallbackCandidates) {
        if (typeof candidate !== 'string') {
          continue;
        }
        const trimmedCandidate = candidate.trim();
        if (!trimmedCandidate) {
          continue;
        }
        const key = trimmedCandidate.toLowerCase();
        if (seenKeys.has(key)) {
          continue;
        }
        seenKeys.add(key);
        suggestions.push(trimmedCandidate);
        if (suggestions.length === 3) {
          break;
        }
      }
    }

    res.json({
      data: {
        suggestions,
      },
    });
  } catch (error) {
    next(error);
  }
}











