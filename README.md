# GoldTracker

Progressive web app for tracking a family gold bullion portfolio, with a public page showing daily gold bar prices. It replaces the former Android app and its Google Sheet (repository `goldtracker-android`).

## Stack

| Layer           | Choice                                                                    |
| --------------- | ------------------------------------------------------------------------- |
| Front end       | React, Vite, TypeScript (strict)                                          |
| Styling         | Tailwind CSS, design direction "Lingot" with light and dark themes        |
| Installable app | vite-plugin-pwa (Workbox)                                                 |
| Back end        | Supabase (Postgres, Auth, Edge Functions), project in `eu-west-3` (Paris) |
| Hosting         | Netlify (`netlify.toml`)                                                  |
| Quality         | Prettier, oxlint, Vitest, pgTAP, GitHub Actions                           |

## Getting started

Requirements: Node.js 22 (see `.nvmrc`) and, for the database, Docker.

```bash
npm install
cp .env.example .env.local   # then fill in the publishable key
npm run dev                  # http://localhost:5173
```

## Scripts

| Command                           | Purpose                                                                 |
| --------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                     | Development server                                                      |
| `npm run build`                   | Type-check and production build (includes the service worker and icons) |
| `npm run typecheck`               | TypeScript only                                                         |
| `npm run lint`                    | oxlint                                                                  |
| `npm run format` / `format:check` | Prettier                                                                |
| `npm test`                        | Unit tests (Vitest)                                                     |
| `npx supabase db start`           | Local Postgres with all migrations applied                              |
| `npx supabase test db`            | Database tests (pgTAP)                                                  |

## Security rules

- Only the Supabase URL and **publishable** key may appear in `VITE_` variables. The `service_role`/secret key never goes into the front end or the repository.
- Every table in `public` must enable Row Level Security in its migration. New tables are not exposed to the Data API automatically: grants are written explicitly. `supabase/tests/database/row_level_security.test.sql` fails the CI otherwise.
- Data exported from the legacy Google Sheet (`data/`, `*.csv`) is personal financial data and is ignored by Git.
- Sign-ups are disabled: family members are invited by the portfolio admin.
