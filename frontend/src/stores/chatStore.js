import { defineStore } from 'pinia';
import { apiRequest } from '../services/apiClient';
import { listMatchFavorites } from '../services/matchService';
import { getAiRoleById } from '../data/aiRoles';

const DEFAULT_INTIMACY_LEVEL = 1;
const DEFAULT_INTIMACY_LABEL = buildIntimacyLabel(DEFAULT_INTIMACY_LEVEL);

function buildIntimacyLabel(level) {
  const numeric = Number.isFinite(level) && level > 0 ? Math.trunc(level) : DEFAULT_INTIMACY_LEVEL;
  return '親密度等級 ' + numeric;
}

function resolveIntimacyLabel(rawLabel, level) {
  const fallback = buildIntimacyLabel(level);
  if (typeof rawLabel !== 'string') {
    return fallback;
  }

  const trimmed = rawLabel.trim();
  if (!trimmed) {
    return fallback;
  }

  const match = trimmed.match(/^親密度等級\s*(\d+)/);
  if (match) {
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed !== level) {
      return fallback;
    }
  }

  return trimmed;
}

function extractFavoriteRoleId(entry) {
  if (!entry || typeof entry !== 'object') {
    return '';
  }

  const candidates = [
    entry.roleId,
    entry.cardId,
    entry.aiRoleId,
    entry.id,
    entry?.card?.id,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length) {
        return trimmed;
      }
    }
  }

  return '';
}

function buildCardFromRole(role) {
  if (!role) return null;
  const image =
    typeof role.image === 'string' && role.image.trim().length ? role.image.trim() : null;
  return {
    id: role.id,
    name: role.name,
    persona: role.persona ?? '',
    summary: role.bio ?? role.persona ?? '',
    tags: Array.isArray(role.tags) ? role.tags : [],
    portraitImageUrl: image,
    coverImageUrl: image,
  };
}

function buildCardFromFavorite(entry, role) {
  const source = entry?.card && typeof entry.card === 'object' ? entry.card : null;
  if (!source && !role) {
    return null;
  }

  const fallback = buildCardFromRole(role);

  if (!source) {
    return fallback;
  }

  const imageCandidates = [
    source.portraitImageUrl,
    source.image,
    fallback?.portraitImageUrl,
  ];
  let image = null;
  for (const candidate of imageCandidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length) {
        image = trimmed;
        break;
      }
    }
  }

  return {
    id: source.id ?? fallback?.id ?? null,
    name: source.name ?? fallback?.name ?? '',
    persona: source.persona ?? fallback?.persona ?? '',
    summary:
      source.summary ??
      source.bio ??
      fallback?.summary ??
      fallback?.persona ??
      '',
    tags: Array.isArray(source.tags) ? source.tags : fallback?.tags ?? [],
    portraitImageUrl: image,
    coverImageUrl: source.coverImageUrl ?? image,
  };
}


function normalizeIntimacy(raw) {
  const rawLevel = typeof raw?.level === 'number' ? raw.level : DEFAULT_INTIMACY_LEVEL;
  const level = Number.isFinite(rawLevel) && rawLevel > 0 ? Math.trunc(rawLevel) : DEFAULT_INTIMACY_LEVEL;
  const fallbackLabel = buildIntimacyLabel(level);
  const rawLabel = typeof raw?.label === 'string' ? raw.label.trim() : '';

  if (!rawLabel) {
    return { level, label: fallbackLabel };
  }

  const match = rawLabel.match(/^親密度等級\s*(\d+)/);
  if (match) {
    const parsed = Number.parseInt(match[1], 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed !== level) {
      return { level, label: fallbackLabel };
    }
  }

  return { level, label: rawLabel };
}

