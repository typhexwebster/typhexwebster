-- ─────────────────────────────────────────────────────────────
-- Migration 04 — Library-Entfernung + Analytics
--
-- Einmal ausführen: Supabase → SQL Editor → einfügen → Run.
-- Gefahrlos wiederholbar, es gehen keine Daten verloren.
-- ─────────────────────────────────────────────────────────────


-- ── 1. Release aus allen Librarys entfernen ──────────────────
-- Die Librarys liegen im Browser jedes Besuchers, nicht auf dem Server.
-- Deshalb wird hier nur ein Zeitpunkt hinterlegt: Jeder Browser, der
-- das Release VOR diesem Zeitpunkt geladen hat, wirft es beim nächsten
-- Besuch aus seiner Library. Wer es danach neu lädt, behält es.
--
-- Eigene Tabelle statt Spalte an albums: So bleibt der Eintrag auch
-- dann bestehen, wenn das Album gelöscht und unter derselben ID neu
-- angelegt wird — genau der Fall „Musik geändert".
create table if not exists public.library_resets (
  album_id  text primary key,
  reset_at  timestamptz not null default now()
);

alter table public.library_resets enable row level security;

drop policy if exists "public read library_resets" on public.library_resets;
create policy "public read library_resets" on public.library_resets
  for select using (true);


-- ── 2. Analytics ─────────────────────────────────────────────
-- Ein Eintrag je Ereignis: Seitenaufruf, Abspielen, Download.
-- Es wird keine IP-Adresse gespeichert. "visitor" ist ein Prüfwert aus
-- IP + Browser + Datum, der jeden Tag wechselt — damit lassen sich
-- Besucher eines Tages zählen, aber niemand über Tage verfolgen.
-- Kein Cookie, kein Speicher im Browser.
create table if not exists public.events (
  id           bigint generated always as identity primary key,
  at           timestamptz not null default now(),
  type         text not null check (type in ('view', 'play', 'download')),
  visitor      text not null,
  section      text,
  album_id     text,
  album_title  text,      -- Titel mitschreiben: bleibt lesbar, auch wenn
  track_no     int,       -- das Release später gelöscht wird
  track_title  text,
  redownload   boolean not null default false,
  country      text,
  device       text,
  browser      text,
  os           text,
  referrer     text
);

create index if not exists events_at_idx      on public.events (at desc);
create index if not exists events_type_at_idx on public.events (type, at desc);

-- Keine Policy: Nur der Server (geheimer Schlüssel) darf schreiben und lesen.
alter table public.events enable row level security;


-- ── 3. Auswertung für das Dashboard ──────────────────────────
-- Rechnet alles in der Datenbank zusammen, damit nie Rohdaten in
-- großer Menge übers Netz müssen.
--   p_since   ab wann
--   p_tz      Zeitzone für Tage/Stunden (z. B. 'Europe/Zurich')
--   p_bucket  'hour' oder 'day' — Einteilung der Verlaufsgrafik
create or replace function public.analytics_summary(
  p_since  timestamptz,
  p_tz     text default 'Europe/Zurich',
  p_bucket text default 'day'
) returns jsonb
language plpgsql stable
as $$
declare
  v_bucket text := case when p_bucket = 'hour' then 'hour' else 'day' end;
  v_start  timestamptz;
