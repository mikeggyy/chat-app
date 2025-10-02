import request from 'supertest';
import { jest } from '@jest/globals';
import { createMockFirestore } from '../../test/utils/mockFirestore.js';

const { firestore, FieldValue } = createMockFirestore();

const authStub = {
  verifyIdToken: jest.fn(async (token) => {
    if (token !== 'valid-token') {
      const error = new Error('Unauthorized');
      error.code = 'auth/invalid-token';
      throw error;
    }
    return {
      uid: 'user_test',
      membershipTier: 'vip',
    };
  }),
  getUser: jest.fn(async (uid) => ({
    uid,
    displayName: 'Test User',
    providerData: [],
    metadata: {},
  })),
};

const mockStreamChatCompletion = jest.fn(async () => ({
  output: [
    {
      content: [
        {
          type: 'output_text',
          text: 'Hey there, how can I help?',
        },
      ],
    },
  ],
}));

const mockRoleMetadata = {
  aiRoleId: 'aurora',
  aiName: 'Aurora',
  aiPersona: 'Compassionate companion',  bio: 'Always ready to listen and encourage you.',
  tags: ['support', 'empathy'],
  image: 'https://example.com/aurora.png',  intimacy: { level: 2, label: '知心好友' },
  card: {
    name: 'Aurora',
    persona: 'Compassionate companion',
    summary: 'Always ready to listen and encourage you.',
    tags: ['support', 'empathy'],
    portraitImageUrl: 'https://example.com/aurora.png',
  },
};

const mockMapRoleToConversationMetadata = jest.fn(() => ({ ...mockRoleMetadata }));
const mockGetAiRoleById = jest.fn(async (id) => ({
  id,
  name: 'Aurora',
  persona: 'Compassionate companion',  summary: 'Always ready to listen and encourage you.',
  tags: ['support', 'empathy'],  portraitImageUrl: 'https://example.com/aurora.png',
}));

const mockSelectModelForContext = jest.fn(() => ({
  model: 'gpt-test',
  tier: 'vip',
  source: 'unit-test',
}));

const mockNormalizeMembershipTier = jest.fn(() => 'vip');

jest.unstable_mockModule('../services/firebaseAdmin.js', () => ({
  firebaseAdmin: {
    firestore: {
      FieldValue,
    },
  },
  auth: authStub,
  firestore,
  messaging: {},
  storage: {},
}));

jest.unstable_mockModule('../services/openaiClient.js', () => ({
  streamChatCompletion: mockStreamChatCompletion,
  openAiModel: 'gpt-test',
  openai: {
    responses: { create: jest.fn() },
    chat: { completions: { create: jest.fn() } },
  },
}));

const actualRoleServiceModule = await import('../services/roleService.js');

jest.unstable_mockModule('../services/roleService.js', () => ({
  ...actualRoleServiceModule,
  getAiRoleById: mockGetAiRoleById,
}));

const actualRoleMappersModule = await import('../utils/roleMappers.js');

jest.unstable_mockModule('../utils/roleMappers.js', () => ({
  ...actualRoleMappersModule,
  mapRoleToConversationMetadata: mockMapRoleToConversationMetadata,
}));

const actualMembershipModule = await import('../utils/membership.js');

jest.unstable_mockModule('../utils/membership.js', () => ({
  ...actualMembershipModule,
  selectModelForContext: mockSelectModelForContext,
  normalizeMembershipTier: mockNormalizeMembershipTier,
}));

const { default: app } = await import('../app.js');

function conversationDoc(uid, conversationId) {
  return firestore.__getDocument(['users', uid, 'conversations', conversationId]);
}

describe('app smoke tests', () => {
  beforeEach(() => {
    firestore.__reset();
    mockStreamChatCompletion.mockClear();
    mockMapRoleToConversationMetadata.mockClear();
    mockGetAiRoleById.mockClear();
    mockSelectModelForContext.mockClear();
    mockNormalizeMembershipTier.mockClear();
    authStub.verifyIdToken.mockClear();
  });

  test('GET /health responds with status ok', async () => {
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: 'ok',
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
  });

  test('POST /api/chats/:conversationId/messages stores conversation and returns messages', async () => {
    const response = await request(app)
      .post('/api/chats/aurora/messages')
      .set('Authorization', 'Bearer valid-token')
      .send({
        message: 'Hi Aurora!',
      });

    expect(response.status).toBe(200);
    expect(authStub.verifyIdToken).toHaveBeenCalledWith('valid-token');
    expect(mockStreamChatCompletion).toHaveBeenCalledTimes(1);

    const payload = response.body?.data;
    expect(payload).toBeDefined();
    expect(payload.userMessage).toMatchObject({
      sender: 'user',
      message: 'Hi Aurora!',
      createdAt: expect.any(Number),
    });
    expect(payload.aiMessage).toMatchObject({
      sender: 'ai',
      message: 'Hey there, how can I help?',
      createdAt: expect.any(Number),
    });

    const storedConversation = conversationDoc('user_test', 'aurora');
    expect(storedConversation).toMatchObject({
      aiName: 'Aurora',
      lastMessage: 'Hey there, how can I help?',
      lastMessageSender: 'ai',
      membershipTier: 'vip',
      isArchived: false,
    });

    const messagesSnapshot = await firestore
      .collection('users')
      .doc('user_test')
      .collection('conversations')
      .doc('aurora')
      .collection('messages')
      .orderBy('createdAt', 'asc')
      .get();

    expect(messagesSnapshot.docs).toHaveLength(2);
  });
});







