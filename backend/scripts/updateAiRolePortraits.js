import { loadEnv } from '../src/config/env.js';
import { firebaseAdmin, firestore } from '../src/services/firebaseAdmin.js';

loadEnv();

const FieldValue = firebaseAdmin.firestore.FieldValue;

const updates = [
  {
    id: 'emilia-saint',
    portraitImageUrl:
      'https://storage.googleapis.com/test-chat-app-888.appspot.com/ai-roles/emilia-saint/portrait.jpg',
  },
  {
    id: 'luna-dj',
    portraitImageUrl:
      'https://storage.googleapis.com/test-chat-app-888.appspot.com/ai-roles/luna-dj/portrait.jpg',
  },
  {
    id: 'sora-officer',
    portraitImageUrl:
      'https://storage.googleapis.com/test-chat-app-888.appspot.com/ai-roles/sora-officer/portrait.jpg',
  },
];

async function updatePortraits() {
  const collection = firestore.collection('ai_roles');
  for (const entry of updates) {
    const docRef = collection.doc(entry.id);
    const snapshot = await docRef.get();
    if (!snapshot.exists) {
      console.warn(`角色不存在: ${entry.id}`);
      continue;
    }

    await docRef.set(
      {
        portraitImageUrl: entry.portraitImageUrl,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`已更新 ${entry.id}`);
  }
}

updatePortraits()
  .then(() => {
    console.log('更新完成');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
