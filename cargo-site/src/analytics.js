// ─────────────────────────────────────────────────────────────
// analytics.js — meldet Seitenaufrufe, Abspielen und Downloads an
// /api/track. Wird im Admin-Dashboard ausgewertet.
//
// Alles läuft im Hintergrund: Keine Meldung hält die Seite auf, und
// scheitert eine, merkt der Besucher nichts davon.
// ─────────────────────────────────────────────────────────────

// Gesetzt = dieses Gerät wird nicht mitgezählt. Schaltet der Admin.
export const NO_TRACK_KEY = 'cargo_no_track';

function disabled() {
  if (import.meta.env.DEV) return true; // lokale Entwicklung zählt nie
  try { return localStorage.getItem(NO_TRACK_KEY) === '1'; } catch (e) { return false; }
}

// Handy, Tablet oder Computer. Das iPad gibt sich als Mac aus — erkennbar
// ist es nur daran, dass ein Mac keinen Touchscreen hat.
function device() {
  const ua = navigator.userAgent || '';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return 'tablet';
  if (/Mobi|iPhone|iPod|Android/.test(ua)) return 'mobile';
  return 'desktop';
}

// Woher der Besuch kam — nur einmal pro Seitenladen, nur der Domainname,
// und nie die eigene Seite.
let referrerSent = false;
function referrerOnce() {
  if (referrerSent) return null;
  referrerSent = true;
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname.replace(/^www\./, '');
    if (!host || host === location.hostname.replace(/^www\./, '')) return null;
    return host;
  } catch (e) {
    return null;
  }
}

function send(payload) {
  if (disabled()) return;
  const body = JSON.stringify({ ...payload, d: device() });
  try {
    // sendBeacon kommt auch dann noch an, wenn die Seite gerade schließt.
    if (navigator.sendBeacon && navigator.sendBeacon('/api/track', new Blob([body], { type: 'text/plain' }))) return;
  } catch (e) {}
  try {
    fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {});
  } catch (e) {}
}

export function trackView(section, album) {
  send({
    t: 'view',
    s: section,
    a: album ? album.id : undefined,
    at: album ? album.title : undefined,
    ref: referrerOnce(),
  });
}

export function trackPlay(album, track, section) {
  if (!album || !track) return;
  send({ t: 'play', s: section, a: album.id, at: album.title, n: track.id, tt: track.title });
}

export function trackDownload(album, track, redownload = false) {
  if (!album || !track) return;
  send({ t: 'download', a: album.id, at: album.title, n: track.id, tt: track.title, r: !!redownload });
}