function normalizeConversation(raw) {
  if (!raw || typeof raw !== 'object') return null;

  const id = raw.id ?? raw.conversationId ?? raw.aiRoleId;
  if (!id) return null;

  const card = raw.card && typeof raw.card === 'object' ? raw.card : null;
  const aiRoleId = raw.aiRoleId ?? raw.conversationId ?? id;
  const staticRole = aiRoleId ? getAiRoleById(aiRoleId) : null;
  const intimacy = normalizeIntimacy(raw.intimacy);
  const intimacyLabel = resolveIntimacyLabel(raw.intimacyLabel, intimacy.level);
  const normalizedIntimacy = { ...intimacy, label: intimacyLabel };
  const archivedAt = typeof raw.archivedAt === 'number' ? raw.archivedAt : null;
  const isArchived = raw.isArchived === true || (typeof archivedAt === 'number' && archivedAt > 0);

  if (isArchived) {
    return null;
  }

  const trimmedImage = typeof raw.image === 'string' ? raw.image.trim() : '';
  const cardPortrait =
    typeof card?.portraitImageUrl === 'string' ? card.portraitImageUrl.trim() : '';
  const cardCover =
    typeof card?.coverImageUrl === 'string' ? card.coverImageUrl.trim() : '';
  const fallbackImage =
    typeof staticRole?.image === 'string' && staticRole.image.trim().length
      ? staticRole.image.trim()
      : '';
  const image = trimmedImage || cardPortrait || cardCover || fallbackImage || null;

  const fallbackTags = Array.isArray(staticRole?.tags) ? staticRole.tags : [];
  const resolvedTags = Array.isArray(raw.tags)
    ? raw.tags
    : Array.isArray(card?.tags)
      ? card.tags
      : fallbackTags;

  const personaFallback = staticRole?.persona ?? '';
  const bioFallback = staticRole?.bio ?? personaFallback;
  const nameFallback = staticRole?.name ?? 'AI 夥伴';

  const normalizedCard =
    card ??
    (staticRole
      ? {
          id: staticRole.id,
          name: staticRole.name,
          persona: staticRole.persona ?? '',
          summary: staticRole.bio ?? staticRole.persona ?? '',
          tags: fallbackTags,
          portraitImageUrl: fallbackImage || null,
          coverImageUrl: fallbackImage || null,
        }
      : null);

  const lastMessageAt =
    typeof raw.lastMessageAt === 'number'
      ? raw.lastMessageAt
      : typeof raw.updatedAt === 'number'
        ? raw.updatedAt
        : null;
  const updatedAt =
    typeof raw.updatedAt === 'number' ? raw.updatedAt : lastMessageAt ?? Date.now();

  return {
    id,
    conversationId: raw.conversationId ?? id,
    aiRoleId,
    aiName: raw.aiName ?? card?.name ?? nameFallback,
    aiPersona: raw.aiPersona ?? card?.persona ?? personaFallback,
    bio: raw.bio ?? card?.summary ?? raw.aiPersona ?? bioFallback,
    tags: resolvedTags,
    image,
    imageStoragePath:
      typeof raw.imageStoragePath === 'string' ? raw.imageStoragePath : null,
    card: normalizedCard,
    sampleMessages: Array.isArray(normalizedCard?.sampleMessages) ? normalizedCard.sampleMessages : [],
    intimacy: normalizedIntimacy,
    intimacyLabel,
    isFavorite: Boolean(raw.isFavorite),
    unreadCount: typeof raw.unreadCount === 'number' ? raw.unreadCount : 0,
    lastMessage: typeof raw.lastMessage === 'string' ? raw.lastMessage : '',
    lastMessageAt,
    archivedAt,
    isArchived,
    updatedAt,
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : null,
    lastClearedAt: typeof raw.lastClearedAt === 'number' ? raw.lastClearedAt : null,
  };
}
function normalizeFavoriteConversation(entry) {
  const roleId = extractFavoriteRoleId(entry);
  const role = roleId ? getAiRoleById(roleId) : null;
  const card = buildCardFromFavorite(entry, role);

  const name =
    entry?.name ??
    card?.name ??
    role?.name ??
    '';

  if (!roleId && !name) {
    return null;
  }

  const persona = entry?.persona ?? card?.persona ?? role?.persona ?? '';
  const bio =
    entry?.bio ??
    entry?.summary ??
    card?.summary ??
    role?.bio ??
    role?.persona ??
    '';

  const imageCandidates = [
    entry?.portraitImageUrl,
    entry?.image,
    entry?.coverImageUrl,
    card?.portraitImageUrl,
    card?.coverImageUrl,
    role?.image,
  ];
  let image = null;
  for (const candidate of imageCandidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (trimmed.length) {
        image = trimmed;
        break;
      }
    }
  }

  const tags = Array.isArray(entry?.tags)
    ? entry.tags
    : Array.isArray(card?.tags)
      ? card.tags
      : Array.isArray(role?.tags)
        ? role.tags
        : [];

  const createdAt =
    typeof entry?.createdAt === 'number' ? entry.createdAt : Date.now();
  const updatedAt =
    typeof entry?.updatedAt === 'number' ? entry.updatedAt : createdAt;

  return normalizeConversation({
    id: roleId || (typeof entry?.id === 'string' ? entry.id : null),
    conversationId: roleId || (typeof entry?.id === 'string' ? entry.id : null),
    aiRoleId: roleId || null,
    aiName: name,
    aiPersona: persona,
    bio,
    tags,
    image,
    card,
    isFavorite: true,
    intimacy: entry?.intimacy,
    lastMessage: '',
    lastMessageAt: null,
    updatedAt,
    createdAt,
  });
}

