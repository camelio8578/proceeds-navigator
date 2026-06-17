# Proceeds Navigator

## What This App Does

SaaS platform for surplus proceeds recovery professionals. Users import county tax-sale data via CSV, the platform auto-scores leads by recovery probability, tracks each lead through a pipeline, and generates §4675 claim letters. Sold as a licensed product to solo agents, small firms, and attorneys.

## Stack

Node.js (Express) + PostgreSQL (Neon) + vanilla HTML/CSS frontend, deployed on Render.

## Directory Map

- `server.js` — entry point: middleware, route mounts, app.listen only (≤50 lines)
- `routes/` — one Router per concern: `leads.js` (API), `marketing.js` (public home page), `counties.js` (county reference data)
- `db/` — database access: `index.js` (Pool), `leads.js` (lead + case_note queries), `letters.js` (letter queries), `counties.js` (county reference queries)
- `services/` — stateless logic: `csv.js` (parsing + scoring), `letter.js` (§4675 claim letter HTML)
- `public/` — static assets: `index.html` (marketing landing page), `dashboard.html`, `lead-detail.html`, `counties.html` (county reference guide)
- `migrations/` — `node-pg-migrate` SQL migration files (always write `down()`)

## Database

- `leads` — one row per surplus proceeds opportunity: county, APN, sale date, excess amount, claimant contact info, pipeline status, auto-score, deadline, claim letter timestamp
- `case_notes` — audit log of status changes and manual notes keyed to a lead
- `letters` — persisted §4675 claim letters: lead_id, generated_at, letter_html, status (draft/sent/returned)
- `counties` — reference data for 4 target CA counties (San Diego, LA, Sacramento, Fresno): name, treasurer_contact (JSON), claim_requirements, filing_fees, processing_timeline, website_url

## External Integrations

- Neon PostgreSQL — database, connection via DATABASE_URL env var
- Render — web service hosting, auto-deploy on push to main
- Meta Pixel — analytics on public marketing page (pixel ID in index.html)
- Polsia Analytics — pageview beacon on marketing page

## Recent Changes

- 2026-05-14: Added /counties page + GET /api/counties; counties table (treasurer contact JSON, claim requirements, filing fees, processing timeline, website); seed-counties.js with SD/LA/Sacramento/Fresno data; "County Reference" nav link on dashboard and lead detail
- 2026-05-13: Added letters table + db/letters.js; POST /generate-letter persists HTML, GET /letter-preview serves it; letter history with status tracking (draft/sent/returned) on lead detail page
- 2026-05-10: Extracted routes (leads, marketing), db (leads), services (csv, letter) from monolithic server.js; server.js reduced to ~36 lines
- 2026-05-10: Built full SaaS marketing landing page with pricing tiers, features, FAQ, email capture (replaced internal tool landing)
