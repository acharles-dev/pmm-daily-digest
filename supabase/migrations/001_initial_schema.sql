create table sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  feed_url text,
  source_type text default 'rss' check (source_type in ('rss', 'atom')),
  category text default 'pmm',
  active boolean default true,
  last_fetched_at timestamptz
);

create table articles (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references sources(id) on delete cascade,
  title text not null,
  url text not null,
  author text,
  summary text,
  published_at timestamptz,
  fetched_at timestamptz default now(),
  dedup_hash text unique,
  included_in_digest boolean default false
);

create table digests (
  id uuid primary key default gen_random_uuid(),
  digest_date date unique not null,
  article_count int default 0,
  html_content text,
  sent_at timestamptz,
  email_status text default 'pending' check (email_status in ('pending', 'sent', 'failed'))
);

create index idx_articles_fetched on articles(fetched_at desc);
create index idx_articles_unsent on articles(included_in_digest) where included_in_digest = false;
create index idx_digests_date on digests(digest_date desc);

alter table sources enable row level security;
alter table articles enable row level security;
alter table digests enable row level security;

create policy "Public read sources" on sources for select using (true);
create policy "Service write sources" on sources for all using (true);

create policy "Public read articles" on articles for select using (true);
create policy "Service write articles" on articles for all using (true);

create policy "Public read digests" on digests for select using (true);
create policy "Service write digests" on digests for all using (true);
