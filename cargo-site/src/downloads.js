// ─────────────────────────────────────────────────────────────
// downloads.js — merkt sich, welche Tracks dieser Besucher bereits
// heruntergeladen hat.
//
// Die Seite hat bewusst keine Benutzerkonten, deshalb liegt der Stand im
// Browser des Besuchers. Folgen: Handy und Laptop führen getrennte
// Librarys, und wer seine Browserdaten löscht, fängt wieder bei null an.
// Ohne Login geht es technisch nicht anders.
//
// Form: { "album-id": [1, 3, 7], ... }  — die Zahlen sind Tracknummern.
// Tracknummern bleiben, was sie sind: Track 7 ist auch in der Library
// Track 7 und wird nie neu durchnummeriert.
// ─────────────────────────────────────────────────────────────

const KEY = 'cargo_downloads_v1';
// Eigener Schlüssel für die Zeitpunkte, damit bereits gespeicherte
// Downloads von früher unverändert weiterfunktionieren.
const TIME_KEY = 'cargo_downloads_at_v1';

let state = read();
let times = readTimes();
const listeners = new Set();

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    // Privater Modus oder gesperrter Speicher: dann eben ohne Gedächtnis.
    return {};
  }
}

function readTimes() {
  try {
    const raw = localStorage.getItem(TIME_KEY);
    const o = raw ? JSON.parse(raw) : null;
    return o && typeof o === 'object' ? o : {};
  } catch (e) {
    return {};
  }
}

function write() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
}

function writeTimes() {
  try { localStorage.setItem(TIME_KEY, JSON.stringify(times)); } catch (e) {}
}

// Zeitpunkt des jüngsten Downloads festhalten — auch bei Re-Downloads,
// denn im Info-Fenster steht „wann zuletzt geladen“.
export function touch(albumId) {
  if (!albumId) return;
  times[albumId] = new Date().toISOString();
  writeTimes();
  emit();
}

// Liefert ein Date oder null. Für Downloads, die es schon vor dieser
// Funktion gab, ist kein Zeitpunkt hinterlegt.
export function lastDownloadAt(albumId) {
  const iso = times[albumId];
  if (!iso) return null;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

function emit() {
  // Neue Objektreferenz, damit React die Änderung bemerkt.
  state = { ...state };
  listeners.forEach((fn) => { try { fn(); } catch (e) {} });
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Für useSyncExternalStore: muss bei unverändertem Stand dasselbe Objekt liefern.
export function getSnapshot() { return state; }

export function isDownloaded(albumId, trackId) {
  const list = state[albumId];
  return Array.isArray(list) && list.includes(trackId);
}

export function downloadedTrackIds(albumId) {
  const list = state[albumId];
  return Array.isArray(list) ? list : [];
}

export function albumHasDownloads(albumId) {
  return downloadedTrackIds(albumId).length > 0;
}

// Sind alle Tracks eines Releases da? Tracks ohne hinterlegte Audiodatei
// zählen nicht mit — sie lassen sich ja gar nicht laden.
export function albumIsComplete(album) {
  if (!album || !album.tracks || !album.tracks.length) return false;
  const loadable = album.tracks.filter((t) => !!t.file);
  if (!loadable.length) return false;
  const have = downloadedTrackIds(album.id);
  return loadable.every((t) => have.includes(t.id));
}

// Liefert true, wenn das Release dadurch NEU in die Library kommt —
// daran hängt, ob das Dankesfenster erscheint.
export function markDownloaded(albumId, trackId) {
  const before = downloadedTrackIds(albumId);
  const isNewAlbum = before.length === 0;
  times[albumId] = new Date().toISOString();
  writeTimes();
  if (before.includes(trackId)) { emit(); return false; }
  state[albumId] = [...before, trackId].sort((a, b) => a - b);
  write();
  emit();
  return isNewAlbum;
}

// Nur für den Notfall gedacht (z. B. später ein „Library leeren“ im Menü).
export function forget(albumId) {
  if (albumId) { delete state[albumId]; delete times[albumId]; } else { state = {}; times = {}; }
  write();
  writeTimes();
  emit();
}
