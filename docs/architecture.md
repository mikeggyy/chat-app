# Architecture Overview

## Frontend (Vue 3)
- **Framework**: Vite + Vue 3 with Pinia + Vue Router.
- **Auth**: Firebase client SDK handles Google, Facebook, and phone sign-in flows.
- **State**: `authStore` watches Firebase Auth; `chatStore` encapsulates chat data + OpenAI calls.
- **Routing**: Pages for login, swipe matchmaking, chat list/detail, store, profile, and AI role creation.
- **Services**: `src/firebase` bootstraps Firebase App/Auth; `.env.example` lists required environment variables.

## Backend (Node.js)
- **Server**: Express 5 with CORS, Helmet, Morgan middleware.
- **Firebase Admin**: Centralized `firebaseAdmin` service for Auth/Firestore/Messaging.
- **OpenAI**: `openaiClient` initializes a single client for GPT-4.1 (Responses API).
- **Routing**: Modular REST endpoints (`/auth`, `/match`, `/chats`, `/ai-roles`, `/store`, `/profile`).
- **Middleware**: Firebase token authentication guard + error handling.
- **Env management**: `.env.example` + `loadEnv()` helper with `node --env-file=.env.local` for local dev.

## Data Model Sketch
- **users**: profile, preferences, inventory, notification tokens.
- **ai_roles**: persona prompt, guardrails, visibility scope.
- **match_swipes**: userId, aiRoleId, direction, timestamp.
- **conversations/{conversationId}/messages**: transcripts with sender, content, moderation tags.
- **store_items / purchases**: catalog + transactional records.

## Integration Flow
1. User signs in on frontend → Firebase ID token stored client-side.
2. API calls include Bearer token → backend `authenticate` middleware verifies via Firebase Admin.
3. Backend orchestrates Firestore reads/writes and OpenAI responses; emits updates (later via WebSocket/FCM).
4. Frontend displays conversations; store operations trigger payment provider + Firebase Functions.

## Next Steps
- Wire Firebase config + service accounts.
- Replace mock data with Firestore queries.
- Add OpenAI safety/multi-turn context management.
- Integrate payments (Stripe / Google Play) and push notifications.
