import { getAiRoleById, listAiRoles } from '../services/roleService.js';
import { firestore } from '../services/firebaseAdmin.js';
import { DEFAULT_INTIMACY, normalizeIntimacy, sanitizeIntimacyLabel, buildDefaultIntimacyLabel, buildConversationMetadataFromRole } from '../utils/conversationHelpers.js';
import {
  addMatchFavorite,
  listUserMatchFavoriteIds,
  listUserMatchFavorites,
  removeMatchFavorite,
} from '../services/matchService.js';
import { generateRoleCoverImage } from '../services/matchImageService.js';
import { mapRoleToMatchCard } from '../utils/roleMappers.js';

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
  if (typeof value?.toMillis === 'function') {
    try {
      return value.toMillis();
    } catch (error) {
      return null;
    }
  }
  return null;
}

function conversationCollection(uid) {
  return firestore.collection('users').doc(uid).collection('conversations');
}

function normalizeConversationSnapshot(snapshot) {
  if (!snapshot?.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};
  const intimacy = normalizeIntimacy(data.intimacy);
  const card = data.card ?? null;
  const storedIntimacyLabel = typeof snapshot.get === 'function' ? snapshot.get('intimacyLabel') : data.intimacyLabel;
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
  const archivedAtRaw = typeof snapshot.get === 'function' ? snapshot.get('archivedAt') : data.archivedAt;
  const archivedAt = toMillis(archivedAtRaw);
  const isArchived = typeof data.isArchived === 'boolean' ? data.isArchived : Boolean(archivedAt);

  return {
    id: snapshot.id,
    conversationId: data.conversationId ?? snapshot.id,
    aiRoleId: data.aiRoleId ?? data.conversationId ?? snapshot.id,
    aiName: data.aiName ?? card?.name ?? 'AI 夥伴',
    aiPersona: data.aiPersona ?? card?.persona ?? '',
    bio: data.bio ?? card?.summary ?? data.aiPersona ?? '',
    tags: Array.isArray(data.tags) ? data.tags : Array.isArray(card?.tags) ? card.tags : [],
    image: data.image ?? card?.portraitImageUrl ?? card?.coverImageUrl ?? null,
    imageStoragePath: typeof data.imageStoragePath === 'string' ? data.imageStoragePath : null,
    card,
    intimacy,
    intimacyLabel,
    unreadCount: typeof data.unreadCount === 'number' ? data.unreadCount : 0,
    isFavorite: Boolean(data.isFavorite),
    lastMessage: data.lastMessage ?? '',
    lastMessageAt: typeof data.lastMessageAt === 'number' ? data.lastMessageAt : null,
    lastClearedAt: typeof data.lastClearedAt === 'number' ? data.lastClearedAt : null,
    archivedAt,
    isArchived,
    updatedAt: typeof data.updatedAt === 'number' ? data.updatedAt : null,
    createdAt: typeof data.createdAt === 'number' ? data.createdAt : null,
    lastMessageSender: typeof data.lastMessageSender === 'string' ? data.lastMessageSender : null,
  };
}

async function fetchLatestMessage(conversationRef) {
  const snapshot = await conversationRef
    .collection('messages')
    .orderBy('createdAt', 'desc')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  const data = doc.data() ?? {};
  const createdAt = toMillis(data.createdAt);
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const sender = typeof data.sender === 'string' ? data.sender : null;

  if (!message) {
    return null;
  }

  return { message, createdAt, sender };
}

