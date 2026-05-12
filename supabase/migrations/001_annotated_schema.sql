-- Annotated: sessions + cards schema
-- Run this in your Supabase SQL editor or via supabase db push

create table if not exists annotated_sessions (
  id          uuid primary key default gen_random_uuid(),
  title       text,
  speaker     text,
  is_public   boolean not null default false,
  card_count  int not null default 0,
  started_at  timestamptz not null default now(),
  ended_at    timestamptz
);

create table if not exists annotated_cards (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid references annotated_sessions(id) on delete cascade,
  type                text not null check (type in ('fc', 'cynic')),
  verdict             text not null,
  comment             text,
  citations           text[] default '{}',
  trigger_sentence    text,
  elapsed             text,
  timestamp           bigint,
  reactions_agree     int not null default 0,
  reactions_question  int not null default 0,
  is_bookmarked       boolean not null default false,
  is_published        boolean not null default false,
  created_at          timestamptz not null default now()
);

create index if not exists annotated_cards_session_idx on annotated_cards(session_id);
create index if not exists annotated_cards_published_idx on annotated_cards(is_published) where is_published = true;

-- RLS
alter table annotated_sessions enable row level security;
alter table annotated_cards    enable row level security;

-- Anyone can insert (anon key write)
create policy "anon insert sessions" on annotated_sessions for insert with check (true);
create policy "anon insert cards"    on annotated_cards    for insert with check (true);

-- Anyone can update their own session/cards (no auth yet — open by session_id)
create policy "anon update sessions" on annotated_sessions for update using (true);
create policy "anon update cards"    on annotated_cards    for update using (true);

-- Public sessions/cards readable
create policy "public sessions read" on annotated_sessions for select using (is_public = true);
create policy "public cards read"    on annotated_cards    for select using (is_published = true);

-- Helper RPC to increment card_count atomically
create or replace function increment_card_count(session_id uuid)
returns void language sql security definer as $$
  update annotated_sessions
  set card_count = card_count + 1
  where id = session_id;
$$;
