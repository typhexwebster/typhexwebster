import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient.js';
import { analyseAudio, formatDuration } from './eqBake.js';
import { SITE_TEXTS } from './siteTexts.js';
import { NO_TRACK_KEY } from './analytics.js';

// ── Network helpers ──────────────────────────────────────────────────
async function apiCall(pw, action, body = {}) {
  const res = await fetch('/api/admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ action, ...body }),
  });
  const j = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('unauthorized');
  if (!res.ok) throw new Error(j.error || 'Request failed');
  return j;
}

async function presign(pw, target, file) {
  const res = await fetch('/api/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': pw },
    body: JSON.stringify({ target, filename: file.name, contentType: file.type || 'application/octet-stream' }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || 'Could not get upload URL');
  return j;
}

async function uploadAudio(pw, file) {
  const { uploadUrl, publicUrl, contentType } = await presign(pw, 'audio', file);
  const put = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: file });
  if (!put.ok) throw new Error('R2 upload failed (' + put.status + ') — is CORS set on the bucket?');
  return publicUrl;
}

async function uploadMedia(pw, file) {
  const { path, token, publicUrl } = await presign(pw, 'media', file);
  const { error } = await supabase.storage.from('media').uploadToSignedUrl(path, token, file);
  if (error) throw new Error('Image upload: ' + error.message);
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
  handle: { cursor: 'grab', color: C.dim, fontSize: 16, lineHeight: 1, padding: '0 6px', userSelect: 'none' },
};

function Field({ label, value, onChange, textarea, placeholder, type = 'text', hint }) {
  return (
    <div>
      <label style={S.label}>{label}</label>
      {textarea
        ? <textarea style={S.ta} value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
        : <input style={S.input} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
      {hint && <div style={{ color: C.dim, fontSize: 10, marginTop: 3 }}>{hint}</div>}
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
      setErr(e2.message === 'unauthorized' ? 'Wrong password.' : e2.message);
    } finally { setBusy(false); }
  };
  return (
    <div style={{ ...S.page, maxWidth: 360, marginTop: '15vh' }}>
      <div style={S.h1}>CARGO — ADMIN</div>
      <div style={S.sub}>Please enter your password.</div>
      <form onSubmit={submit}>
        <input style={S.input} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" autoFocus />
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8 }}>{err}</div>}
        <button style={{ ...S.btnSolid, marginTop: 16, width: '100%' }} disabled={busy}>{busy ? '…' : 'Log in'}</button>
      </form>
    </div>
  );
}

