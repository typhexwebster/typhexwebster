// ─────────────────────────────────────────────────────────────
// eqAnalyser.js — echter Frequenz-Analyzer (Web Audio API / FFT).
// Liest die Lautstärke je Frequenzband aus dem laufenden Audio.
// Hinweis: funktioniert nur, wenn die Audiodatei CORS-lesbar ist
// (audio.crossOrigin = 'anonymous' + Access-Control-Allow-Origin von R2).
// ─────────────────────────────────────────────────────────────
let ctx = null;
let source = null;
let analyser = null;
let data = null;
let el = null;
let ready = false;

export function attach(audioEl) {
  el = audioEl;
  if (el) el.crossOrigin = 'anonymous';
}

// Muss nach einer Nutzer-Geste laufen (Klick auf Play) — sonst blockt der Browser den AudioContext.
export function start() {
  try {
    if (!el) return;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      source = ctx.createMediaElementSource(el);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.86; // flüssige, ruhige Bewegung
      data = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      analyser.connect(ctx.destination);
      ready = true;
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch (e) {
    console.warn('[eq] Analyzer nicht verfügbar:', e && e.message);
    ready = false;
  }
}

export function isReady() {
  return ready && !!analyser && !!data;
}

// Liefert je Frequenzband (definiert über die Grenzen in Hz) einen Pegel 0..1.
// edges = [20, 250, 1000, ...] -> Bänder [20-250], [250-1000], ...
export function levels(edges) {
  const n = edges.length - 1;
  if (!isReady()) return new Array(n).fill(0);
  analyser.getByteFrequencyData(data);
  const nyquist = ctx.sampleRate / 2;
  const bins = data.length;
  const out = new Array(n);
  for (let b = 0; b < n; b++) {
    let i0 = Math.max(0, Math.floor((edges[b] / nyquist) * bins));
    let i1 = Math.min(bins - 1, Math.ceil((edges[b + 1] / nyquist) * bins));
    let sum = 0, cnt = 0;
    for (let i = i0; i <= i1; i++) { sum += data[i]; cnt++; }
    out[b] = cnt ? sum / cnt / 255 : 0;
  }
  return out;
}
