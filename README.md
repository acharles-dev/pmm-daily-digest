# pmm-daily-digest

Daily email digest of product marketing articles from 10+ industry sources. Fetches RSS feeds, deduplicates, compiles a digest, and sends it via Gmail API. Includes a web archive to browse past digests.

**Live:** [pmm-daily-digest.vercel.app](https://pmm-daily-digest.vercel.app)

## Supabase Features Used

- **Database (Postgres)** for sources, articles, and digest archive with deduplication
- **Edge Functions** — `fetch-articles` collects from RSS feeds, `send-digest` compiles the daily digest HTML
- **Row Level Security** — public read via anon key, writes restricted to service_role

## Sources

Product Marketing Alliance, First Round Review, Andrew Chen, Intercom, MKT1, HubSpot Marketing, OpenView Partners

## Setup

1. Create a Supabase project
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/seed.sql` to add sources
4. Deploy Edge Functions:
   ```
   supabase functions deploy fetch-articles
   supabase functions deploy send-digest
   ```
5. Invoke `fetch-articles` from the Dashboard to populate initial data
6. Copy project URL + anon key into `index.html`
7. Deploy frontend: `vercel --prod`

Email delivery is handled locally via Gmail API (no third-party email service needed).

## Stack

- Vanilla HTML/CSS/JS with sidebar layout
- Supabase JS client via CDN
- Deno Edge Functions for RSS parsing and digest compilation
- Gmail API for email delivery (local script)
