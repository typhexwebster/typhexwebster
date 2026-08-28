// Vercel Serverless Function — Admin-CRUD.
// Nutzt den GEHEIMEN Supabase-Key (umgeht RLS). Nur mit korrektem Admin-Passwort.
import { createClient } from '@supabase/supabase-js';

const ADMIN = process.env.ADMIN_PASSWORD;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;

function db() {
  return createClient(SUPABASE_URL, SUPABASE_SECRET, { auth: { persistSession: false } });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!ADMIN || (req.headers['x-admin-password'] || '') !== ADMIN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!SUPABASE_URL || !SUPABASE_SECRET) {
    return res.status(500).json({ error: 'Server nicht konfiguriert (SUPABASE_URL / SUPABASE_SECRET fehlen).' });
  }

  const supabase = db();
  const { action } = req.body || {};

  try {
    switch (action) {
      case 'checkAuth':
        return res.json({ ok: true });

      case 'list': {
        const [albums, tracks, gallery, site, analysed] = await Promise.all([
          supabase.from('albums').select('*').order('sort_order', { ascending: true }),
          // eq_data bewusst NICHT mitladen — pro Track ~100 KB, die der
          // Admin für die Übersicht nicht braucht. Welche Tracks bereits
          // analysiert sind, holt die separate Abfrage darunter.
          supabase.from('tracks')
            .select('id,album_id,track_no,title,artist,duration,audio_path')
            .order('album_id').order('track_no', { ascending: true }),
          supabase.from('gallery_items').select('*').order('sort_order', { ascending: true }),
          supabase.from('site_content').select('*'),
          supabase.from('tracks').select('id').not('eq_data', 'is', null),
        ]);
        for (const r of [albums, tracks, gallery, site]) if (r.error) throw r.error;
        const analysedIds = analysed.error ? [] : (analysed.data || []).map((r) => r.id);
        return res.json({
          albums: albums.data, tracks: tracks.data, gallery: gallery.data, site: site.data,
          analysedTrackIds: analysedIds,
        });
      }

      case 'saveAlbum': {
        const { row } = req.body;
        const { data, error } = await supabase.from('albums').upsert(row).select();
        if (error) throw error;
        return res.json({ ok: true, data });
      }
      // Reihenfolge der Alben nach dem Ziehen speichern.
      // Bewusst UPDATE statt upsert: so werden nur die sort_order-Werte
      // angefasst und kein anderes Feld überschrieben.
      case 'reorderAlbums': {
        const { order } = req.body; // [{ id, sort_order }, ...]
        if (!Array.isArray(order)) return res.status(400).json({ error: 'order fehlt' });
        for (const it of order) {
          const { error } = await supabase.from('albums')
            .update({ sort_order: Number(it.sort_order) || 0 }).eq('id', it.id);
          if (error) throw error;
        }
        return res.json({ ok: true });
      }

      // Frequenzdaten eines bestehenden Tracks separat sichern, damit die
      // Analyse sofort wirkt und nicht erst beim Speichern des Albums.
      case 'saveTrackEq': {
        const { id, eq_data } = req.body;
        if (!id) return res.status(400).json({ error: 'id fehlt' });
        const { error } = await supabase.from('tracks').update({ eq_data }).eq('id', id);
        if (error) throw error;
        return res.json({ ok: true });
      }

      case 'deleteAlbum': {
        const { id } = req.body;
        const { error } = await supabase.from('albums').delete().eq('id', id);
        if (error) throw error;
        return res.json({ ok: true });
      }

      case 'saveTrack': {
        const { row } = req.body;
        const clean = { ...row };
        if (!clean.id) delete clean.id; // neuer Track -> DB vergibt uuid
        const { data, error } = await supabase.from('tracks').upsert(clean).select();
        if (error) throw error;
        return res.json({ ok: true, data });
      }
      case 'deleteTrack': {
        const { id } = req.body;
        const { error } = await supabase.from('tracks').delete().eq('id', id);
        if (error) throw error;
        return res.json({ ok: true });
      }

      case 'saveGallery': {
        const { row } = req.body;
        const clean = { ...row };
        if (!clean.id) delete clean.id;
        const { data, error } = await supabase.from('gallery_items').upsert(clean).select();
        if (error) throw error;
        return res.json({ ok: true, data });
      }
      case 'deleteGallery': {
        const { id } = req.body;
        const { error } = await supabase.from('gallery_items').delete().eq('id', id);
        if (error) throw error;
        return res.json({ ok: true });
      }

      case 'saveSite': {
        const { key, value } = req.body;
        const { error } = await supabase.from('site_content')
          .upsert({ key, value, updated_at: new Date().toISOString() });
        if (error) throw error;
        return res.json({ ok: true });
      }

      default:
        return res.status(400).json({ error: 'unbekannte Aktion: ' + action });
    }
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
