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
      sampleMessages: ['最近還好嗎？'],
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
              text: '["（靠在客廳暖燈角落）當然，我會乖乖照著妳的小規則走。","（舒適沙發上輕點頭）謝謝你信任我，隨時說說也可以。","（夜晚公園裡輕鬆笑著）如果想換個話題，我們去散散步吧？"]',
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
        '根據完整的對話內容（包含 AI 的開場白與近期訊息），請提供 3 句使用者可以回覆或主動拓展話題的建議。每句開頭可視需要加入一段括號，如（悄悄想：...）描述思緒或氛圍，若無需要可省略；不要使用 [[scene]]、[[tone]]、[[action]] 等標記，每句限 25 個字以內。僅以 JSON 陣列輸出（純文字字串），不要加入其他內容。',
    });
    expect(optionsArg).toMatchObject({
      model: 'gpt-4.1-mini',
      metadata: expect.objectContaining({ conversationId: 'role-2', membershipTier: 'visitor' }),
    });

    expect(res.json).toHaveBeenCalledWith({
      data: {
        suggestions: [
          '（靠在客廳暖燈角落）當然，我會乖乖照著妳的小規則走。',
          '（舒適沙發上輕點頭）謝謝你信任我，隨時說說也可以。',
          '（夜晚公園裡輕鬆笑著）如果想換個話題，我們去散散步吧？',
        ],
      },
    });
  });
  it('generateSuggestions strips code fences and recovers quoted suggestions', async () => {
    const conversationData = {
      conversationId: 'role-3',
      aiRoleId: 'role-3',
      aiName: 'Lyra',
      aiPersona: 'Compassionate guide',
      bio: 'Helps untangle mixed feelings with care.',
      tags: ['陪伴'],
      image: 'https://example.com/lyra.png',
      card: {
        id: 'role-3',
        name: 'Lyra',
        persona: 'Compassionate guide',
        tags: ['陪伴'],
        portraitImageUrl: 'https://example.com/lyra.png',
      },
      intimacy: { level: 1, label: '親密等級 1' },
      updatedAt: 1700000006000,
      createdAt: 1690000006000,
      membershipTier: 'visitor',
    };

    setupFirestore({
      conversationData,
      storedIntimacyLabel: '親密等級 1',
      messages: [
        { sender: 'user', message: '最近心情有點亂。' },
        { sender: 'ai', message: '我在，慢慢說沒關係。' },
      ],
    });

    const fencedResponse = "```json
[
  "（靠窗的沙發輕聲安慰陪你一起呼吸）如果覺得喘不過氣，我們先坐下慢慢說。",
  "（木質書桌旁鼓勵地點頭示意日記）要不要換個話題聊聊今天的亮點？",
  "（社區花園入口溫柔微笑握著你的手）需要走走嗎？我可以陪你到樓下散步。"
]
```";

    mockStreamChatCompletion.mockResolvedValue({
      output: [
        {
          content: [
            {
              text: fencedResponse,
            },
          ],
        },
      ],
    });

    const req = {
      user: { uid: 'user-321', claims: { membership: 'visitor' } },
      params: { conversationId: 'role-3' },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await generateSuggestions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      data: {
        suggestions: [
          '（靠窗的沙發輕聲安慰陪你一起呼吸）如果覺得喘不過氣，我們先坐下慢慢說。',
          '（木質書桌旁鼓勵地點頭示意日記）要不要換個話題聊聊今天的亮點？',
          '（社區花園入口溫柔微笑握著你的手）需要走走嗎？我可以陪你到樓下散步。',
        ],
      },
    });
  });

  it('generateSuggestions returns persona fallback when model yields empty list', async () => {
    const conversationData = {
      conversationId: 'luna-dj',
      aiRoleId: 'luna-dj',
      aiName: '月光 DJ 露娜',
      aiPersona: '深夜派對靈魂',
      summary: '在月光下混音的靈魂 DJ，自信又真誠，把歡笑與安慰調成最剛好的節奏。',
      tags: ['活力', '音樂魂', '真誠', '浪漫'],
      card: {
        id: 'luna-dj',
        name: '月光 DJ 露娜',
        persona: '深夜派對靈魂',
        tags: ['活力', '音樂魂'],
        portraitImageUrl: 'https://example.com/luna-dj.png',
      },
      sampleMessages: [
        '下個 set 想聽什麼？我想把你的心情 remix 進今晚的節拍。',
        '等你到月光最亮的那一刻，我們一起起舞。',
      ],
      intimacy: { level: 2, label: '親密等級 2' },
      updatedAt: 1700000010000,
      createdAt: 1690000010000,
      membershipTier: 'visitor',
    };

    setupFirestore({
      conversationData,
      storedIntimacyLabel: '親密等級 2',
      messages: [
        { sender: 'user', message: '今晚有點累。' },
        { sender: 'ai', message: '那我們慢慢調節節奏。' },
      ],
    });

    mockStreamChatCompletion.mockResolvedValue({
      output: [
        {
          content: [
            {
              text: '[]',
            },
          ],
        },
      ],
      output_text: '[]',
    });

    const req = {
      user: { uid: 'user-555', claims: { membership: 'visitor' } },
      params: { conversationId: 'luna-dj' },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await generateSuggestions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      data: {
        suggestions: [
          '（心裡想着在月光舞台陪你沉浸節奏） 露娜想聽你今晚的節奏。',
          '（悄悄在屋頂派對向你點頭示意） 想跟露娜討論下一首嗎？',
          '（腦海裡響著 DJ 台前的熱烈鼓點） 要不要和露娜續攤聊聊心情？',
        ],
      },
    });
  });

  it('generateSuggestions normalizes structured suggestion objects', async () => {
    const conversationData = {
      conversationId: 'role-4',
      aiRoleId: 'role-4',
      aiName: 'Aster',
      aiPersona: 'Gentle navigator',
      summary: '引導使用者看見內心方向的溫柔陪伴者。',
      tags: ['陪伴', '指引'],
      card: {
        id: 'role-4',
        name: 'Aster',
        persona: 'Gentle navigator',
        tags: ['陪伴'],
      },
      intimacy: { level: 3, label: '親密等級 3' },
      updatedAt: 1700000020000,
      createdAt: 1690000020000,
      membershipTier: 'visitor',
    };

    setupFirestore({
      conversationData,
      storedIntimacyLabel: '親密等級 3',
      messages: [
        { sender: 'user', message: '我有點拿不定主意。' },
        { sender: 'ai', message: '我們一起把選項拉出來看看。' },
      ],
    });

    const structuredResponse = JSON.stringify([
      {
        text: '（森林小徑裡溫柔地遞上一杯熱可可）要不要和我分享剛才的想法？',
      },
      {
        text: { value: '（靜謐湖畔輕聲關心牽著你散步）想我們一起走走嗎？' },
      },
      {
        value: '（篝火旁溫暖地為你蓋上毯子）想說說今晚的願望？',
      },
    ]);

    mockStreamChatCompletion.mockResolvedValue({
      output: [
        {
          content: [
            {
              text: structuredResponse,
            },
          ],
        },
      ],
    });

    const req = {
      user: { uid: 'user-777', claims: { membership: 'visitor' } },
      params: { conversationId: 'role-4' },
    };
    const res = { json: jest.fn() };
    const next = jest.fn();

    await generateSuggestions(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      data: {
        suggestions: [
          '（森林小徑裡溫柔地遞上一杯熱可可）要不要和我分享剛才的想法？',
          '（靜謐湖畔輕聲關心牽著你散步）想我們一起走走嗎？',
          '（篝火旁溫暖地為你蓋上毯子）想說說今晚的願望？',
        ],
      },
    });
  });

});
