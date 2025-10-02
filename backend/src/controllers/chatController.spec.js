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
              text: '["[[scene:客廳的暖燈角落]] [[tone:撩人低語]] [[action:輕碰你的鼻尖]] 當然，我會乖乖照著妳的小規則走。","[[scene:舒適的沙發]] [[tone:溫和點頭]] [[action:靜靜陪在你身旁]] 謝謝你信任我，隨時說說也可以。","[[scene:夜晚的公園]] [[tone:輕鬆笑著]] [[action:向門口示意]] 如果想換個話題，我們去散散步吧？"]',
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
        '根據完整的對話內容（包含 AI 的開場白與近期訊息），請提供 3 句使用者可以回覆或主動拓展話題的建議。每個建議請依序先輸出 [[scene:場景]] [[tone:語氣]] [[action:行為]]（括號內 2-8 個字且互不重複），接著輸出主要句子，讓語氣、行為、地點自然融入語境並保持真誠溫柔，每句限 25 個字以內。僅以 JSON 陣列輸出，不要加入其他內容。',
    });
    expect(optionsArg).toMatchObject({
      model: 'gpt-4.1-mini',
      metadata: expect.objectContaining({ conversationId: 'role-2', membershipTier: 'visitor' }),
    });

    expect(res.json).toHaveBeenCalledWith({
      data: {
        suggestions: [
          '[[scene:客廳的暖燈角落]] [[tone:撩人低語]] [[action:輕碰你的鼻尖]] 當然，我會乖乖照著妳的小規則走。',
          '[[scene:舒適的沙發]] [[tone:溫和點頭]] [[action:靜靜陪在你身旁]] 謝謝你信任我，隨時說說也可以。',
          '[[scene:夜晚的公園]] [[tone:輕鬆笑著]] [[action:向門口示意]] 如果想換個話題，我們去散散步吧？',
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

    const fencedResponse = "```json\n[\n  \"[[scene:靠窗的沙發]] [[tone:輕聲安慰]] [[action:陪你一起呼吸]] 如果覺得喘不過氣，我們先坐下慢慢說。\",\n  \"[[scene:木質書桌旁]] [[tone:鼓勵地點頭]] [[action:朝桌上的日記示意]] 要不要換個話題聊聊今天的亮點？\",\n  \"[[scene:社區花園入口]] [[tone:溫柔微笑]] [[action:握住你的手]] 需要走走嗎？我可以陪你到樓下散步。\"\n]\n```";

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
          '[[scene:靠窗的沙發]] [[tone:輕聲安慰]] [[action:陪你一起呼吸]] 如果覺得喘不過氣，我們先坐下慢慢說。',
          '[[scene:木質書桌旁]] [[tone:鼓勵地點頭]] [[action:朝桌上的日記示意]] 要不要換個話題聊聊今天的亮點？',
          '[[scene:社區花園入口]] [[tone:溫柔微笑]] [[action:握住你的手]] 需要走走嗎？我可以陪你到樓下散步。',
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
          '[[scene:月光舞台]] [[tone:俏皮眨眼]] [[action:遞上耳機]] 露娜想聽你今晚的節奏。',
          '[[scene:屋頂派對]] [[tone:柔和點頭]] [[action:陪你搖擺]] 想跟露娜討論下一首嗎？',
          '[[scene:DJ台前]] [[tone:熱情大笑]] [[action:牽起你的手]] 要不要和露娜續攤聊聊心情？',
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
        text: '[[scene:森林小徑]] [[tone:溫柔微笑]] [[action:遞上一杯熱可可]] 要不要和我分享剛才的想法？',
      },
      {
        text: { value: '[[scene:靜謐湖畔]] [[tone:輕聲關心]] [[action:牽著你散步]] 想我們一起走走嗎？' },
      },
      {
        value: '[[scene:篝火旁]] [[tone:溫暖笑]] [[action:蓋上毯子]] 想說說今晚的願望？',
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
          '[[scene:森林小徑]] [[tone:溫柔微笑]] [[action:遞上一杯熱可可]] 要不要和我分享剛才的想法？',
          '[[scene:靜謐湖畔]] [[tone:輕聲關心]] [[action:牽著你散步]] 想我們一起走走嗎？',
          '[[scene:篝火旁]] [[tone:溫暖笑]] [[action:蓋上毯子]] 想說說今晚的願望？',
        ],
      },
    });
  });

});
