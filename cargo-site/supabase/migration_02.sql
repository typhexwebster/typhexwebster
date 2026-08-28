-- ─────────────────────────────────────────────────────────────
-- Migration 02 — Copyright je Album + vorberechnete EQ-Daten je Track
--
-- Einmal ausführen: Supabase → SQL Editor → einfügen → Run.
-- Gefahrlos wiederholbar (IF NOT EXISTS), es gehen keine Daten verloren.
-- ─────────────────────────────────────────────────────────────

-- Copyright-Zeile unter der Trackliste. Leer = es wird nichts angezeigt.
alter table public.albums
  add column if not exists copyright text;

-- Frequenzdaten für die EQ-Balken, im Admin beim Upload berechnet.
-- Base64, ca. 100 KB pro Track. Wird von der Webseite erst beim
-- Abspielen nachgeladen, nicht beim Seitenstart.
alter table public.tracks
  add column if not exists eq_data text;


-- ─────────────────────────────────────────────────────────────
-- OPTIONAL — nur ausführen, wenn du den bisherigen Text behalten willst.
-- Schreibt die alte, fest einprogrammierte Zeile in alle Alben, die noch
-- kein Copyright haben. Ohne diesen Schritt bleibt die Zeile leer, bis du
-- sie im Admin je Album eintippst.
--
-- update public.albums
--    set copyright = '© CARGO 2026. All rights reserved.'
--  where copyright is null or copyright = '';
-- ─────────────────────────────────────────────────────────────
