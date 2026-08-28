// ─────────────────────────────────────────────────────────────
// eqData.js — liest die im Admin vorberechneten Frequenzdaten.
//
// Kein Web Audio, kein AudioContext, kein crossOrigin. Die Balken holen
// sich pro Bild einfach den Wert, der zur aktuellen Wiedergabezeit gehört.
// Deshalb läuft der EQ auf jedem Gerät gleich — auch auf dem iPhone, wo
// ein Live-Analyzer die Hintergrund-Wiedergabe zerstören würde.
//
// Zwischen zwei gespeicherten Messungen wird linear überblendet, damit es
// flüssig statt stufig wirkt. Die Glättung darüber macht die jeweilige
// Komponente in App.jsx.
// ─────────────────────────────────────────────────────────────

// Muss zu eqBake.js passen.
const BAND_EDGES = [
  20, 40, 80, 150, 250, 500, 1000, 1500, 2000,
  3000, 4000, 5000, 6000, 8000, 11000, 15000, 20000,
];
const BAND_COUNT = BAND_EDGES.length - 1;

// Welche gespeicherten Bänder gehören zu welchem Balken?
// 5 Balken: Bass | untere Mitten | Mitten | obere Mitten | Höhen
const VIEW_5 = [[0, 3], [4, 5], [6, 7], [8, 11], [12, 15]];
// 3 Balken: Bass | Mitten | Höhen
const VIEW_3 = [[0, 3], [4, 9], [10, 15]];

// Gewichte nach linearer Bandbreite — so entsteht derselbe Mittelwert,
// den ein Live-Analyzer über seine FFT-Bins bilden würde.
function buildWeights(view) {
  return view.map(([a, b]) => {
    const w = [];
    let total = 0;
    for (let i = a; i <= b; i++) { const width = BAND_EDGES[i + 1] - BAND_EDGES[i]; w.push(width); total += width; }
    return { from: a, w, total };
  });
}
const W5 = buildWeights(VIEW_5);
const W3 = buildWeights(VIEW_3);

let frames = null;   // Uint8Array, frames * BAND_COUNT
let frameCount = 0;
let fps = 20;

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Datensatz eines Tracks laden. null/leer -> EQ fällt auf die CSS-Animation zurück.
export function setTrack(json) {
  frames = null; frameCount = 0;
  if (!json) return false;
  try {
    const o = typeof json === 'string' ? JSON.parse(json) : json;
    if (!o || !o.d || o.n !== BAND_COUNT) return false;
    const bytes = fromBase64(o.d);
    frameCount = Math.floor(bytes.length / BAND_COUNT);
    if (!frameCount) return false;
    frames = bytes;
    fps = o.fps || 20;
    return true;
  } catch (e) {
    return false;
  }
}

export function clear() { frames = null; frameCount = 0; }

export function hasData() { return !!frames && frameCount > 0; }

// Pegel 0..1 je Balken zum Zeitpunkt `time` (Sekunden).
// count = 5 oder 3.
export function levelsAt(time, count) {
  const groups = count === 3 ? W3 : W5;
  const out = new Array(groups.length).fill(0);
  if (!frames || !frameCount) return out;

  const pos = Math.max(0, (time || 0) * fps);
  let f0 = Math.floor(pos);
  if (f0 > frameCount - 1) f0 = frameCount - 1;
  let f1 = f0 + 1;
  if (f1 > frameCount - 1) f1 = frameCount - 1;
  const t = pos - Math.floor(pos);

  const o0 = f0 * BAND_COUNT;
  const o1 = f1 * BAND_COUNT;

  for (let g = 0; g < groups.length; g++) {
    const { from, w, total } = groups[g];
    let sum = 0;
    for (let i = 0; i < w.length; i++) {
      const idx = from + i;
      const a = frames[o0 + idx];
      const b = frames[o1 + idx];
      sum += (a + (b - a) * t) * w[i];
    }
    out[g] = total ? sum / total / 255 : 0;
  }
  return out;
}
