-- ============================================================
-- CARGO — Supabase Schema
-- In Supabase: SQL Editor -> New query -> paste -> Run.
-- Idempotent: kann gefahrlos erneut ausgeführt werden.
-- ============================================================

-- ---------- ALBUMS ----------
create table if not exists public.albums (
  id              text primary key,              -- slug, z.B. 'psy-atlas'
  title           text not null,
  artist          text not null default 'Typhex Webster',
  label           text default 'CARGO',
  year            text,
  availability    text,                          -- Anzeigetext, z.B. 'apple music & spotify'
  apple_url       text,                          -- optional Link
  spotify_url     text,                          -- optional Link
  description     text,
  duration        text,                          -- Anzeigetext, z.B. '34 Min'
  cover_color     text,                          -- Fallback-Farbe
  cover_path      text,                          -- Pfad/URL zum Cover-Bild
  download_format text default 'M4A (AAC)',      -- Anzeigetext im Download-Info
  in_library      boolean not null default false,-- in "YOUR LIBRARY" anzeigen
  published       boolean not null default true, -- auf der Seite sichtbar
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- ---------- TRACKS ----------
create table if not exists public.tracks (
  id          uuid primary key default gen_random_uuid(),
  album_id    text not null references public.albums(id) on delete cascade,
  track_no    int not null,
  title       text not null,
  artist      text default 'Typhex Webster',
  duration    text,                              -- Anzeigetext, z.B. '3:42'
  audio_path  text,                              -- öffentliche R2-URL zur .m4a
  created_at  timestamptz not null default now()
);
create index if not exists tracks_album_idx on public.tracks(album_id, track_no);

-- ---------- GALLERY (Media-Bereich) ----------
create table if not exists public.gallery_items (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null default 'image' check (kind in ('image','video')),
  label       text,
  src_path    text,                              -- Pfad/URL zum Bild/Video
  published   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- ---------- SITE CONTENT (editierbare Texte der Landing Page) ----------
create table if not exists public.site_content (
  key         text primary key,                  -- z.B. 'hero_title', 'about_text'
  value       text,
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- Row Level Security: öffentlich LESEN, schreiben nur serverseitig
-- (service_role umgeht RLS -> Admin-Uploads laufen über Server).
-- ============================================================
alter table public.albums        enable row level security;
alter table public.tracks        enable row level security;
alter table public.gallery_items enable row level security;
alter table public.site_content  enable row level security;

-- öffentliche Lese-Policies (nur sichtbare Inhalte)
drop policy if exists "public read albums" on public.albums;
create policy "public read albums" on public.albums
  for select using (published = true);

drop policy if exists "public read tracks" on public.tracks;
create policy "public read tracks" on public.tracks
  for select using (
    exists (select 1 from public.albums a where a.id = tracks.album_id and a.published = true)
  );

drop policy if exists "public read gallery" on public.gallery_items;
create policy "public read gallery" on public.gallery_items
  for select using (published = true);

drop policy if exists "public read site_content" on public.site_content;
create policy "public read site_content" on public.site_content
  for select using (true);

-- Kein INSERT/UPDATE/DELETE für anon/authenticated -> nur service_role (Server).

-- ============================================================
-- Storage-Bucket für Cover & Galerie-Bilder (öffentlich lesbar).
-- Audio liegt separat auf Cloudflare R2.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;