begin
  -- "Alles" beginnt beim ersten Ereignis, nicht 1970.
  -- Bewusst Zuweisung statt SELECT … INTO: Der SQL-Editor von Supabase
  -- hält SELECT INTO für das Anlegen einer Tabelle und schiebt einen
  -- eigenen Befehl mitten in die Funktion — dann bricht sie.
  v_start := greatest(p_since, coalesce((select min(at) from public.events), now()));

  return (
  with ev as (
    select * from public.events where at >= v_start
  ),
  live_ev as (
    select * from public.events where at > now() - interval '5 minutes'
  ),
  buckets as (
    select generate_series(
      date_trunc(v_bucket, v_start at time zone p_tz),
      date_trunc(v_bucket, now()  at time zone p_tz),
      ('1 ' || v_bucket)::interval
    ) as b
  ),
  agg as (
    select date_trunc(v_bucket, at at time zone p_tz) as b,
           count(distinct visitor)                    as visitors,
           count(*) filter (where type = 'view')      as views,
           count(*) filter (where type = 'play')      as plays,
           count(*) filter (where type = 'download')  as downloads
      from ev group by 1
  )
  select jsonb_build_object(
    'now', now(),
    'start', v_start,

    'live', (select count(distinct visitor) from live_ev),
    'live_sections', coalesce((
      select jsonb_agg(jsonb_build_object('k', section, 'n', n) order by n desc)
        from (select section, count(*) n from (
                select distinct on (visitor) visitor, section
                  from live_ev where type = 'view' and album_id is null
                 order by visitor, at desc) x
              group by section) y), '[]'::jsonb),

    'totals', (select jsonb_build_object(
        'visitors',    count(distinct visitor),
        'views',       count(*) filter (where type = 'view'),
        'plays',       count(*) filter (where type = 'play'),
        'downloads',   count(*) filter (where type = 'download' and not redownload),
        'redownloads', count(*) filter (where type = 'download' and redownload),
        'listeners',   count(distinct visitor) filter (where type = 'play')
      ) from ev),

    'series', coalesce((
      select jsonb_agg(jsonb_build_object(
               'b', to_char(bk.b, 'YYYY-MM-DD"T"HH24:MI'),
               'visitors',  coalesce(a.visitors, 0),
               'views',     coalesce(a.views, 0),
               'plays',     coalesce(a.plays, 0),
               'downloads', coalesce(a.downloads, 0)) order by bk.b)
        from buckets bk left join agg a on a.b = bk.b), '[]'::jsonb),

    'countries', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
        from (select coalesce(country, '??') k, count(distinct visitor) n
                from ev group by 1 order by 2 desc limit 25) t), '[]'::jsonb),

    'devices', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
        from (select coalesce(device, 'unknown') k, count(distinct visitor) n
                from ev group by 1) t), '[]'::jsonb),

    'browsers', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
        from (select coalesce(browser, 'Other') k, count(distinct visitor) n
                from ev group by 1 order by 2 desc limit 12) t), '[]'::jsonb),

    'os', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
        from (select coalesce(os, 'Other') k, count(distinct visitor) n
                from ev group by 1 order by 2 desc limit 12) t), '[]'::jsonb),

    'sections', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n, 'u', u) order by n desc)
        from (select section k, count(*) n, count(distinct visitor) u
                from ev where type = 'view' and album_id is null and section is not null
               group by 1) t), '[]'::jsonb),

    'releases_opened', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n, 'u', u) order by n desc)
        from (select max(album_title) k, count(*) n, count(distinct visitor) u
                from ev where type = 'view' and album_id is not null
               group by album_id order by 2 desc limit 20) t), '[]'::jsonb),

    'referrers', coalesce((select jsonb_agg(jsonb_build_object('k', k, 'n', n) order by n desc)
        from (select referrer k, count(distinct visitor) n
                from ev where referrer is not null and referrer <> ''
               group by 1 order by 2 desc limit 15) t), '[]'::jsonb),

    'top_plays', coalesce((select jsonb_agg(jsonb_build_object(
            'album', a, 'no', no, 'title', ti, 'n', n, 'u', u) order by n desc)
        from (select max(album_title) a, track_no no, max(track_title) ti,
                     count(*) n, count(distinct visitor) u
                from ev where type = 'play'
               group by album_id, track_no order by 4 desc limit 25) t), '[]'::jsonb),

    'top_downloads', coalesce((select jsonb_agg(jsonb_build_object(
            'album', a, 'no', no, 'title', ti, 'n', n, 'r', r) order by n desc)
        from (select max(album_title) a, track_no no, max(track_title) ti,
                     count(*) filter (where not redownload) n,
                     count(*) filter (where redownload) r
                from ev where type = 'download'
               group by album_id, track_no order by 4 desc, 5 desc limit 25) t), '[]'::jsonb),

    'release_downloads', coalesce((select jsonb_agg(jsonb_build_object(
            'k', k, 'n', n, 'u', u) order by n desc)
        from (select max(album_title) k, count(*) n, count(distinct visitor) u
                from ev where type = 'download'
               group by album_id order by 2 desc limit 20) t), '[]'::jsonb),

    -- Die letzten Ereignisse, unabhängig vom gewählten Zeitraum.
    'recent', coalesce((select jsonb_agg(to_jsonb(r) order by r.at desc) from (
        select at, type, section, album_title, track_no, track_title,
               redownload, country, device
          from public.events order by at desc limit 30) r), '[]'::jsonb)
  ));
end;
$$;

-- Nur der Server darf die Auswertung abrufen.
revoke all on function public.analytics_summary(timestamptz, text, text) from public;
revoke all on function public.analytics_summary(timestamptz, text, text) from anon, authenticated;
grant execute on function public.analytics_summary(timestamptz, text, text) to service_role;

-- Die Schnittstelle von Supabase kennt neue Tabellen und Funktionen erst,
-- wenn sie ihr Verzeichnis neu einliest. Das hier stößt es sofort an.
notify pgrst, 'reload schema';