async function ensureFavoriteConversation(uid, roleId) {
  if (!uid || !roleId) {
    return null;
  }

  const conversationRef = conversationCollection(uid).doc(roleId);
  const snapshot = await conversationRef.get();

  if (snapshot.exists) {
    let conversation = normalizeConversationSnapshot(snapshot);
    if (!conversation) {
      return null;
    }

    const updates = {};
    if (!conversation.isFavorite) {
      updates.isFavorite = true;
    }
    if (conversation.archivedAt || conversation.isArchived) {
      updates.archivedAt = null;
      updates.isArchived = false;
    }

    if (!conversation.lastMessage) {
      const latest = await fetchLatestMessage(conversationRef);
      if (latest) {
        updates.lastMessage = latest.message;
        updates.lastMessageAt = latest.createdAt;
        updates.lastMessageSender = latest.sender ?? 'ai';
        conversation.lastMessage = latest.message;
        conversation.lastMessageAt = latest.createdAt;
        conversation.lastMessageSender = latest.sender ?? 'ai';
      }
    }

    if (!conversation.lastMessageAt && conversation.lastMessage) {
      const latest = await fetchLatestMessage(conversationRef);
      if (latest) {
        updates.lastMessageAt = latest.createdAt;
        if (!updates.lastMessageSender) {
          updates.lastMessageSender = latest.sender ?? conversation.lastMessageSender ?? 'ai';
        }
        conversation.lastMessageAt = latest.createdAt;
        if (!conversation.lastMessageSender) {
          conversation.lastMessageSender = latest.sender ?? 'ai';
        }
      }
    }

    if (Object.keys(updates).length) {
      await conversationRef.set(updates, { merge: true });
      conversation = normalizeConversationSnapshot(await conversationRef.get());
    }

    if (conversation) {
      conversation.isFavorite = true;
    }

    return conversation;
  }

  const role = await getAiRoleById(roleId, { ensureSeed: true });
  if (!role) {
    return null;
  }

  const metadata = buildConversationMetadataFromRole(role);
  const now = Date.now();
  const intimacySource = role?.intimacy ?? metadata?.intimacy ?? null;
  const intimacy = normalizeIntimacy(intimacySource);
  const intimacyLabel = buildDefaultIntimacyLabel(intimacy.level);

  const payload = {
    conversationId: roleId,
    aiRoleId: metadata.aiRoleId ?? roleId,
    aiName: metadata.aiName,
    aiPersona: metadata.aiPersona,
    bio: metadata.bio,
    tags: metadata.tags,
    image: metadata.image,
    card: metadata.card,
    intimacy,
    intimacyLabel,
    unreadCount: 0,
    isFavorite: true,
    lastMessage: '',
    lastMessageAt: null,
    archivedAt: null,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    lastMessageSender: null,
  };

  const latest = await fetchLatestMessage(conversationRef);
  if (latest) {
    payload.lastMessage = latest.message;
    payload.lastMessageAt = latest.createdAt;
    payload.lastMessageSender = latest.sender ?? 'ai';
  }

  await conversationRef.set(payload, { merge: false });

  return { id: roleId, ...payload };
}

async function upsertConversationFavorite(uid, role, isFavorite) {
  if (!uid || !role?.id) {
    return;
  }

  const conversationId = role.id;
  const conversationsRef = firestore.collection('users').doc(uid).collection('conversations');
  const conversationRef = conversationsRef.doc(conversationId);
  const snapshot = await conversationRef.get();
  const now = Date.now();
  const metadata = buildConversationMetadataFromRole(role);

  if (!snapshot.exists) {
    if (!isFavorite) {
      return;
    }

    const payload = {
      conversationId,
      aiRoleId: metadata.aiRoleId ?? conversationId,
      aiName: metadata.aiName,
      aiPersona: metadata.aiPersona,
      bio: metadata.bio,
      tags: metadata.tags,
      image: metadata.image,
      card: metadata.card,
      intimacy: { ...DEFAULT_INTIMACY },
      intimacyLabel: DEFAULT_INTIMACY.label,
      unreadCount: 0,
      isFavorite,
      lastMessage: '',
      lastMessageAt: null,
      createdAt: now,
      updatedAt: now,
    };

    await conversationRef.set(payload, { merge: false });
    return;
  }

  const existingData = snapshot.data() ?? {};
  const updates = {
    isFavorite,
    updatedAt: now,
  };

  const existingImage = typeof existingData.image === 'string' ? existingData.image.trim() : '';
  if ((!existingImage || existingImage.includes('images.unsplash.com')) && metadata.image) {
    updates.image = metadata.image;
  }

  if (!existingData.card && metadata.card) {
    updates.card = metadata.card;
  }

  const existingIntimacy = normalizeIntimacy(existingData.intimacy);
  const desiredIntimacyLabel = buildDefaultIntimacyLabel(existingIntimacy.level);
  let normalizedLabel = desiredIntimacyLabel;
  if (typeof existingData.intimacyLabel === 'string') {
    const sanitizedLabel = sanitizeIntimacyLabel(existingData.intimacyLabel, desiredIntimacyLabel);
    const labelMatch = sanitizedLabel.match(/^親密度等級\s*(\d+)/);
    if (labelMatch) {
      const parsed = Number.parseInt(labelMatch[1], 10);
      normalizedLabel = parsed === existingIntimacy.level ? sanitizedLabel : desiredIntimacyLabel;
    } else if (sanitizedLabel.length) {
      normalizedLabel = sanitizedLabel;
    }
  }
  if (normalizedLabel !== existingData.intimacyLabel) {
    updates.intimacyLabel = normalizedLabel;
  }

  await conversationRef.set(updates, { merge: true });
}

