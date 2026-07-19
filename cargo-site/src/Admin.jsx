import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient.js';

// ── Netzwerk-Helfer ──────────────────────────────────────────────────
async function apiCall(pw, action, body = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ action, ...body }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(j.error || 'Fehler');
  return j;
}

async function presign(pw, target, file) {
  const res = await fetch('/api/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ target, filename: file.name, contentType: file.type || 'application/octet-stream' }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Upload-URL fehlgeschlagen');
  return j;
}

async function uploadAudio(pw, file) {
  const { uploadUrl, publicUrl, contentType } = await presign(pw, 'audio', file);
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!put.ok) throw new Error('R2-Upload fehlgeschlagen (' + put.status + ') — CORS am Bucket gesetzt?');
  return publicUrl;
}

async function uploadMedia(pw, file) {
  const { path, token, publicUrl } = await presign(pw, 'media', file);
  const { error } = await supabase.storage.from('media').uploadToSignedUrl(path, token, file);
  if (error) throw new Error('Bild-Upload: ' + error.message);
  return publicUrl;
}

// ── Styles ───────────────────────────────────────────────────────────
const C = { red: '#c8402a', white: '#f5f0eb', dim: '#888', line: '#2a2a2a', panel: '#111' };
const S = {
  page: { maxWidth: 900, margin: '0 auto', padding: '24px 16px 120px', color: C.white, fontFamily: "'Courier New', monospace" },
  h1: { color: C.red, letterSpacing: '0.15em', fontSize: 20, marginBottom: 4 },
  sub: { color: C.dim, fontSize: 12, marginBottom: 24 },
  tabs: { display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' },
  tab: (a) => ({ padding: '8px 16px', border: `1px solid ${a ? C.red : C.line}`, color: a ? C.red : C.white, background: 'transparent', cursor: 'pointer', letterSpacing: '0.1em', fontFamily: 'inherit', fontSize: 12 }),
  card: { border: `1px solid ${C.line}`, background: C.panel, padding: 16, marginBottom: 12 },
  row: { display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  label: { display: 'block', color: C.dim, fontSize: 11, letterSpacing: '0.08em', margin: '10px 0 4px' },
  input: { width: '100%', background: '#000', border: `1px solid ${C.line}`, color: C.white, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13 },
  ta: { width: '100%', background: '#000', border: `1px solid ${C.line}`, color: C.white, padding: '8px 10px', fontFamily: 'inherit', fontSize: 13, minHeight: 70, resize: 'vertical' },
  btn: { padding: '8px 16px', border: `1px solid ${C.red}`, color: C.red, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: '0.08em' },
  btnSolid: { padding: '8px 16px', border: `1px solid ${C.red}`, color: '#000', background: C.red, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, letterSpacing: '0.08em' },
  btnGhost: { padding: '6px 12px', border: `1px solid ${C.line}`, color: C.dim, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  toast: { position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)', background: '#000', border: `1px solid ${C.red}`, color: C.white, padding: '10px 18px', fontSize: 13, zIndex: 50 },
};

function Field({ label, value, onChange, textarea, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {textarea
        ? <textarea style={S.ta} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={S.input} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
    </div>
  );
}

// ── Login ────────────────────────────────────────────────────────────
function Login({ onOk }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      await apiCall(pw, 'checkAuth');
      sessionStorage.setItem('cargo_admin_pw', pw);
      onOk(pw);
    } catch (e2) {
      setErr(e2.message === 'unauthorized' ? 'Falsches Passwort.' : e2.message);
    } finally { setBusy(false); }
  };
  return (
    <div style={{ ...S.page, maxWidth: 360, marginTop: '15vh' }}>
      <div style={S.h1}>CARGO — ADMIN</div>
      <div style={S.sub}>Bitte Passwort eingeben.</div>
      <form onSubmit={submit}>
        <input style={S.input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Passwort" autoFocus />
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{err}</div>}
        <button style={{ ...S.btnSolid, marginTop: 16, width: '100%' }} disabled={busy}>{busy ? '…' : 'Login'}</button>
      </form>
    </div>
  );
}

// ── Track-Zeile ──────────────────────────────────────────────────────
function TrackRow({ pw, track, onChange, onDelete, toast }) {
  const [uploading, setUploading] = useState(false);
  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadAudio(pw, file);
      onChange({ ...track, audio_path: url });
      toast('Audio hochgeladen ✓');
    } catch (e) { toast('Fehler: ' + e.message); } finally { setUploading(false); }
  };
  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 10, marginBottom: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 70px', gap: 8, alignItems: 'end' }}>
        <Field label="Nr" value={track.track_no} onChange={(v) => onChange({ ...track, track_no: v })} />
        <Field label="Titel" value={track.title} onChange={(v) => onChange({ ...track, title: v })} />
        <Field label="Artist" value={track.artist} onChange={(v) => onChange({ ...track, artist: v })} />
        <Field label="Dauer" value={track.duration} onChange={(v) => onChange({ ...track, duration: v })} placeholder="3:42" />
      </div>
      <div style={{ ...S.row, marginTop: 8 }}>
        <div style={{ fontSize: 11, color: track.audio_path ? '#5a5' : C.dim, wordBreak: 'break-all' }}>
          {track.audio_path ? '♪ Audio hinterlegt' : 'kein Audio'}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ ...S.btnGhost }}>
            {uploading ? 'lädt…' : (track.audio_path ? 'Audio ersetzen' : 'Audio (.m4a) hochladen')}
            <input type="file" accept="audio/*,.m4a,.mp3" style={{ display: 'none' }}
              onChange={(e) => upload(e.target.files[0])} />
          </label>
          <button style={S.btnGhost} onClick={onDelete}>löschen</button>
        </div>
      </div>
    </div>
  );
}

