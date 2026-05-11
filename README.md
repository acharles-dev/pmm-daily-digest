# pmm-daily-digest

Daily email digest of product marketing articles from 10+ industry sources. Fetches RSS feeds, deduplicates, compiles a digest, and sends it via Resend. Includes a web archive to browse past digests.

**Live:** [link TBD]

## Supabase Features Used

- **Database (Postgres)** for sources, articles, and digest archive with deduplication
- **Edge Functions** (two cron workers): `fetch-articles` collects from RSS feeds, `send-digest` compiles and emails the daily digest
- **Row Level Security** for public read access to the archive
- **pg_cron** for scheduling both functions

## Sources

Product Marketing Alliance, Lenny's Newsletter, First Round Review, Reforge, Andrew Chen, Intercom, MKT1, HubSpot Marketing, Stratechery, OpenView Partners

## Setup

1. Create a Supabase project
2. Run `supabase/migrations/001_initial_schema.sql`
3. Run `supabase/seed.sql` to add sources
4. Sign up for [Resend](https://resend.com) (free tier) and get an API key
5. Deploy Edge Functions:
   ```
   supabase functions deploy fetch-articles
   supabase functions deploy send-digest
   ```
6. Set secrets: `supabase secrets set RESEND_API_KEY=your-key`
7. Schedule via pg_cron or Supabase Dashboard
8. Copy project URL + anon key into `index.html`
9. Deploy frontend: `vercel --prod`

## Stack

- Vanilla HTML/CSS/JS with sidebar layout
- Supabase JS client via CDN
- Resend for transactional email
- Deno Edge Functions for RSS parsing and digest compilation
