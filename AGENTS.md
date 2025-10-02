# Repository Guidelines

## Project Structure & Module Organization
The workspace is split into `backend/`, `frontend/`, and `docs/`. Express code lives in `backend/src` under `config/`, `controllers/`, `routes/`, `services/`, and `utils/`; add new modules within those folders and mirror existing naming. Vue 3 code sits in `frontend/src` with shared UI in `components/`, routed pages in `views/`, state in Pinia stores under `stores/`, and API helpers in `services/`. Place static assets in `frontend/src/assets/` and seed data in `frontend/src/data/`; keep architectural notes in `docs/architecture.md` before refactors.

## Build, Test, and Development Commands
Run `cd backend && npm install && npm run dev` for the Nodemon API server (reads `.env.local`). Use `cd backend && npm run start` to build and launch production mode. Frontend HMR runs with `cd frontend && npm install && npm run dev`, and `cd frontend && npm run build` outputs deployable files to `frontend/dist`.

## Coding Style & Naming Conventions
Use ES modules and 2-space indentation across JS/TS/Vue files. Name backend files `<feature>.controller.js` and `<feature>.service.js`; Pinia stores follow `<Feature>Store.ts`. Keep Vue components in PascalCase with explicit `props` and `emits`. Run `npx prettier@3 --check .` before submitting patches, and respect `.editorconfig`.

## Testing Guidelines
Backend tests use Jest and frontend tests use Vitest, colocated as `*.spec.js` or `*.spec.ts`. Mock Firebase, OpenAI, and other remote services. Document manual walkthroughs for chat flows, swipe decks, and entitlements until automated suites stabilize.

## Commit & Pull Request Guidelines
Write imperative commit subjects (e.g., `Add swipe matchmaking controller`) with bodies wrapped near 72 characters. PRs should list affected agents, link tickets, attach UI screenshots or API traces, enumerate new env vars, and note tests run. Gate risky features behind flags so staging remains stable.

## Security & Configuration Tips
Store secrets in `.env.local` and keep them out of version control. When changing persona logic or Firestore schema, update prompts in `docs/architecture.md` and coordinate with notification and commerce owners so token and entitlement updates deploy together.
