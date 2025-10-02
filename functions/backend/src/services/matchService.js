import { firebaseAdmin, firestore } from './firebaseAdmin.js';

const { FieldValue } = firebaseAdmin.firestore;
const favoritesCollection = firestore.collection('match_favorites');
const rolesCollection = firestore.collection('ai_roles');

function toMillis(value) {
  if (typeof value?.toMillis === 'function') {
    return value.toMillis();
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === 'number') {
    return value;
  }
  return null;
}

function serializeFavoriteDocument(snapshot) {
  if (!snapshot?.exists) {
    return null;
  }

  const data = snapshot.data() ?? {};

  return {
    roleId: snapshot.id,
    uid: data.uid ?? null,
    createdAt: toMillis(data.createdAt),
    updatedAt: toMillis(data.updatedAt),
  };
}

export async function listUserMatchFavorites(uid) {
  if (!uid) {
    return [];
  }

  const snapshot = await favoritesCollection
    .doc(uid)
    .collection('roles')
    .orderBy('createdAt', 'desc')
    .get();

  return snapshot.docs.map((doc) => serializeFavoriteDocument(doc)).filter(Boolean);
}

export async function listUserMatchFavoriteIds(uid) {
  const favorites = await listUserMatchFavorites(uid);
  return favorites.map((favorite) => favorite.roleId);
}

export async function addMatchFavorite(uid, roleId) {
  if (!uid || !roleId) {
    throw new Error('uid 與 roleId 為必填欄位。');
  }

  const favoriteRef = favoritesCollection.doc(uid).collection('roles').doc(roleId);
  const roleRef = rolesCollection.doc(roleId);
  let created = false;

  await firestore.runTransaction(async (transaction) => {
    const [favoriteSnapshot, roleSnapshot] = await Promise.all([
      transaction.get(favoriteRef),
      transaction.get(roleRef),
    ]);

    const now = FieldValue.serverTimestamp();

    if (favoriteSnapshot.exists) {
      transaction.update(favoriteRef, { updatedAt: now });
      return;
    }

    created = true;

    transaction.set(
      favoriteRef,
      {
        uid,
        roleId,
        createdAt: now,
        updatedAt: now,
      },
      { merge: false }
    );

    if (roleSnapshot.exists) {
      const roleData = roleSnapshot.data() ?? {};
      const metrics = roleData.metrics ?? {};
      const favorites =
        typeof metrics.favorites === 'number' && metrics.favorites >= 0
          ? metrics.favorites
          : 0;

      transaction.update(roleRef, {
        'metrics.favorites': favorites + 1,
        updatedAt: now,
      });
    }
  });

  const saved = await favoriteRef.get();
  const favorite = serializeFavoriteDocument(saved);

  return { favorite, created };
}

export async function removeMatchFavorite(uid, roleId) {
  if (!uid || !roleId) {
    throw new Error('uid 與 roleId 為必填欄位。');
  }

  const favoriteRef = favoritesCollection.doc(uid).collection('roles').doc(roleId);
  const roleRef = rolesCollection.doc(roleId);

  let removedFavorite = null;

  await firestore.runTransaction(async (transaction) => {
    const [favoriteSnapshot, roleSnapshot] = await Promise.all([
      transaction.get(favoriteRef),
      transaction.get(roleRef),
    ]);

    if (!favoriteSnapshot.exists) {
      return;
    }

    removedFavorite = serializeFavoriteDocument(favoriteSnapshot);
    const now = FieldValue.serverTimestamp();

    transaction.delete(favoriteRef);

    if (roleSnapshot.exists) {
      const roleData = roleSnapshot.data() ?? {};
      const metrics = roleData.metrics ?? {};
      const currentFavorites =
        typeof metrics.favorites === 'number' && metrics.favorites >= 0
          ? metrics.favorites
          : 0;
      const nextFavorites = Math.max(currentFavorites - 1, 0);

      transaction.update(roleRef, {
        'metrics.favorites': nextFavorites,
        updatedAt: now,
      });
    }
  });

  return removedFavorite;
}