export async function getRecommendations(req, res, next) {
  try {
    const uid = req.user?.uid;
    const [roles, favoriteIds] = await Promise.all([
      listAiRoles({ ensureSeed: true, status: 'published' }),
      uid ? listUserMatchFavoriteIds(uid) : [],
    ]);

    const favoriteSet = new Set(favoriteIds);
    const cards = roles
      .map((role) => {
        const card = mapRoleToMatchCard(role);
        if (!card) return null;
        return {
          ...card,
          isFavorite: favoriteSet.has(card.id),
        };
      })
      .filter(Boolean);

    res.json({ data: cards, favorites: favoriteIds });
  } catch (error) {
    next(error);
  }
}

export async function listFavorites(req, res, next) {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.json({ data: [] });
    }

    const favorites = await listUserMatchFavorites(uid);
    if (!favorites.length) {
      return res.json({ data: [] });
    }

    const conversations = [];
    const seen = new Set();

    for (const entry of favorites) {
      const roleId = typeof entry?.roleId === 'string' ? entry.roleId.trim() : '';
      if (!roleId || seen.has(roleId)) {
        continue;
      }

      const conversation = await ensureFavoriteConversation(uid, roleId);
      if (conversation) {
        conversation.isFavorite = true;
        conversations.push(conversation);
        seen.add(roleId);
      }
    }

    const sorted = conversations.sort((a, b) => {
      const aTime = typeof a.lastMessageAt === 'number' ? a.lastMessageAt : typeof a.updatedAt === 'number' ? a.updatedAt : 0;
      const bTime = typeof b.lastMessageAt === 'number' ? b.lastMessageAt : typeof b.updatedAt === 'number' ? b.updatedAt : 0;
      return bTime - aTime;
    });

    res.json({ data: sorted });
  } catch (error) {
    next(error);
  }
}

export async function favorite(req, res, next) {
  try {
    const { cardId } = req.body;

    if (!cardId) {
      return res.status(400).json({ message: 'cardId 為必填欄位。' });
    }

    const role = await getAiRoleById(cardId, { ensureSeed: true });
    const { favorite: favoriteRecord, created } = await addMatchFavorite(req.user.uid, role.id);
    await upsertConversationFavorite(req.user.uid, role, true);
    const card = mapRoleToMatchCard(role);

    res.status(created ? 201 : 200).json({
      data: favoriteRecord,
      card: card
        ? {
            ...card,
            isFavorite: true,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
}

export async function unfavorite(req, res, next) {
  try {
    const { cardId } = req.params;

    if (!cardId) {
      return res.status(400).json({ message: 'cardId 為必填欄位。' });
    }

    const role = await getAiRoleById(cardId);
    await removeMatchFavorite(req.user.uid, role.id);
    await upsertConversationFavorite(req.user.uid, role, false);

    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

export async function generateRoleImage(req, res, next) {
  try {
    const { cardId } = req.params;

    if (!cardId) {
      return res.status(400).json({ message: 'cardId 為必填欄位。' });
    }

    const prompt = typeof req.body?.prompt === 'string' ? req.body.prompt : undefined;
    const force = Boolean(req.body?.force);
    const bucket = typeof req.body?.bucket === 'string' ? req.body.bucket : undefined;

    const role = await getAiRoleById(cardId, { ensureSeed: true });
    const result = await generateRoleCoverImage(role, {
      prompt,
      force,
      bucket,
    });

    const updatedRole = await getAiRoleById(cardId);
    const favoriteIds = req.user?.uid
      ? await listUserMatchFavoriteIds(req.user.uid)
      : [];
    const favoriteSet = new Set(favoriteIds);
    const card = mapRoleToMatchCard(updatedRole);

    res.status(result?.skipped ? 200 : 201).json({
      data: result,
      card: card
        ? {
            ...card,
            isFavorite: favoriteSet.has(card.id),
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
}

export async function swipe(req, res, next) {
  try {
    const { cardId, direction } = req.body;

    if (!cardId || !['left', 'right'].includes(direction)) {
      return res.status(400).json({ message: 'cardId 與 direction 為必填欄位。' });
    }

    // TODO: persist swipe result
    res.status(204).end();
  } catch (error) {
    next(error);
  }
}

