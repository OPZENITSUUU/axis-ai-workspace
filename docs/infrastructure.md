# AXIS Infrastructure Responsibilities

## Current managed deployment

| Requirement | Current AXIS service | What the owner supplies |
|---|---|---|
| Web frontend and Node.js server | Managed project runtime | Nothing during development |
| Authentication | Manus OAuth | Nothing for the current project |
| Database | Managed MySQL/TiDB-compatible database | Nothing for the current project |
| File storage | Managed private object storage | Nothing for the current project |
| Website hosting | Managed cloud hosting | Publish from the project interface when ready |
| Provider configuration | Secure server environment variables | OmniRoute URL and gateway token |

## Why Supabase, Firebase, Vercel, Render, and Railway are not required now

AXIS already has a server, database, authentication, object storage, and hosting in its current environment. Adding Supabase or Firebase now would duplicate the private data layer. Deploying to Vercel, Render, or Railway is optional for a later independent open-source deployment, not a requirement for the current project.

The current Drizzle schema is MySQL/TiDB-oriented. Moving to Supabase would require a deliberate PostgreSQL schema and authentication migration; moving to Firebase would require a different data access and authorization layer. Neither migration is necessary for the current AXIS MVP.

## Environment variables

Environment values are server configuration, never application source code. Real keys belong in secure project settings or the deployment host’s secret manager. The required provider values are `OMNIROUTE_BASE_URL`, `OMNIROUTE_API_KEY`, and optionally `OMNIROUTE_MODEL`; direct Gemini fallback additionally needs `GOOGLE_GEMINI_API_KEY`, `GEMINI_MODEL`, and an explicit `ALLOW_PAID_PROVIDERS=true` server-side approval. `.env` files are ignored by Git and are not committed to this project.

## Open-source deployment later

For an independent public repository, the maintainer needs a MySQL-compatible database, private object storage, an OAuth provider, HTTPS hosting for the Node.js app, and a separately hosted OmniRoute gateway if that experimental route is desired. The app source remains open, but real user data, sessions, and secrets remain private.
