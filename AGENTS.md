# Repository Guidelines

## Project Structure & Module Organization
The workspace is split into `backend/`, `frontend/`, and `docs/`. Express services live in `backend/src` under `config/`, `controllers/`, `routes/`, `services/`, and `utils/`; keep new modules inside those folders and mirror existing naming. Vue 3 code sits in `frontend/src` with shared UI in `components/`, routed pages in `views/`, Pinia stores in `stores/`, and Firebase/API helpers in `services/`. Place static assets under `frontend/src/assets/` and seed data in `frontend/src/data/`. Architectural decisions are summarized in `docs/architecture.md`—reference it before large refactors.

## Build, Test, and Development Commands
Run `cd backend && npm install && npm run dev` for the Nodemon API server (uses `.env.local`). `cd backend && npm run start` builds and launches the production server. In the frontend, `cd frontend && npm install && npm run dev` starts the Vite HMR dev server, while `npm run build` creates `frontend/dist` for deployment. Install dependencies the first time you touch each workspace.

## Coding Style & Naming Conventions
Use ES modules with 2-space indentation. Name backend artifacts `<feature>.controller.js` and `<feature>.service.js`; Pinia stores follow `<Feature>Store.ts`. Vue components stay PascalCase and expose explicit props/emits. Run `npx prettier@3 --check .` before sending patches; configure editors to respect `.editorconfig`.

## Testing Guidelines
Backend tests will target Jest and frontend tests Vitest, colocated as `*.spec.js` or `*.spec.ts`. Mock Firebase, OpenAI, and other remote services. Until suites stabilize, document manual walkthroughs for chat flows, swipe decks, and entitlements in your PR description.

## Commit & Pull Request Guidelines
Write imperative commit subjects (e.g., `Add swipe matchmaking controller`) with wrapped bodies near 72 characters. PRs should list affected agents, link tickets, include UI screenshots or API traces, enumerate new env vars, and note tests run. Gate risky features behind flags so staging stays stable.

## Security & Configuration Tips
Keep secrets in `.env.local` and never commit them. When adjusting persona logic or Firestore schema, sync the changes with prompts described in `docs/architecture.md` and coordinate with notification/commerce owners so token and entitlement updates land together.
