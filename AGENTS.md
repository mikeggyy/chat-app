# Repository Guidelines

## Project Structure & Module Organization
The workspace is split into ackend/, rontend/, and docs/. Express code lives in ackend/src, grouped by config/, controllers/, outes/, services/, and utils/; keep new modules within this pattern. The Vue 3 app sits in rontend/src; use components/ for shared UI, iews/ for routed pages, stores/ for Pinia state, services/ for API/Firebase wrappers, and place assets or seed data under ssets/ and data/. Architecture context is documented in docs/architecture.md.

## Build, Test, and Development Commands
- cd backend && npm install && npm run dev: Nodemon server with .env.local.
- cd backend && npm run start: Single-run server for staging/production.
- cd frontend && npm install && npm run dev: Vite dev server with HMR.
- cd frontend && npm run build: Emit the production bundle into rontend/dist.

## Coding Style & Naming Conventions
Use ES modules and 2-space indentation in Node and Vue files. Name controllers and services <feature>.controller.js / <feature>.service.js; Vue components stay PascalCase and Pinia stores use<Feature>Store. Favor explicit prop and emit names, keep secrets in .env.local, and run 
px prettier@3 --check . (or equivalent) before a PR because linting is not automated yet.

## Testing Guidelines
Automated suites are pending; plan Jest for the backend and Vitest for the frontend. Co-locate specs beside source using *.spec.js or *.spec.ts, mock Firebase/OpenAI calls, and record manual verification (chat flows, swipe deck, purchases) in each PR until tests land. Aim for smoke coverage on matchmaking, GPT messaging, and entitlement updates before releases.

## Commit & Pull Request Guidelines
Write imperative, concise commit subjects (Add matchmaking swipe controller) and wrap bodies at ~72 characters. PRs should note affected agents, link issues, attach UI screenshots or API traces, enumerate new env vars, and list tests run. Gate large changes behind feature flags or environment toggles to keep deployments stable.

## Agent Integration Notes
When changing persona logic, sync Firestore schema updates with the prompts referenced in docs/architecture.md. Coordinate Notification and Commerce tweaks with Firebase Cloud Messaging tokens and entitlement rules, and surface inventory gaps or moderation risks early so new roles or guardrails can be prepared.