// ── Track row ────────────────────────────────────────────────────────
// Beim Hochladen wird die Datei direkt analysiert: Die Frequenzdaten
// landen in eq_data, damit der EQ auf der Webseite auf die echte Musik
// reagieren kann — auch auf dem iPhone, wo ein Live-Analyzer die
// Hintergrund-Wiedergabe zerstören würde.
function TrackRow({ pw, track, analysed, onChange, onDelete, toast }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(-1); // -1 = idle, sonst 0..1

  const hasEq = !!track.eq_data || analysed;

  const runAnalysis = async (source) => {
    setProgress(0);
    try {
      const json = await analyseAudio(source, (p) => setProgress(p));
      return json;
    } finally { setProgress(-1); }
  };

  const upload = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      // Erst analysieren (die Datei liegt hier schon im Speicher),
      // dann hochladen. So ist beides in einem Rutsch erledigt.
      let eq = null, dur = null;
      try {
        const bytes = await file.arrayBuffer();
        eq = await runAnalysis(bytes);
        const meta = JSON.parse(eq);
        if (meta && meta.dur) dur = formatDuration(meta.dur);
      } catch (e) {
        toast('Uploaded, but analysis failed: ' + e.message);
      }
      const url = await uploadAudio(pw, file);
      onChange({
        ...track,
        audio_path: url,
        eq_data: eq || track.eq_data || null,
        duration: track.duration || dur || '',
      });
      toast(eq ? 'Audio uploaded and analysed ✓' : 'Audio uploaded ✓');
    } catch (e) { toast('Error: ' + e.message); } finally { setUploading(false); }
  };

  // Bereits hochgeladene Tracks nachträglich analysieren: Datei einmal
  // von R2 holen, auswerten, sofort speichern.
  const analyseExisting = async () => {
    if (!track.audio_path) return toast('No audio file on this track yet.');
    try {
      const res = await fetch(track.audio_path);
      if (!res.ok) throw new Error('Could not download the audio (' + res.status + ')');
      const bytes = await res.arrayBuffer();
      const json = await runAnalysis(bytes);
      if (track.id) await apiCall(pw, 'saveTrackEq', { id: track.id, eq_data: json });
      onChange({ ...track, eq_data: json });
      toast('Analysed ✓');
    } catch (e) { toast('Error: ' + e.message); }
  };

  return (
    <div style={{ border: `1px solid ${C.line}`, padding: 10, marginBottom: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '50px 1fr 1fr 70px', gap: 8, alignItems: 'end' }}>
        <Field label="No" value={track.track_no} onChange={(v) => onChange({ ...track, track_no: v })} />
        <Field label="Title" value={track.title} onChange={(v) => onChange({ ...track, title: v })} />
        <Field label="Artist" value={track.artist} onChange={(v) => onChange({ ...track, artist: v })} />
        <Field label="Length" value={track.duration} onChange={(v) => onChange({ ...track, duration: v })} placeholder="3:42" />
      </div>
      <div style={{ ...S.row, marginTop: 8, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 11, wordBreak: 'break-all' }}>
          <span style={{ color: track.audio_path ? '#5a5' : C.dim }}>
            {track.audio_path ? '♪ audio attached' : 'no audio'}
          </span>
          <span style={{ color: hasEq ? '#5a5' : '#a80', marginLeft: 12 }}>
            {hasEq ? '▍ EQ analysed' : '▍ EQ not analysed'}
          </span>
          {progress >= 0 && (
            <span style={{ color: C.red, marginLeft: 12 }}>
              analysing… {Math.round(progress * 100)}%
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ ...S.btnGhost }}>
            {uploading ? 'uploading…' : (track.audio_path ? 'Replace audio' : 'Upload audio (.m4a)')}
            <input type="file" accept="audio/*,.m4a,.mp3" style={{ display: 'none' }}
              onChange={(e) => upload(e.target.files[0])} />
          </label>
          {track.audio_path && (
            <button style={S.btnGhost} onClick={analyseExisting} disabled={progress >= 0}>
              {hasEq ? 'Re-analyse EQ' : 'Analyse EQ'}
            </button>
          )}
          <button style={S.btnGhost} onClick={onDelete}>delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Remove from every library ────────────────────────────────────────
// Die Librarys liegen im Browser jedes Besuchers. Der Knopf setzt auf dem
// Server einen neuen Stand; jeder Browser gleicht beim nächsten Besuch ab
// und wirft das Release raus. Die Musik unter MUSIC bleibt unberührt.
function LibraryReset({ pw, album, lastReset, onDone, toast }) {
  const [busy, setBusy] = useState(false);
  const fmt = (iso) => {
    const d = new Date(iso);
    return isNaN(d) ? '' : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };
  const run = async () => {
    const ok = confirm(
      'Remove “' + (album.title || album.id) + '” from EVERY visitor\'s library?\n\n' +
      '• It disappears from each library on that visitor\'s next visit.\n' +
      '• The release stays in MUSIC — delete it there separately if needed.\n' +
      '• Files people already saved on their devices cannot be touched.\n' +
      '• Anyone who downloads it again afterwards keeps it.\n\n' +
      'This cannot be undone.'
    );
    if (!ok) return;
    setBusy(true);
    try {
      const r = await apiCall(pw, 'resetLibrary', { albumId: album.id });
      toast('Removed from all libraries ✓');
      onDone && onDone(album.id, r.reset_at);
    } catch (e) { toast('Error: ' + e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 18, border: `1px solid ${C.red}`, padding: 12 }}>
      <div style={{ color: C.red, letterSpacing: '0.1em', fontSize: 12, marginBottom: 6 }}>LIBRARY</div>
      <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>
        Takes this release out of every visitor&apos;s library at once — for when the music changed.
        MUSIC is not affected.
        {lastReset && <><br />Last removed: {fmt(lastReset)}</>}
      </div>
      <button style={S.btn} onClick={run} disabled={busy}>
        {busy ? 'removing…' : 'Remove from all libraries'}
      </button>
    </div>
  );
}

// ── Album editor ─────────────────────────────────────────────────────
function AlbumEditor({ pw, album, tracks, analysedIds, libraryResets, onLibraryReset, onClose, onSaved, toast }) {
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
      toast('Cover uploaded ✓');
    } catch (e) { toast('Error: ' + e.message); } finally { setUploadingCover(false); }
  };

  const save = async () => {
    try {
      let id = a.id;
      if (isNew) { id = a.id || slugify(a.title); if (!id) return toast('Title / ID is missing'); }
      const row = {
        id, title: a.title, artist: a.artist, label: a.label || 'CARGO', year: a.year,
        availability: a.availability, apple_url: a.apple_url || null, spotify_url: a.spotify_url || null,
        description: a.description, duration: a.duration, cover_path: a.cover_path,
        copyright: a.copyright || null,
        release_date: a.release_date || null,
        download_format: a.download_format || 'M4A (AAC)',
        published: a.published !== false,
        sort_order: Number(a.sort_order) || 0,
      };
      await apiCall(pw, 'saveAlbum', { row });
      for (const t of ts) {
        await apiCall(pw, 'saveTrack', {
          row: {
            id: t.id, album_id: id, track_no: Number(t.track_no) || 0, title: t.title,
            artist: t.artist || 'Typhex Webster', duration: t.duration,
            audio_path: t.audio_path || null,
            ...(t.eq_data ? { eq_data: t.eq_data } : {}),
          },
        });
      }
      toast('Album saved ✓');
      onSaved();
    } catch (e) { toast('Error: ' + e.message); }
  };

  const addTrack = () => setTs((p) => [...p, { _tmp: Math.random().toString(36).slice(2), track_no: p.length + 1, title: '', artist: a.artist || 'Typhex Webster', duration: '', audio_path: null }]);
  const updTrack = (i, v) => setTs((p) => p.map((t, idx) => idx === i ? v : t));
  const delTrack = async (i) => {
    const t = ts[i];
    if (t.id) { try { await apiCall(pw, 'deleteTrack', { id: t.id }); } catch (e) { return toast('Error: ' + e.message); } }
    setTs((p) => p.filter((_, idx) => idx !== i));
  };

  return (
    <div style={S.card}>
      <div style={{ ...S.row, marginBottom: 8 }}>
        <div style={{ color: C.red, letterSpacing: '0.1em' }}>{isNew ? 'NEW ALBUM' : 'EDIT ALBUM'}</div>
        <button style={S.btnGhost} onClick={onClose}>← back</button>
      </div>
      {isNew && <Field label="ID / slug (used in the URL, no spaces)" value={a.id} onChange={(v) => set('id', v)} placeholder={slugify(a.title) || 'e.g. new-album'} />}
      <div style={S.grid2}>
        <Field label="Title" value={a.title} onChange={(v) => set('title', v)} />
        <Field label="Artist" value={a.artist} onChange={(v) => set('artist', v)} />
        <Field label="Year" value={a.year} onChange={(v) => set('year', v)} />
        <Field label="Length (display)" value={a.duration} onChange={(v) => set('duration', v)} placeholder="34 min" />
        <Field label="Availability (text)" value={a.availability} onChange={(v) => set('availability', v)} />
        <Field label="Download format (text)" value={a.download_format} onChange={(v) => set('download_format', v)} placeholder="M4A (AAC)" />
        <Field label="Apple link (optional)" value={a.apple_url} onChange={(v) => set('apple_url', v)} />
        <Field label="Spotify link (optional)" value={a.spotify_url} onChange={(v) => set('spotify_url', v)} />
      </div>
      <Field
        label="Copyright line"
        value={a.copyright}
        onChange={(v) => set('copyright', v)}
        placeholder="© CARGO 2026. All rights reserved."
        hint="Shown underneath the track list. Leave empty to hide the line completely." />
      <Field
        label="Release date"
        value={a.release_date}
        onChange={(v) => set('release_date', v)}
        placeholder="28 August 2026"
        hint="Grey line below the copyright. Free text — leave empty to hide it." />
      <Field label="Description" value={a.description} onChange={(v) => set('description', v)} textarea />

      <div style={{ ...S.row, marginTop: 10 }}>
        <div style={{ fontSize: 12, color: a.cover_path ? '#5a5' : C.dim }}>
          {a.cover_path ? 'cover attached' : 'no cover'}
        </div>
        <label style={S.btnGhost}>
          {uploadingCover ? 'uploading…' : 'Upload cover'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => coverUpload(e.target.files[0])} />
        </label>
      </div>
      {a.cover_path && <img src={a.cover_path} alt="" style={{ maxWidth: 120, marginTop: 8, border: `1px solid ${C.line}` }} />}

      <div style={{ display: 'flex', gap: 20, marginTop: 14, fontSize: 12 }}>
        <label style={{ color: C.dim, cursor: 'pointer' }}>
          <input type="checkbox" checked={a.published !== false} onChange={(e) => set('published', e.target.checked)} /> visible (published)
        </label>
      </div>

      {!isNew && (
        <LibraryReset pw={pw} album={a} lastReset={libraryResets && libraryResets[a.id]}
          onDone={onLibraryReset} toast={toast} />
      )}

      <div style={{ marginTop: 20, borderTop: `1px solid ${C.line}`, paddingTop: 14 }}>
        <div style={{ color: C.red, letterSpacing: '0.1em', marginBottom: 10, fontSize: 13 }}>TRACKS</div>
        {ts.map((t, i) => (
          <TrackRow key={t.id || t._tmp} pw={pw} track={t}
            analysed={!!t.id && analysedIds.includes(t.id)}
            onChange={(v) => updTrack(i, v)} onDelete={() => delTrack(i)} toast={toast} />
        ))}
        <button style={S.btnGhost} onClick={addTrack}>+ Add track</button>
      </div>

      <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
        <button style={S.btnSolid} onClick={save}>Save album</button>
        <button style={S.btnGhost} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ── Albums tab ───────────────────────────────────────────────────────
// Die Reihenfolge wird durch Ziehen der Kästen festgelegt und sofort
// gespeichert. Die Pfeiltasten daneben machen dasselbe — praktisch auf
// dem Tablet, wo Ziehen nicht überall funktioniert.
function AlbumsTab({ pw, data, reload, toast }) {
  const [editing, setEditing] = useState(null);
  const [order, setOrder] = useState(data.albums || []);
  const [dragId, setDragId] = useState(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const dirty = useRef(false);

  useEffect(() => { if (!dirty.current) setOrder(data.albums || []); }, [data.albums]);

  const persist = async (list) => {
    setSavingOrder(true);
    try {
      await apiCall(pw, 'reorderAlbums', { order: list.map((al, i) => ({ id: al.id, sort_order: i })) });
      dirty.current = false;
      toast('Order saved ✓');
      reload();
    } catch (e) { toast('Error: ' + e.message); } finally { setSavingOrder(false); }
  };

  const move = (from, to) => {
    if (to < 0 || to >= order.length || from === to) return;
    const list = order.slice();
    const [item] = list.splice(from, 1);
    list.splice(to, 0, item);
    dirty.current = true;
    setOrder(list);
    persist(list);
  };

  const onDrop = (targetId) => {
    if (!dragId || dragId === targetId) return setDragId(null);
    const from = order.findIndex((x) => x.id === dragId);
    const to = order.findIndex((x) => x.id === targetId);
    setDragId(null);
    move(from, to);
  };

  if (editing) {
    const tracks = (data.tracks || []).filter((t) => t.album_id === editing.id).sort((x, y) => x.track_no - y.track_no);
    return <AlbumEditor pw={pw} album={editing} tracks={editing.id ? tracks : []}
      analysedIds={data.analysedTrackIds || []} toast={toast}
      libraryResets={data.libraryResets || {}}
      onLibraryReset={() => reload()}
      onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />;
  }

  const del = async (id) => {
    if (!confirm('Really delete album “' + id + '”? (including its tracks)')) return;
    try { await apiCall(pw, 'deleteAlbum', { id }); toast('Deleted'); reload(); }
    catch (e) { toast('Error: ' + e.message); }
  };

  return (
    <div>
      <div style={{ ...S.row, marginBottom: 16 }}>
        <button style={S.btnSolid} onClick={() => setEditing({})}>+ New album</button>
        <div style={{ color: C.dim, fontSize: 11 }}>
          {savingOrder ? 'saving order…' : 'drag the ⣿ handle to reorder'}
        </div>
      </div>
      {order.map((al, i) => {
        const n = (data.tracks || []).filter((t) => t.album_id === al.id).length;
        return (
          <div
            key={al.id}
            draggable
            onDragStart={() => setDragId(al.id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(al.id)}
            style={{
              ...S.card,
              opacity: dragId === al.id ? 0.4 : 1,
              borderColor: dragId && dragId !== al.id ? C.red : C.line,
            }}>
            <div style={S.row}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={S.handle} title="Drag to reorder">⣿</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <button style={{ ...S.btnGhost, padding: '0 6px', lineHeight: 1.4 }} onClick={() => move(i, i - 1)} disabled={i === 0}>▲</button>
                  <button style={{ ...S.btnGhost, padding: '0 6px', lineHeight: 1.4 }} onClick={() => move(i, i + 1)} disabled={i === order.length - 1}>▼</button>
                </div>
                {al.cover_path && <img src={al.cover_path} alt="" style={{ width: 44, height: 44, objectFit: 'cover', border: `1px solid ${C.line}` }} />}
                <div>
                  <div style={{ letterSpacing: '0.06em' }}>{al.title} {al.published === false && <span style={{ color: C.dim }}>(hidden)</span>}</div>
                  <div style={{ color: C.dim, fontSize: 11 }}>{al.artist} · {n} tracks · {al.year || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={S.btnGhost} onClick={() => setEditing(al)}>edit</button>
                <button style={S.btnGhost} onClick={() => del(al.id)}>delete</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Gallery tab ──────────────────────────────────────────────────────
function GalleryTab({ pw, data, reload, toast }) {
  const [busy, setBusy] = useState(false);
  const add = async (kind, file) => {
    if (!file) return;
    setBusy(true);
    try {
      const url = await uploadMedia(pw, file);
      const sort = (data.gallery || []).length + 1;
      await apiCall(pw, 'saveGallery', { row: { kind, label: file.name.replace(/\.[^.]+$/, ''), src_path: url, sort_order: sort, published: true } });
      toast('Added ✓'); reload();
    } catch (e) { toast('Error: ' + e.message); } finally { setBusy(false); }
  };
  const del = async (id) => {
    if (!confirm('Delete this item?')) return;
    try { await apiCall(pw, 'deleteGallery', { id }); reload(); } catch (e) { toast('Error: ' + e.message); }
  };
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <label style={S.btnSolid}>{busy ? 'uploading…' : '+ Upload image'}
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => add('image', e.target.files[0])} /></label>
        <label style={S.btn}>{busy ? 'uploading…' : '+ Upload video'}
          <input type="file" accept="video/*" style={{ display: 'none' }} onChange={(e) => add('video', e.target.files[0])} /></label>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 12 }}>
        {(data.gallery || []).map((g) => (
          <div key={g.id} style={{ border: `1px solid ${C.line}`, padding: 8 }}>
            {g.kind === 'image'
              ? <img src={g.src_path} alt="" style={{ width: '100%', height: 100, objectFit: 'cover' }} />
              : <video src={g.src_path} style={{ width: '100%', height: 100, objectFit: 'cover' }} />}
            <div style={{ fontSize: 11, color: C.dim, margin: '6px 0', wordBreak: 'break-all' }}>{g.kind} · {g.label}</div>
            <button style={{ ...S.btnGhost, width: '100%' }} onClick={() => del(g.id)}>delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Texts tab ────────────────────────────────────────────────────────
// Früher konnte man hier beliebige Schlüssel anlegen — nur hat die
// öffentliche Seite keinen davon gelesen. Ein Schlüssel wirkt erst, wenn er
// im Code verdrahtet ist, deshalb zeigt der Reiter jetzt genau die Texte,
// die es wirklich gibt: beschriftet, mit Hinweis, wo sie stehen.
function SiteTab({ pw, data, toast }) {
  const stored = {};
  (data.site || []).forEach((r) => { stored[r.key] = r.value || ''; });

  // Ist noch nichts gespeichert, steht der Text aus dem Code im Feld —
  // man bearbeitet ihn also, statt bei null anzufangen.
  const [vals, setVals] = useState(() => {
    const o = {};
    SITE_TEXTS.forEach((t) => { o[t.key] = stored[t.key] || t.fallback; });
    return o;
  });
  const [busy, setBusy] = useState('');

  useEffect(() => {
    const o = {};
    SITE_TEXTS.forEach((t) => { o[t.key] = (stored[t.key] || '').trim() || t.fallback; });
    setVals(o);
  }, [data.site]); // eslint-disable-line

  const save = async (t) => {
    setBusy(t.key);
    try {
      await apiCall(pw, 'saveSite', { key: t.key, value: vals[t.key] });
      toast('Saved ✓ — live right away');
    } catch (e) { toast('Error: ' + e.message); } finally { setBusy(''); }
  };

  const reset = (t) => setVals((p) => ({ ...p, [t.key]: t.fallback }));

  // Schlüssel aus alten Versuchen, die niemand liest — der Ehrlichkeit
  // halber sichtbar, aber als wirkungslos gekennzeichnet.
  const unused = (data.site || []).filter((r) => !SITE_TEXTS.some((t) => t.key === r.key));

  return (
    <div>
      <div style={S.sub}>
        These are the texts on the site you can edit. Changes are live immediately.
      </div>

      {SITE_TEXTS.map((t) => (
        <div key={t.key} style={S.card}>
          <div style={{ color: C.red, fontSize: 12, letterSpacing: '0.08em' }}>{t.label}</div>
          <div style={{ color: C.dim, fontSize: 10, margin: '4px 0 10px' }}>
            {t.hint} <span style={{ opacity: 0.6 }}>· key: {t.key}</span>
          </div>
          <textarea
            style={{ ...S.ta, minHeight: t.multiline ? 150 : 70 }}
            value={vals[t.key] || ''}
            onChange={(e) => setVals((p) => ({ ...p, [t.key]: e.target.value }))} />
          <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
            <button style={S.btn} onClick={() => save(t)} disabled={busy === t.key}>
              {busy === t.key ? 'saving…' : 'save'}
            </button>
            <button style={S.btnGhost} onClick={() => reset(t)}>reset to default</button>
          </div>
        </div>
      ))}

      {unused.length > 0 && (
        <div style={{ ...S.card, borderStyle: 'dashed' }}>
          <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.7 }}>
            Left over from earlier: {unused.map((r) => r.key).join(', ')}.<br />
            Nothing on the site reads these — they have no effect.
          </div>
        </div>
      )}
    </div>
  );
}

// ── Analytics tab ────────────────────────────────────────────────────
// Holt die fertig gerechnete Auswertung alle 10 Sekunden neu, solange der
// Reiter offen und das Fenster sichtbar ist. Keine fremden Bibliotheken,
// die Grafik ist schlichtes SVG.
const RANGES = [
  { k: 'today', label: 'TODAY',   bucket: 'hour' },
  { k: '24h',   label: '24 H',    bucket: 'hour', ms: 864e5 },
  { k: '7d',    label: '7 DAYS',  bucket: 'day',  ms: 7 * 864e5 },
  { k: '30d',   label: '30 DAYS', bucket: 'day',  ms: 30 * 864e5 },
  { k: '90d',   label: '90 DAYS', bucket: 'day',  ms: 90 * 864e5 },
  { k: 'all',   label: 'ALL',     bucket: 'day' },
];

const METRICS = [
  { k: 'visitors',  label: 'Visitors' },
  { k: 'views',     label: 'Page views' },
  { k: 'plays',     label: 'Plays' },
  { k: 'downloads', label: 'Downloads' },
];

const SECTION_LABELS = {
  landing: 'Start page (ENTER)', menu: 'Menu', music: 'MUSIC', library: 'LIBRARY',
  cargo: 'CARGO', store: 'STORE', contact: 'CONTACT',
};

const regionNames = (() => {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }); } catch (e) { return null; }
})();
function countryLabel(code) {
  if (!code || code === '??' || code.length !== 2) return '🏳 Unknown';
  const flag = String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
  let name = code;
  try { name = (regionNames && regionNames.of(code.toUpperCase())) || code; } catch (e) {}
  return `${flag} ${name}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// "2026-09-26T14:00" — schon in der eigenen Zeitzone gerechnet.
function bucketLabel(b, bucket) {
  const [d, t] = String(b).split('T');
  const [, m, day] = d.split('-');
  if (bucket === 'hour') return (t || '').slice(0, 2) + ':00';
  return `${Number(day)} ${MONTHS[Number(m) - 1] || ''}`;
}

const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');

function Stat({ label, value, sub }) {
  return (
    <div style={{ ...S.card, marginBottom: 0, padding: 14 }}>
      <div style={{ color: C.dim, fontSize: 10, letterSpacing: '0.12em' }}>{label}</div>
      <div style={{ fontSize: 26, marginTop: 6, letterSpacing: '0.04em' }}>{fmtNum(value)}</div>
      {sub && <div style={{ color: C.dim, fontSize: 10, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function Chart({ series, metric, bucket }) {
  const W = 860, H = 180, PAD_B = 22, PAD_T = 14;
  const vals = series.map((p) => Number(p[metric]) || 0);
  const max = Math.max(1, ...vals);
  const n = Math.max(1, series.length);
  const slot = W / n;
  const bw = Math.max(1, Math.min(28, slot * 0.7));
  // Beschriftung nur an jeder k-ten Säule, damit nichts übereinanderliegt.
  const every = Math.max(1, Math.ceil(n / 12));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      <line x1="0" x2={W} y1={H - PAD_B} y2={H - PAD_B} stroke={C.line} />
      <text x="0" y="10" fill={C.dim} fontSize="10" fontFamily="inherit">max {fmtNum(max)}</text>
      {series.map((p, i) => {
        const v = vals[i];
        const h = (v / max) * (H - PAD_B - PAD_T);
        const x = i * slot + (slot - bw) / 2;
        return (
          <g key={p.b}>
            <rect x={x} y={H - PAD_B - h} width={bw} height={Math.max(v ? 1 : 0, h)} fill={C.red}>
              <title>{`${bucketLabel(p.b, bucket)} — ${fmtNum(v)}`}</title>
            </rect>
            {i % every === 0 && (
              <text x={i * slot + slot / 2} y={H - 6} fill={C.dim} fontSize="10" textAnchor="middle" fontFamily="inherit">
                {bucketLabel(p.b, bucket)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Liste mit Balken im Hintergrund.
function BarList({ title, rows, label, value, sub, empty = 'No data yet.' }) {
  const max = Math.max(1, ...rows.map((r) => Number(value(r)) || 0));
  return (
    <div style={{ ...S.card, marginBottom: 0 }}>
      <div style={{ color: C.red, fontSize: 11, letterSpacing: '0.12em', marginBottom: 10 }}>{title}</div>
      {!rows.length && <div style={{ color: C.dim, fontSize: 11 }}>{empty}</div>}
      {rows.map((r, i) => {
        const v = Number(value(r)) || 0;
        return (
          <div key={i} style={{ position: 'relative', padding: '5px 8px', marginBottom: 3, fontSize: 12 }}>
            <div style={{ position: 'absolute', inset: 0, width: `${(v / max) * 100}%`, background: 'rgba(200,64,42,0.18)' }} />
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label(r)}</span>
              <span style={{ whiteSpace: 'nowrap' }}>
                {fmtNum(v)}{sub && <span style={{ color: C.dim }}> {sub(r)}</span>}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function eventText(e) {
  const song = e.track_title ? `${e.track_title}${e.album_title ? ' — ' + e.album_title : ''}` : (e.album_title || '');
  if (e.type === 'play') return ['▶ played', song];
  if (e.type === 'download') return [e.redownload ? '↻ re-downloaded' : '↓ downloaded', song];
  if (e.album_title) return ['◉ opened', e.album_title];
  return ['◉ visited', SECTION_LABELS[e.section] || e.section || '—'];
}

function AnalyticsTab({ pw }) {
  const [range, setRange] = useState('today');
  const [metric, setMetric] = useState('visitors');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [updated, setUpdated] = useState(null);
  const [excluded, setExcluded] = useState(() => {
    try { return localStorage.getItem(NO_TRACK_KEY) === '1'; } catch (e) { return false; }
  });
  const reqId = useRef(0);

  const toggleExcluded = (on) => {
    try {
      if (on) localStorage.setItem(NO_TRACK_KEY, '1');
      else localStorage.setItem(NO_TRACK_KEY, '0');
    } catch (e) {}
    setExcluded(on);
  };

  const R = RANGES.find((r) => r.k === range) || RANGES[0];

  const load = useCallback(async () => {
    const my = ++reqId.current;
    let since;
    if (R.k === 'today') { const d = new Date(); d.setHours(0, 0, 0, 0); since = d; }
    else if (R.k === 'all') since = new Date(0);
    else since = new Date(Date.now() - R.ms);
    const tz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return 'Europe/Zurich'; } })();
    try {
      const d = await apiCall(pw, 'analytics', { since: since.toISOString(), tz, bucket: R.bucket });
      if (my !== reqId.current) return; // eine neuere Abfrage läuft schon
      setData(d); setErr(''); setUpdated(new Date());
    } catch (e) {
      if (my === reqId.current) setErr(e.message);
    }
  }, [pw, R]);

  useEffect(() => {
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, 10000);
    const onVis = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, [load]);

  const t = (data && data.totals) || {};
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 12, marginBottom: 12 };

  return (
    <div>
      {/* Kopf: live + Zeitraum */}
      <div style={{ ...S.row, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 9, height: 9, borderRadius: '50%', background: data && data.live ? '#3c3' : C.dim,
            boxShadow: data && data.live ? '0 0 8px #3c3' : 'none', display: 'inline-block',
          }} />
          <span style={{ fontSize: 13, letterSpacing: '0.08em' }}>
            {data ? fmtNum(data.live) : '–'} ONLINE NOW
          </span>
          {data && data.live_sections && data.live_sections.length > 0 && (
            <span style={{ color: C.dim, fontSize: 11 }}>
              ({data.live_sections.map((s) => `${SECTION_LABELS[s.k] || s.k} ${s.n}`).join(' · ')})
            </span>
          )}
        </div>
        <div style={{ color: C.dim, fontSize: 10 }}>
          {updated ? `updated ${updated.toLocaleTimeString('en-GB')} · refreshes every 10 s` : 'loading…'}
        </div>
      </div>

      <div style={{ ...S.tabs, marginBottom: 14 }}>
        {RANGES.map((r) => (
          <button key={r.k} style={S.tab(range === r.k)} onClick={() => setRange(r.k)}>{r.label}</button>
        ))}
      </div>

      {err && <div style={{ ...S.card, borderColor: C.red, color: C.red, fontSize: 12 }}>{err}</div>}

      {data && (
        <>
          <div style={{ ...grid, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            <Stat label="VISITORS" value={t.visitors} />
            <Stat label="PAGE VIEWS" value={t.views} />
            <Stat label="PLAYS" value={t.plays} sub={`${fmtNum(t.listeners)} listeners`} />
            <Stat label="DOWNLOADS" value={t.downloads} sub={`+ ${fmtNum(t.redownloads)} re-downloads`} />
          </div>

          <div style={{ ...S.card }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {METRICS.map((m) => (
                <button key={m.k} style={{ ...S.btnGhost, padding: '4px 10px', fontSize: 11,
                  borderColor: metric === m.k ? C.red : C.line, color: metric === m.k ? C.red : C.dim }}
                  onClick={() => setMetric(m.k)}>{m.label}</button>
              ))}
            </div>
            <Chart series={data.series || []} metric={metric} bucket={R.bucket} />
          </div>

          <div style={grid}>
            <BarList title="MOST PLAYED" rows={data.top_plays || []}
              label={(r) => `${r.title || 'Track ' + r.no}${r.album ? ' — ' + r.album : ''}`}
              value={(r) => r.n} sub={(r) => `(${fmtNum(r.u)} people)`} />
            <BarList title="MOST DOWNLOADED" rows={data.top_downloads || []}
              label={(r) => `${r.title || 'Track ' + r.no}${r.album ? ' — ' + r.album : ''}`}
              value={(r) => r.n} sub={(r) => (r.r ? `(+${fmtNum(r.r)} re)` : '')} />
          </div>

          <div style={grid}>
            <BarList title="DOWNLOADS PER RELEASE" rows={data.release_downloads || []}
              label={(r) => r.k || '—'} value={(r) => r.n} sub={(r) => `(${fmtNum(r.u)} people)`} />
            <BarList title="RELEASES OPENED" rows={data.releases_opened || []}
              label={(r) => r.k || '—'} value={(r) => r.n} sub={(r) => `(${fmtNum(r.u)} people)`} />
          </div>

          <div style={grid}>
            <BarList title="SECTIONS" rows={data.sections || []}
              label={(r) => SECTION_LABELS[r.k] || r.k} value={(r) => r.n} sub={(r) => `(${fmtNum(r.u)} people)`} />
            <BarList title="COUNTRIES" rows={data.countries || []}
              label={(r) => countryLabel(r.k)} value={(r) => r.n} />
          </div>

          <div style={grid}>
            <BarList title="DEVICES" rows={data.devices || []}
              label={(r) => r.k.charAt(0).toUpperCase() + r.k.slice(1)} value={(r) => r.n} />
            <BarList title="OPERATING SYSTEMS" rows={data.os || []} label={(r) => r.k} value={(r) => r.n} />
          </div>

          <div style={grid}>
            <BarList title="BROWSERS & APPS" rows={data.browsers || []} label={(r) => r.k} value={(r) => r.n} />
            <BarList title="COMING FROM" rows={data.referrers || []} label={(r) => r.k} value={(r) => r.n}
              empty="Nobody arrived via a link yet — direct visits aren't listed." />
          </div>

          <div style={{ ...S.card }}>
            <div style={{ color: C.red, fontSize: 11, letterSpacing: '0.12em', marginBottom: 10 }}>LIVE FEED</div>
            {!(data.recent || []).length && <div style={{ color: C.dim, fontSize: 11 }}>Nothing yet.</div>}
            {(data.recent || []).map((e, i) => {
              const [what, detail] = eventText(e);
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '64px 130px 1fr auto', gap: 10,
                  fontSize: 11, padding: '4px 0', borderBottom: `1px solid ${C.line}` }}>
                  <span style={{ color: C.dim }}>{new Date(e.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  <span style={{ color: e.type === 'view' ? C.dim : C.red }}>{what}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail}</span>
                  <span style={{ color: C.dim, whiteSpace: 'nowrap' }}>{countryLabel(e.country).split(' ')[0]} {e.device || ''}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div style={{ color: C.dim, fontSize: 10, lineHeight: 1.7, marginTop: 8 }}>
        <label style={{ cursor: 'pointer', color: C.white, fontSize: 11 }}>
          <input type="checkbox" checked={excluded} onChange={(e) => toggleExcluded(e.target.checked)} />
          {' '}Don&apos;t count my visits on this device
        </label>
        <br />
        Visitors are counted per day without cookies and without storing IP addresses —
        someone who comes back tomorrow counts again. Bots and link previews are ignored.
      </div>
    </div>
  );
}

// ── Root ─────────────────────────────────────────────────────────────
export default function Admin() {
  const [pw, setPw] = useState(() => sessionStorage.getItem('cargo_admin_pw') || '');
  const [authed, setAuthed] = useState(false);
  const [data, setData] = useState({ albums: [], tracks: [], gallery: [], site: [], analysedTrackIds: [] });
  const [tab, setTab] = useState('albums');
  const [toastMsg, setToastMsg] = useState('');
  const toast = useCallback((m) => { setToastMsg(m); setTimeout(() => setToastMsg(''), 2600); }, []);

  // Die öffentliche Seite sperrt das Scrollen (overflow:hidden) —
  // im Admin wieder erlauben.
  useEffect(() => {
    document.documentElement.style.overflow = 'auto';
    document.documentElement.style.height = 'auto';
    document.body.style.overflow = 'auto';
    document.body.style.height = 'auto';
    const rootEl = document.getElementById('root');
    if (rootEl) { rootEl.style.overflow = 'visible'; rootEl.style.height = 'auto'; }
  }, []);

  const reload = useCallback(async () => {
    try { const d = await apiCall(pw, 'list'); setData(d); setAuthed(true); }
    catch (e) { if (e.message === 'unauthorized') { setAuthed(false); sessionStorage.removeItem('cargo_admin_pw'); } else toast('Error: ' + e.message); }
  }, [pw, toast]);

  useEffect(() => { if (pw) reload(); }, []); // eslint-disable-line

  // Wer sich hier einloggt, ist der Betreiber — seine eigenen Besuche
  // sollen die Zahlen nicht verfälschen. Nur beim allerersten Mal
  // gesetzt; im Analytics-Reiter lässt es sich wieder abschalten.
  useEffect(() => {
    if (!authed) return;
    try { if (localStorage.getItem(NO_TRACK_KEY) === null) localStorage.setItem(NO_TRACK_KEY, '1'); } catch (e) {}
  }, [authed]);

  if (!supabase) return <div style={S.page}><div style={S.h1}>CARGO — ADMIN</div><div style={{ color: C.red }}>Supabase is not configured (VITE variables are missing).</div></div>;
  if (!authed) return <Login onOk={(p) => { setPw(p); setAuthed(true); apiCall(p, 'list').then(setData).catch(() => {}); }} />;

  return (
    <div style={S.page}>
      <div style={S.row}>
        <div><div style={S.h1}>CARGO — ADMIN</div><div style={S.sub}>Manage content. Changes go live immediately.</div></div>
        <button style={S.btnGhost} onClick={() => { sessionStorage.removeItem('cargo_admin_pw'); setAuthed(false); setPw(''); }}>Log out</button>
      </div>
      <div style={S.tabs}>
        <button style={S.tab(tab === 'albums')} onClick={() => setTab('albums')}>ALBUMS</button>
        <button style={S.tab(tab === 'gallery')} onClick={() => setTab('gallery')}>GALLERY</button>
        <button style={S.tab(tab === 'site')} onClick={() => setTab('site')}>TEXTS</button>
        <button style={S.tab(tab === 'analytics')} onClick={() => setTab('analytics')}>ANALYTICS</button>
        <button style={S.tab(false)} onClick={reload}>↻ reload</button>
      </div>
      {tab === 'albums' && <AlbumsTab pw={pw} data={data} reload={reload} toast={toast} />}
      {tab === 'gallery' && <GalleryTab pw={pw} data={data} reload={reload} toast={toast} />}
      {tab === 'site' && <SiteTab pw={pw} data={data} toast={toast} />}
      {tab === 'analytics' && <AnalyticsTab pw={pw} />}
      {toastMsg && <div style={S.toast}>{toastMsg}</div>}
    </div>
  );
}
