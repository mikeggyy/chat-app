import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';

const mockStreamChatCompletion = jest.fn();
const mockGetAiRoleById = jest.fn();

const firestoreMock = {
  collection: jest.fn(),
};

jest.unstable_mockModule('../services/firebaseAdmin.js', () => ({
  firestore: firestoreMock,
}));

jest.unstable_mockModule('../services/openaiClient.js', () => ({
  streamChatCompletion: mockStreamChatCompletion,
}));

jest.unstable_mockModule('../services/roleService.js', () => ({
  getAiRoleById: mockGetAiRoleById,
}));

const { listConversations, generateSuggestions } = await import('./chatController.js');

beforeEach(() => {
  process.env.OPENAI_MODEL_VISITOR = 'gpt-test';
  firestoreMock.collection.mockReset();
  mockStreamChatCompletion.mockReset();
  mockGetAiRoleById.mockReset();
});

afterEach(() => {
  delete process.env.OPENAI_MODEL_VISITOR;
});

function setupFirestore({ conversationData, storedIntimacyLabel, messages = [] }) {
  const messageDocs = messages.map((message, index) => ({
    id: `msg-${index}`,
    data: () => message,
  }));

  const messagesCollection = {
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: messageDocs }),
  };

  const docRef = {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    collection: jest.fn().mockImplementation((name) => {
      if (name === 'messages') {
        return messagesCollection;
      }
      throw new Error(`Unexpected subcollection ${name}`);
    }),
  };

  const snapshot = {
    id: conversationData.conversationId ?? 'conversation-1',
    exists: true,
    data: () => conversationData,
    get: (field) => {
      if (field === 'intimacyLabel') {
        return storedIntimacyLabel;
      }
      if (field === 'membershipTier') {
        return conversationData.membershipTier;
      }
      if (field === 'lastModelAt') {
        return conversationData.lastModelAt;
      }
      if (field === 'archivedAt') {
        return conversationData.archivedAt;
      }
      return conversationData[field];
    },
    ref: docRef,
  };

  docRef.get.mockResolvedValue(snapshot);

  const conversationsCollection = {
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({ docs: [snapshot] }),
    doc: jest.fn().mockReturnValue(docRef),
  };

  const userDoc = {
    collection: jest.fn().mockImplementation((name) => {
      if (name === 'conversations') {
        return conversationsCollection;
      }
      throw new Error(`Unexpected nested collection ${name}`);
    }),
  };

  firestoreMock.collection.mockImplementation((name) => {
    if (name === 'users') {
      return {
        doc: jest.fn().mockReturnValue(userDoc),
      };
    }
    throw new Error(`Unexpected top-level collection ${name}`);
  });

  return { snapshot, docRef, conversationsCollection, messagesCollection };
}

describe('chatController', () => {
  it('listConversations normalizes corrupted intimacy label values', async () => {
    const conversationData = {
      conversationId: 'role-1',
      aiRoleId: 'role-1',
      aiName: 'Luna',
      aiPersona: 'Gentle companion',
      bio: 'Listens with patience and warmth.',
      tags: ['溫柔'],
      image: 'https://example.com/luna.png',
      card: {
        id: 'role-1',
        name: 'Luna',
        persona: 'Gentle companion',
        tags: ['溫柔'],
        portraitImageUrl: 'https://example.com/luna.png',
      },
      intimacy: { level: 4, label: '親密等級 4' },
      updatedAt: 1700000000000,
      createdAt: 1690000000000,
      membershipTier: 'vip',
    };

    const { snapshot } = setupFirestore({
      conversationData,
      storedIntimacyLabel: '親密� 4',
    });

    snapshot.ref.collection.mockImplementation(() => {
      throw new Error('messages collection should not be accessed');
    });

    const req = { user: { uid: 'user-123' } };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await listConversations(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledTimes(1);

    const payload = res.json.mock.calls[0][0];
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.data).toHaveLength(1);
    const conversation = payload.data[0];
    expect(conversation.intimacy.level).toBe(4);
    expect(conversation.intimacy.label).toBe('親密度等級 4');
    expect(conversation.intimacyLabel).toBe('親密度等級 4');
    expect(snapshot.ref.set).not.toHaveBeenCalled();
  });

  it('generateSuggestions appends localized prompt and returns parsed suggestions', async () => {
    const conversationData = {
      conversationId: 'role-2',
      aiRoleId: 'role-2',
      aiName: 'Nova',
      aiPersona: 'Starbound navigator',
      bio: 'Charts hopeful routes even in the dark.',
      tags: ['信任'],
      image: 'https://example.com/nova.png',
      card: {
        id: 'role-2',
        name: 'Nova',
        persona: 'Starbound navigator',
        tags: ['信任'],
        portraitImageUrl: 'https://example.com/nova.png',
      },
      intimacy: { level: 2, label: '親密等級 2' },
      updatedAt: 1700000005000,
      createdAt: 1690000005000,
      membershipTier: 'visitor',
    };

    setupFirestore({
      conversationData,
      storedIntimacyLabel: '親密等級 2',
      messages: [
        { sender: 'user', message: '今天有點累。' },
        { sender: 'ai', message: '我在，慢慢說給我聽。' },
      ],
    });

    mockStreamChatCompletion.mockResolvedValue({
      output: [
        {
          content: [
            {
              text: '["好呀，我想聽聽你今天的心情","謝謝你在，我會慢慢說","能陪我聊聊就很足夠了"]',
            },
          ],
        },
      ],
    });

    const req = {
      user: { uid: 'user-999', claims: { membership: 'visitor' } },
      params: { conversationId: 'role-2' },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await generateSuggestions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockStreamChatCompletion).toHaveBeenCalledTimes(1);

    const [promptArg, optionsArg] = mockStreamChatCompletion.mock.calls[0];
    const suggestionPrompt = promptArg[promptArg.length - 1];
    expect(suggestionPrompt).toEqual({
      role: 'user',
      content:
        '根據近期的對話內容，請提供 3 句使用者可以回覆 AI 的建議。保持真誠溫柔，每句限 25 個字以內。請以 JSON 陣列輸出，不要加入其他內容。',
    });
    expect(optionsArg).toMatchObject({
      model: 'gpt-test',
      metadata: expect.objectContaining({ conversationId: 'role-2', membershipTier: 'visitor' }),
    });

    expect(res.json).toHaveBeenCalledWith({
      data: {
        suggestions: [
          '好呀，我想聽聽你今天的心情',
          '謝謝你在，我會慢慢說',
          '能陪我聊聊就很足夠了',
        ],
      },
    });
  });
});
