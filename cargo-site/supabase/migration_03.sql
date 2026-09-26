-- ─────────────────────────────────────────────────────────────
-- Migration 03 — Datumszeile je Release
--
-- Einmal ausführen: Supabase → SQL Editor → einfügen → Run.
-- Gefahrlos wiederholbar, es gehen keine Daten verloren.
-- ─────────────────────────────────────────────────────────────

-- Freier Text, steht unter der Copyright-Zeile, z. B. "28 August 2026".
-- Leer = es erscheint keine Zeile.
alter table public.albums
  add column if not exists release_date text;
