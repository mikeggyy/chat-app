import { apiRequest } from './apiClient';

export async function fetchMatchDeck() {
  return apiRequest('/match');
}

export async function favoriteMatchCard(cardId) {
  if (!cardId) {
    throw new Error('cardId is required to favorite a match card');
  }

  return apiRequest('/match/favorites', {
    method: 'POST',
    body: { cardId },
  });
}

export async function unfavoriteMatchCard(cardId) {
  if (!cardId) {
    throw new Error('cardId is required to unfavorite a match card');
  }

  return apiRequest(`/match/favorites/${encodeURIComponent(cardId)}`, {
    method: 'DELETE',
  });
}

export async function listMatchFavorites() {
  return apiRequest('/match/favorites');
}

export async function generateMatchCardImage(cardId, payload = {}) {
  if (!cardId) {
    throw new Error('cardId is required to generate a match card image');
  }

  return apiRequest(`/match/${encodeURIComponent(cardId)}/image`, {
    method: 'POST',
    body: payload,
  });
}