// ── Album-Editor ─────────────────────────────────────────────────────
function AlbumEditor({ pw, album, tracks, onClose, onSaved, toast }) {
  const [a, setA] = useState(album);
  const [ts, setTs] = useState(tracks);
  const [uploadingCover, setUploadingCover] = useState(false);
  const isNew = !album.id;

  const set = (k, v) => setA((p) => ({ ...p, [k]: v }));

  const slugify = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^\w]+/g, '-').replace(/^-+|-+$/g, '');

  const coverUpload = async (file) => {
    if (!file) return;
    setUploadingCover(true);
    try {
      const url = await uploadMedia(pw, file);
      set('cover_path', url);
      toast('Cover hochgeladen ✓');
    } catch (e) { toast('Fehler: ' + e.message); } finally { setUploadingCover(false); }
  };

  const save = async () => {
    try {
      let id = a.id;
      if (isNew) { id = a.id || slugify(a.title); if (!id) return toast('Titel/ID fehlt'); }
      const row = {
        id, title: a.title, artist: a.artist, label: a.label || 'CARGO', year: a.year,
        availability: a.availability, apple_url: a.apple_url || null, spotify_url: a.spotify_url || null,
        description: a.description, duration: a.duration, cover_color: a.cover_color, cover_path: a.cover_path,
        download_format: a.download_format || 'M4A (AAC)',
        in_library: !!a.in_library, published: a.published !== false,
        sort_order: Number(a.sort_order) || 0,
      };
      await apiCall(pw, 'saveAlbum', { row });
      // Tracks speichern
      for (const t of ts) {
        await apiCall(pw, 'saveTrack', { row: { id: t.id, album_id: id, track_no: Number(t.track_no) || 0, title: t.title, artist: t.artist || 'Typhex Webster', duration: t.duration, audio_path: t.audio_path || null } });
      }
      toast('Album gespeichert ✓');
      onSaved();
    } catch (e) { toast('Fehler: ' + e.message); }
  };

  const addTrack = () => setTs((p) => [...p, { _tmp: Math.random().toString(36).slice(2), track_no: p.length + 1, title: '', artist: a.artist || 'Typhex Webster', duration: '', audio_path: null }]);
  const updTrack = (i, v) => setTs((p) => p.map((t, idx) => idx === i ? v : t));
  const delTrack = async (i) => {
    const t = ts[i];
    if (t.id) { try { await apiCall(pw, 'deleteTrack', { id: t.id }); } catch (e) { return toast('Fehler: ' + e.message); } }
    setTs((p) => p.filter((_, idx) => idx !== i));
  };

  return (
    <div style={S.card}>
      <div style={{ ...S.row, marginBottom: 8 }}>
        <div style={{ color: C.red, letterSpacing: '0.1em' }}>{isNew ? 'NEUES ALBUM' : 'ALBUM BEARBEITEN'}</div>
        <button style={S.btnGhost} onClick={onClose}>← zurück</button>
      </div>
      {isNew && <Field label="ID / Slug (URL-Name, keine Leerzeichen)" value={a.id} onChange={(v) => set('id', v)} placeholder={slugify(a.title) || 'z.B. neues-album'} />}
      <div style={S.grid2}>
        <Field label="Titel" value={a.title} onChange={(v) => set('title', v)} />
        <Field label="Artist" value={a.artist} onChange={(v) => set('artist', v)} />
        <Field label="Jahr" value={a.year} onChange={(v) => set('year', v)} />
        <Field label="Dauer (Anzeige)" value={a.duration} onChange={(v) => set('duration', v)} placeholder="34 Min" />
        <Field label="Verfügbarkeit (Text)" value={a.availability} onChange={(v) => set('availability', v)} />
        <Field label="Cover-Farbe" value={a.cover_color} onChange={(v) => set('cover_color', v)} placeholder="#8B3A1A" />
        <Field label="Apple-Link (optional)" value={a.apple_url} onChange={(v) => set('apple_url', v)} />
        <Field label="Spotify-Link (optional)" value={a.spotify_url} onChange={(v) => set('spotify_url', v)} />
        <Field label="Download-Format (Text)" value={a.download_format} onChange={(v) => set('download_format', v)} placeholder="M4A (AAC)" />
        <Field label="Reihenfolge (0 = zuerst)" value={a.sort_order} onChange={(v) => set('sort_order', v)} type="number" />
      </div>
      <Field label="Beschreibung" value={a.description} onChange={(v) => set('description', v)} textarea />

      <div style={{ ...S.row, marginTop: 10 }}>
        <div style={{ fontSize: 12, color: a.cover_path ? '#5a5' : C.dim }}>
          {a.cover_path ? 'Cover hinterlegt' : 'kein Cover'}
        </div>
        <label style={S.btnGhost}>
          {uploadingCover ? 'lädt…' : 'Cover hochladen'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => coverUpload(e.target.files[0])} />
        </label>
      </div>
      {a.cover_path && <img src={a.cover_path} alt="" style={{ maxWidth: 120, marginTop: 8, border: `1px solid ${C.line}` }} />}

      <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12 }}>
        <label style={{ color: C.dim, cursor: 'pointer' }}>
          <input type="checkbox" checked={a.published !== false} onChange={(e) => set('published', e.target.checked)} /> sichtbar (published)
        </label>
        <label style={{ color: C.dim, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!a.in_library} onChange={(e) => set('in_library', e.target.checked)} /> in „YOUR LIBRARY"
        </label>
      </div>

      <div style={{ marginTop: 20, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ color: C.red, letterSpacing: '0.1em', marginBottom: 10, fontSize: 13 }}>TRACKS</div>
        {ts.map((t, i) => (
          <TrackRow key={t.id || t._tmp} pw={pw} track={t} onChange={(v) => updTrack(i, v)} onDelete={() => delTrack(i)} toast={toast} />
        ))}
        <button style={S.btnGhost} onClick={addTrack}>+ Track hinzufügen</button>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button style={S.btnSolid} onClick={save}>Album speichern</button>
        <button style={S.btnGhost} onClick={onClose}>Abbrechen</button>
      </div>
    </div>
  );
}

