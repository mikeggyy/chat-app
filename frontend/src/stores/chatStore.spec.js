import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';

vi.mock('../services/apiClient', () => ({
  apiRequest: vi.fn(),
}));

vi.mock('../services/matchService', () => ({
  listMatchFavorites: vi.fn(),
}));

const { apiRequest } = await import('../services/apiClient');
const { listMatchFavorites } = await import('../services/matchService');
const { useChatStore } = await import('./chatStore.js');

describe('chatStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiRequest.mockReset();
    listMatchFavorites.mockReset();
  });

  it('falls back to localized message when loadConversations throws a non-error', async () => {
    const store = useChatStore();

    apiRequest.mockRejectedValue('boom');
    listMatchFavorites.mockResolvedValue({ data: [] });

    await expect(store.fetchConversations()).rejects.toBe('boom');
    expect(store.error).toBe('無法載入對話資料');
    expect(store.loading).toBe(false);
  });
});

