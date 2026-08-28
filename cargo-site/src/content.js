// ─────────────────────────────────────────────────────────────
// content.js — lädt alle Inhalte aus Supabase und stellt sie in
// genau der Form bereit, die App.jsx erwartet.
//
// Die Exporte sind "live bindings": loadContent() füllt sie einmal
// beim Start (in main.jsx, VOR dem ersten Render). Alle Komponenten,
// die ALBUMS / COVER_IMAGES / LIBRARY_IDS / GALLERY importieren,
// sehen danach automatisch die geladenen Daten.
// ─────────────────────────────────────────────────────────────
import { supabase, R2_PUBLIC_URL, SUPABASE_URL } from './supabaseClient.js';

export let ALBUMS = [];
export let LIBRARY_IDS = [];
export let COVER_IMAGES = {};
export let GALLERY = { images: [], videos: [] };
export let SITE = {};

// Bild-/Cover-Pfad auflösen: volle URL | /public-Pfad | Supabase-Storage-Key
function resolveMedia(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  if (path.startsWith('/')) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/media/${path}`;
}

// Audio-Pfad auflösen: volle URL | R2-Objekt-Key
function resolveAudio(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${R2_PUBLIC_URL}/${path.replace(/^\//, '')}`;
}

export async function loadContent() {
  if (!supabase) { console.warn('[cargo] Supabase nicht konfiguriert – überspringe Laden.'); return; }
  const [albumsRes, tracksRes, galleryRes, siteRes] = await Promise.all([
    supabase.from('albums').select('*').eq('published', true).order('sort_order', { ascending: true }),
    // Bewusst OHNE eq_data: die Frequenzdaten sind pro Track ~100 KB und
    // würden den Seitenstart aufblähen. Sie werden erst geladen, wenn ein
    // Track tatsächlich abgespielt wird (siehe loadTrackEq unten).
    supabase.from('tracks')
      .select('id,album_id,track_no,title,artist,duration,audio_path')
      .order('track_no', { ascending: true }),
    supabase.from('gallery_items').select('*').eq('published', true).order('sort_order', { ascending: true }),
    supabase.from('site_content').select('*'),
  ]);

  if (albumsRes.error) { console.error('[cargo] albums:', albumsRes.error.message); return; }

  const tracksByAlbum = {};
  (tracksRes.data || []).forEach((t) => {
    (tracksByAlbum[t.album_id] = tracksByAlbum[t.album_id] || []).push({
      id: t.track_no,
      dbId: t.id,            // echte Track-ID, für das Nachladen der EQ-Daten
      title: t.title,
      artist: t.artist || 'Typhex Webster',
      duration: t.duration || '',
      file: resolveAudio(t.audio_path),
    });
  });

  const albums = (albumsRes.data || []).map((a) => {
    const tracks = tracksByAlbum[a.id] || [];
    const links = (a.apple_url || a.spotify_url)
      ? { apple: a.apple_url || '#', spotify: a.spotify_url || '#' }
      : null;
    return {
      id: a.id,
      title: a.title,
      artist: a.artist,
      label: a.label || 'CARGO',
      year: a.year || '',
      availability: a.availability || '',
      availabilityLinks: links,
      description: a.description || '',
      copyright: a.copyright || '',   // leer -> es wird keine Zeile angezeigt
      totalTracks: tracks.length,
      duration: a.duration || '',
      // Feste Ersatzfarbe für Alben ohne Cover. Im Admin nicht mehr
      // einstellbar, deshalb hier fest hinterlegt.
      coverColor: a.cover_color || '#8B3A1A',
      downloadInfo: {
        format: a.download_format || 'M4A (AAC)',
        total: 'Free (CHF 0.00)',
        downloaded: '—',
      },
      tracks,
    };
  });

  // Live-Bindings befüllen
  ALBUMS.length = 0; ALBUMS.push(...albums);
  LIBRARY_IDS.length = 0;
  LIBRARY_IDS.push(...(albumsRes.data || []).filter((a) => a.in_library).map((a) => a.id));

  Object.keys(COVER_IMAGES).forEach((k) => delete COVER_IMAGES[k]);
  (albumsRes.data || []).forEach((a) => { COVER_IMAGES[a.id] = resolveMedia(a.cover_path); });

  const g = { images: [], videos: [] };
  (galleryRes.data || []).forEach((it, i) => {
    const bucket = it.kind === 'video' ? g.videos : g.images;
    bucket.push({ id: it.id || i + 1, type: it.kind, label: it.label || '', src: resolveMedia(it.src_path) });
  });
  GALLERY.images = g.images;
  GALLERY.videos = g.videos;

  (siteRes.data || []).forEach((row) => { SITE[row.key] = row.value; });
}

// ── EQ-Daten eines einzelnen Tracks nachladen ────────────────────────
// Wird erst beim Abspielen aufgerufen, nicht beim Seitenstart. Ergebnisse
// werden gemerkt, damit ein zweites Anspielen keine neue Abfrage auslöst.
const eqCache = new Map();

export async function loadTrackEq(dbId) {
  if (!dbId || !supabase) return null;
  if (eqCache.has(dbId)) return eqCache.get(dbId);
  try {
    const { data, error } = await supabase
      .from('tracks').select('eq_data').eq('id', dbId).single();
    const val = error ? null : (data && data.eq_data) || null;
    eqCache.set(dbId, val);
    return val;
  } catch (e) {
    eqCache.set(dbId, null);
    return null;
  }
}
