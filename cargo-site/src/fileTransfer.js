// ─────────────────────────────────────────────────────────────
// fileTransfer.js — Dateien mit Fortschritt laden, als Archiv bündeln
// und im Browser speichern.
//
// Bewusst ohne Zusatzbibliothek: Das Archiv legt die Dateien nur
// nebeneinander ab, ohne sie nochmal zu komprimieren. Bei bereits
// komprimiertem Audio bringt Packen praktisch nichts, kostet aber Zeit
// und Rechenleistung auf dem Handy.
// ─────────────────────────────────────────────────────────────

// ── Laden mit Fortschritt ────────────────────────────────────────────
// onProgress bekommt 0..1, solange die Gesamtgröße bekannt ist.
// Ist sie es nicht (kein Content-Length), kommt null — der Aufrufer
// zeigt dann eben keinen Balken.
export async function fetchWithProgress(url, onProgress) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Download fehlgeschlagen (' + res.status + ')');

  const total = Number(res.headers.get('content-length')) || 0;

  // Ohne lesbaren Datenstrom (sehr alte Browser) einfach am Stück holen.
  if (!res.body || !res.body.getReader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (onProgress) onProgress(1);
    return buf;
  }

  const reader = res.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    if (onProgress) onProgress(total ? Math.min(1, received / total) : null);
  }
  const out = new Uint8Array(received);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  if (onProgress) onProgress(1);
  return out;
}

// ── Speichern ────────────────────────────────────────────────────────
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Dateinamen entschärfen: keine Schrägstriche, keine Steuerzeichen.
export function safeFilename(name, fallback = 'track') {
  const clean = String(name || '')
    .replace(/[\\/:*?"<>|]/g, '')          // in Dateinamen nicht erlaubt
    .replace(/[\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return clean || fallback;
}

// ── Minimaler ZIP-Schreiber (nur „gespeichert“, ohne Kompression) ────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function dosDateTime(d) {
  const time = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
  const date = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);
  return { time, date };
}

// files: [{ name: 'Song.m4a', bytes: Uint8Array }]
export function makeZip(files) {
  const enc = new TextEncoder();
  const now = dosDateTime(new Date());
  const parts = [];
  const central = [];
  let offset = 0;

  for (const f of files) {
    const nameBytes = enc.encode(f.name);
    const crc = crc32(f.bytes);
    const size = f.bytes.length;

    const local = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);   // Signatur
    lv.setUint16(4, 20, true);           // benötigte Version
    lv.setUint16(6, 0x0800, true);       // Flag: Dateiname ist UTF-8
    lv.setUint16(8, 0, true);            // Methode 0 = nur gespeichert
    lv.setUint16(10, now.time, true);
    lv.setUint16(12, now.date, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, size, true);
    lv.setUint32(22, size, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, 0, true);
    local.set(nameBytes, 30);

    parts.push(local, f.bytes);

    const cen = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint16(12, now.time, true);
    cv.setUint16(14, now.date, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, size, true);
    cv.setUint32(24, size, true);
    cv.setUint16(28, nameBytes.length, true);
    cv.setUint32(42, offset, true);      // Position des lokalen Kopfes
    cen.set(nameBytes, 46);
    central.push(cen);

    offset += local.length + size;
  }

  const centralSize = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

// Endung aus einer URL raten, ohne Query-Anhängsel.
export function extensionFromUrl(url, fallback = 'm4a') {
  const clean = String(url || '').split('?')[0];
  const dot = clean.lastIndexOf('.');
  if (dot < 0) return fallback;
  const ext = clean.slice(dot + 1).toLowerCase();
  return /^[a-z0-9]{2,4}$/.test(ext) ? ext : fallback;
}
