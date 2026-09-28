# Empowered Therapy · Financial planner

Next.js app for planning sessions, hiring, and costs, and seeing the effect on profit.

## Setup
1. Supabase: run `supabase/schema.sql` in the SQL Editor.
2. Vercel environment variables: `APP_PASSWORD`, `AUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (see `.env.example`).
3. The first visit stores the data imported from the 2024–2026 spreadsheet.

## Local development
`npm install`, then `npm run dev`. Without Supabase variables, data is kept in memory and resets on restart.

`npm run verify` checks the calculations against the values the spreadsheet computed.