// ── Alben-Tab ────────────────────────────────────────────────────────
function AlbumsTab({ pw, data, reload, toast }) {
  const [editing, setEditing] = useState(null); // album object or null
  if (editing) {
    const tracks = (data.tracks || []).filter((t) => t.album_id === editing.id).sort((x, y) => x.track_no - y.track_no);
    return <AlbumEditor pw={pw} album={editing} tracks={editing.id ? tracks : []} toast={toast}
      onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />;
  }
  const del = async (id) => {
    if (!confirm('Album „' + id + '" wirklich löschen? (inkl. Tracks)')) return;
    try { await apiCall(pw, 'deleteAlbum', { id }); toast('Gelöscht'); reload(); }
    catch (e) { toast('Fehler: ' + e.message); }
  };
  return (
    <div>
      <button style={{ ...S.btnSolid, marginBottom: 16 }} onClick={() => setEditing({})}>+ Neues Album</button>
      {(data.albums || []).map((al) => {
        const n = (data.tracks || []).filter((t) => t.album_id === al.id).length;
        return (
          <div key={al.id} style={S.card}>
            <div style={S.row}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {al.cover_path && <img src={al.cover_path} alt="" style={{ width: 44, height: 44, objectFit: 'cover', border: `1px solid ${C.line}` }} />}
                <div>
                  <div style={{ letterSpacing: '0.06em' }}>{al.title} {al.published === false && <span style={{ color: C.dim }}>(versteckt)</span>}</div>
                  <div style={{ color: C.dim, fontSize: 11 }}>{al.artist} · {n} Tracks · {al.year || '—'}{al.in_library ? ' · LIBRARY' : ''}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.btnGhost} onClick={() => setEditing(al)}>bearbeiten</button>
                <button style={S.btnGhost} onClick={() => del(al.id)}>löschen</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Galerie-Tab ──────────────────────────────────────────────────────
function GalleryTab({ pw, data, reload, toast }) {
  const [busy, setBusy] = useState(false);
  const add = async (kind, file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadMedia(pw, file);
      const sort = (data.gallery || []).length + 1;
      await apiCall(pw, 'saveGallery', { row: { kind, label: file.name.replace(/\.[^.]+$/, ''), src_path: url, sort_order: sort, published: true } });
      toast('Hinzugefügt ✓'); reload();
    } catch (e) { toast('Fehler: ' + e.message); } finally { setBusy(false); }
  };
  const del = async (id) => {
    if (!confirm('Eintrag löschen?')) return;
    try { await apiCall(pw, 'deleteGallery', { id }); reload(); } catch (e) { toast('Fehler: ' + e.message); }
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={S.btnSolid}>{busy ? 'lädt…' : '+ Bild hochladen'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => add('image', e.target.files[0])} /></label>
        <label style={S.btn}>{busy ? 'lädt…' : '+ Video hochladen'}
          <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => add('video', e.target.files[0])} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
        {(data.gallery || []).map((g) => (
          <div key={g.id} style={{ border: `1px solid ${C.line}`, padding: 8 }}>
            {g.kind === 'image'
              ? <img src={g.src_path} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
              : <video src={g.src_path} style={{ width: '100%', height: 100, objectFit: 'cover' }} />}
            <div style={{ fontSize: 11, color: C.dim, margin: '6px 0', wordBreak: 'break-all' }}>{g.kind} · {g.label}</div>
            <button style={{ ...S.btnGhost, width: '100%' }} onClick={() => del(g.id)}>löschen</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Texte-Tab ────────────────────────────────────────────────────────
function SiteTab({ pw, data, reload, toast }) {
  const [rows, setRows] = useState(data.site || []);
  const [nk, setNk] = useState(''); const [nv, setNv] = useState('');
  useEffect(() => setRows(data.site || []), [data.site]);
  const save = async (key, value) => {
    try { await apiCall(pw, 'saveSite', { key, value }); toast('Gespeichert ✓'); }
    catch (e) { toast('Fehler: ' + e.message); }
  };
  return (
    <div>
      <div style={S.sub}>Frei editierbare Textbausteine (z. B. für die Landing Page). Der Code liest sie über ihren Schlüssel.</div>
      {rows.map((r, i) => (
        <div key={r.key} style={S.card}>
          <div style={{ color: C.red, fontSize: 12, marginBottom: 4 }}>{r.key}</div>
          <textarea style={S.ta} value={r.value || ''} onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
          <button style={{ ...S.btn, marginTop: 8 }} onClick={() => save(r.key, rows[i].value)}>speichern</button>
        </div>
      ))}
      <div style={S.card}>
        <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>NEUER TEXT</div>
        <div style={S.grid2}>
          <Field label="Schlüssel (key)" value={nk} onChange={setNk} placeholder="hero_title" />
        </div>
        <Field label="Wert" value={nv} onChange={setNv} textarea />
        <button style={{ ...S.btn, marginTop: 8 }} onClick={async () => { if (!nk) return; await save(nk, nv); setNk(''); setNv(''); reload(); }}>hinzufügen</button>
      </div>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────
export default function Admin() {
  const [pw, setPw] = useState(() => sessionStorage.getItem('cargo_admin_pw') || '');
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState({ albums: [], tracks: [], gallery: [], site: [] });
  const [tab, setTab] = useState('albums');
  const [toastMsg, setToastMsg] = useState('');
  const toast = useCallback((m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2600); }, []);

  const reload = useCallback(async () => {
    try { const d = await apiCall(pw, 'list'); setData(d); setAuthed(true); }
    catch (e) { if (e.message === 'unauthorized') { setAuthed(false); sessionStorage.removeItem('cargo_admin_pw'); } else toast('Fehler: ' + e.message); }
  }, [pw, toast]);

  useEffect(() => { if (pw) reload(); }, []); // eslint-disable-line

  if (!supabase) return <div style={S.page}><div style={S.h1}>CARGO — ADMIN</div><div style={{ color: C.red }}>Supabase nicht konfiguriert (VITE-Variablen fehlen).</div></div>;
  if (!authed) return <Login onOk={(p) => { setPw(p); setAuthed(true); apiCall(p, 'list').then(setData).catch(() => {}); }} />;

  return (
    <div style={S.page}>
      <div style={S.row}>
        <div><div style={S.h1}>CARGO — ADMIN</div><div style={S.sub}>Inhalte pflegen. Änderungen sind sofort live.</div></div>
        <button style={S.btnGhost} onClick={() => { sessionStorage.removeItem('cargo_admin_pw'); setAuthed(false); setPw(''); }}>Logout</button>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'albums')} onClick={() => setTab('albums')}>ALBEN</button>
        <button style={S.tab(tab === 'gallery')} onClick={() => setTab('gallery')}>GALERIE</button>
        <button style={S.tab(tab === 'site')} onClick={() => setTab('site')}>TEXTE</button>
        <button style={S.tab(false)} onClick={reload}>↻ neu laden</button>
      </div>
      {tab === 'albums' && <AlbumsTab pw={pw} data={data} reload={reload} toast={toast} />}
      {tab === 'gallery' && <GalleryTab pw={pw} data={data} reload={reload} toast={toast} />}
      {tab === 'site' && <SiteTab pw={pw} data={data} reload={reload} toast={toast} />}
      {toastMsg && <div style={S.toast}>{toastMsg}</div>}
    </div>
  );
}