function sortConversations(conversations) {
  return conversations.sort((a, b) => {
    const aTime = a.lastMessageAt ?? a.updatedAt ?? 0;
    const bTime = b.lastMessageAt ?? b.updatedAt ?? 0;
    return bTime - aTime;
  });
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    conversations: [],
    favorites: [],
    activeConversationId: null,
    loading: false,
    error: '',
  }),
  getters: {
    activeConversation(state) {
      return state.conversations.find((conv) => conv.id === state.activeConversationId) || null;
    },
    favoriteConversations(state) {
      const seen = new Set();
      const favorites = [];

      for (const conversation of state.conversations) {
        if (!conversation || !conversation.isFavorite) continue;
        favorites.push(conversation);
        const identifiers = [conversation.id, conversation.conversationId, conversation.aiRoleId];
        for (const identifier of identifiers) {
          if (typeof identifier === 'string' && identifier.trim().length) {
            seen.add(identifier.trim());
          }
        }
      }

      for (const entry of state.favorites) {
        if (!entry || typeof entry !== 'object') continue;
        const candidateKeys = [entry.id, entry.conversationId, entry.aiRoleId];
        let key = null;
        for (const candidate of candidateKeys) {
          if (typeof candidate === 'string' && candidate.trim().length) {
            key = candidate.trim();
            break;
          }
        }
        if (!key || seen.has(key)) {
          continue;
        }
        favorites.push(entry);
        seen.add(key);
      }

      return sortConversations([...favorites]);
    },
    nonFavoriteConversations(state) {
      return state.conversations.filter((conversation) => !conversation.isFavorite);
    },
  },
  actions: {
    async fetchConversations() {
      this.loading = true;
      this.error = '';
      try {
        const [response, favoritesResponse] = await Promise.all([
          apiRequest('/chats'),
          listMatchFavorites().catch((error) => {
            console.error('[chatStore] 無法載入收藏資料', error);
            return null;
          }),
        ]);

        const items = Array.isArray(response?.data) ? response.data : [];
        const favoriteEntries = Array.isArray(favoritesResponse?.cards) && favoritesResponse.cards.length
          ? favoritesResponse.cards
          : Array.isArray(favoritesResponse?.data)
            ? favoritesResponse.data
            : [];

        const favoriteMap = new Map();
        for (const entry of favoriteEntries) {
          const roleId = extractFavoriteRoleId(entry);
          if (!roleId) continue;
          if (!favoriteMap.has(roleId)) {
            favoriteMap.set(roleId, entry);
          }
        }

        const normalized = items.map((item) => normalizeConversation(item)).filter(Boolean);

        for (const conversation of normalized) {
          const keyCandidates = [conversation.aiRoleId, conversation.conversationId, conversation.id];
          let matched = false;
          for (const key of keyCandidates) {
            if (typeof key !== 'string') continue;
            const trimmedKey = key.trim();
            if (!trimmedKey.length) continue;
            if (favoriteMap.has(trimmedKey)) {
              matched = true;
              break;
            }
          }
          conversation.isFavorite = matched || Boolean(conversation.isFavorite);
        }

        const favoriteList = [];
        for (const entry of favoriteMap.values()) {
          const synthetic = normalizeFavoriteConversation(entry);
          if (synthetic) {
            synthetic.isFavorite = true;
            favoriteList.push(synthetic);
          }
        }

        this.conversations = sortConversations(normalized);
        this.favorites = sortConversations([...favoriteList]);

      } catch (err) {
        const message = err instanceof Error ? err.message : '無法載入對話資料';
        this.error = message;
        throw err;
      } finally {
        this.loading = false;
      }
    },
    async ensureConversation(conversationId, metadata = {}) {
      const trimmedId =
        typeof conversationId === 'string' ? conversationId.trim() : '';
      if (!trimmedId) {
        return null;
      }

      const payload = { conversationId: trimmedId, ...metadata };

      if (Array.isArray(payload.tags)) {
        payload.tags = payload.tags
          .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
          .filter(Boolean);
      }

      if (Array.isArray(payload.sampleMessages)) {
        payload.sampleMessages = payload.sampleMessages
          .map((message) => (typeof message === 'string' ? message.trim() : ''))
          .filter(Boolean);
      }

      if (payload.card && typeof payload.card === 'object') {
        const card = { ...payload.card };
        if (Array.isArray(card.sampleMessages)) {
          card.sampleMessages = card.sampleMessages
            .map((message) => (typeof message === 'string' ? message.trim() : ''))
            .filter(Boolean);
        }
        payload.card = card;
      }

      try {
        const response = await apiRequest('/chats', {
          method: 'POST',
          body: payload,
        });

        const conversation = response?.data ?? null;
        if (conversation) {
          this.upsertConversation(conversation);
        }

        return conversation;
      } catch (error) {
        throw error;
      }
    },
    selectConversation(id) {
      this.activeConversationId = id;
    },
    upsertConversation(raw) {
      const normalized = normalizeConversation(raw);
      if (!normalized) return;

      if (!normalized.isFavorite) {
        const matchKeys = new Set();
        const keyCandidates = [normalized.id, normalized.conversationId, normalized.aiRoleId];
        for (const candidate of keyCandidates) {
          if (typeof candidate === 'string') {
            const trimmed = candidate.trim();
            if (trimmed.length) {
              matchKeys.add(trimmed);
            }
          }
        }

        if (matchKeys.size) {
          const hasFavorite = this.favorites.some((favorite) => {
            if (!favorite || typeof favorite !== 'object') return false;
            const favoriteKeys = [favorite.id, favorite.conversationId, favorite.aiRoleId];
            return favoriteKeys.some((key) => typeof key === 'string' && matchKeys.has(key.trim()));
          });
          if (hasFavorite) {
            normalized.isFavorite = true;
          }
        }
      }

      const index = this.conversations.findIndex((item) => item.id === normalized.id);
      if (index === -1) {
        this.conversations.push(normalized);
      } else {
        this.conversations.splice(index, 1, {
          ...this.conversations[index],
          ...normalized,
        });
      }

      this.conversations = sortConversations([...this.conversations]);
    },
    updateConversationMeta(id, meta = {}) {
      const conversation = this.conversations.find((item) => item.id === id);
      if (!conversation) return;

      if (Object.prototype.hasOwnProperty.call(meta, 'image')) {
        if (typeof meta.image === 'string') {
          conversation.image = meta.image;
        } else if (meta.image === null) {
          conversation.image = null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(meta, 'imageStoragePath')) {
        if (typeof meta.imageStoragePath === 'string') {
          conversation.imageStoragePath = meta.imageStoragePath;
        } else if (meta.imageStoragePath === null) {
          conversation.imageStoragePath = null;
        }
      }

      if (Object.prototype.hasOwnProperty.call(meta, 'lastMessage')) {
        if (typeof meta.lastMessage === 'string') {
          conversation.lastMessage = meta.lastMessage;
        }
      }

      if (Object.prototype.hasOwnProperty.call(meta, 'lastMessageAt')) {
        if (meta.lastMessageAt === null) {
          conversation.lastMessageAt = null;
        } else if (typeof meta.lastMessageAt === 'number') {
          conversation.lastMessageAt = meta.lastMessageAt;
        }
      } else if (typeof meta.updatedAt === 'number') {
        conversation.lastMessageAt = meta.updatedAt;
      }

      if (Object.prototype.hasOwnProperty.call(meta, 'updatedAt')) {
        if (typeof meta.updatedAt === 'number') {
          conversation.updatedAt = meta.updatedAt;
        }
      } else if (conversation.lastMessageAt !== undefined && conversation.lastMessageAt !== null) {
        conversation.updatedAt = conversation.lastMessageAt;
      }

      if (Object.prototype.hasOwnProperty.call(meta, 'unreadCount')) {
        if (typeof meta.unreadCount === 'number') {
          conversation.unreadCount = meta.unreadCount;
        }
      } else if (Object.prototype.hasOwnProperty.call(meta, 'lastMessage')) {
        conversation.unreadCount = 0;
      }

      this.conversations = sortConversations([...this.conversations]);
    },
    removeFavoriteByKey(key) {
      if (typeof key !== 'string') return;
      const trimmed = key.trim();
      if (!trimmed.length) return;

      const matchesKey = (entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const candidates = [
          entry.aiRoleId,
          entry.roleId,
          entry.card?.id,
          entry.conversationId,
          entry.id,
        ];
        return candidates.some(
          (candidate) => typeof candidate === 'string' && candidate.trim() === trimmed
        );
      };

      for (const conversation of this.conversations) {
        if (matchesKey(conversation)) {
          conversation.isFavorite = false;
        }
      }

      this.favorites = this.favorites.filter((entry) => !matchesKey(entry));
    },
    async deleteConversation(id) {
      const index = this.conversations.findIndex((conversation) => conversation.id === id);
      if (index === -1) return;

      await apiRequest(`/chats/${encodeURIComponent(id)}`, { method: 'DELETE' });

      this.conversations.splice(index, 1);

      if (this.activeConversationId === id) {
        this.activeConversationId = null;
      }
    },
  },
});

