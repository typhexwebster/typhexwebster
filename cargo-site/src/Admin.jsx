import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './supabaseClient.js';
import { analyseAudio, formatDuration } from './eqBake.js';

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

// ── Album editor ─────────────────────────────────────────────────────
function AlbumEditor({ pw, album, tracks, analysedIds, onClose, onSaved, toast }) {
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
        download_format: a.download_format || 'M4A (AAC)',
        in_library: !!a.in_library, published: a.published !== false,
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
        <label style={{ color: C.dim, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!a.in_library} onChange={(e) => set('in_library', e.target.checked)} /> in “YOUR LIBRARY”
        </label>
      </div>

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
                  <div style={{ color: C.dim, fontSize: 11 }}>{al.artist} · {n} tracks · {al.year || '—'}{al.in_library ? ' · LIBRARY' : ''}</div>
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
function SiteTab({ pw, data, reload, toast }) {
  const [rows, setRows] = useState(data.site || []);
  const [nk, setNk] = useState(''); const [nv, setNv] = useState('');
  useEffect(() => setRows(data.site || []), [data.site]);
  const save = async (key, value) => {
    try { await apiCall(pw, 'saveSite', { key, value }); toast('Saved ✓'); }
    catch (e) { toast('Error: ' + e.message); }
  };
  return (
    <div>
      <div style={S.sub}>Free-form text blocks (for example for the landing page). The site reads them by their key.</div>
      {rows.map((r, i) => (
        <div key={r.key} style={S.card}>
          <div style={{ color: C.red, fontSize: 12, marginBottom: 4 }}>{r.key}</div>
          <textarea style={S.ta} value={r.value || ''} onChange={(e) => setRows((p) => p.map((x, idx) => idx === i ? { ...x, value: e.target.value } : x))} />
          <button style={{ ...S.btn, marginTop: 8 }} onClick={() => save(r.key, rows[i].value)}>save</button>
        </div>
      ))}
      <div style={S.card}>
        <div style={{ color: C.red, fontSize: 12, marginBottom: 8 }}>NEW TEXT</div>
        <div style={S.grid2}>
          <Field label="Key" value={nk} onChange={setNk} placeholder="hero_title" />
        </div>
        <Field label="Value" value={nv} onChange={setNv} textarea />
        <button style={{ ...S.btn, marginTop: 8 }} onClick={async () => { if (!nk) return; await save(nk, nv); setNk(''); setNv(''); reload(); }}>add</button>
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
        <button style={S.tab(false)} onClick={reload}>↻ reload</button>
      </div>
      {tab === 'albums' && <AlbumsTab pw={pw} data={data} reload={reload} toast={toast} />}
      {tab === 'gallery' && <GalleryTab pw={pw} data={data} reload={reload} toast={toast} />}
      {tab === 'site' && <SiteTab pw={pw} data={data} reload={reload} toast={toast} />}
      {toastMsg && <div style={S.toast}>{toastMsg}</div>}
    </div>
  );
}
