# AI Match Chat App

A full-stack playground for an AI-powered matchmaking + chat experience. Vue 3 drives the client; Node.js/Express acts as a secure API gateway in front of OpenAI and Firebase services.

## Project Structure

```
.
├── backend/        # Express API scaffold (OpenAI + Firebase Admin)
├── frontend/       # Vue 3 SPA scaffold (Pinia + Vue Router + Firebase Auth)
└── docs/           # Architecture and planning notes
```

## Requirements
- Node.js 20+
- npm 10+
- Firebase project (Auth + Firestore + optional Cloud Functions)
- OpenAI API key (GPT-4.1 responses API access)

## Frontend Setup
```bash
cd frontend
cp .env.example .env.local   # populate Firebase + backend URL
npm install
npm run dev
```

## Backend Setup
```bash
cd backend
cp .env.example .env.local   # add OpenAI + Firebase service account info
npm install
npm run dev
```

> The dev script loads `.env.local` via `node --env-file`.

## Core Features (MVP Roadmap)
- Firebase Auth (Google / Facebook / Phone) → protected routes.
- Tinder-style swipe deck for AI companion discovery.
- One-to-one chat threads with OpenAI GPT-4.1 + moderation hooks.
- AI role builder + marketplace for persona packs and boosts.
- Profile preferences syncing and in-app purchase ledgers.

## Testing & Deployment Notes
- Add integration tests once Firestore schemas settle (recommend Vitest for frontend, Jest for backend).
- For mobile packaging, consider Capacitor to wrap the Vue build as an app (Android/iOS).
- Harden security with stricter Firestore rules, rate limiting, and payment webhooks in Firebase Functions or the Express API.
