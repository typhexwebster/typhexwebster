// ─────────────────────────────────────────────────────────────
// eqBake.js — Frequenzanalyse im Voraus (läuft NUR im Admin).
//
// Warum überhaupt: Ein Live-Analyzer braucht Web Audio, und Web Audio
// verhindert auf iOS die Hintergrund-Wiedergabe. Also analysieren wir
// jeden Track einmal beim Hochladen und speichern das Ergebnis. Die
// öffentliche Seite liest beim Abspielen nur noch Zahlen aus einer Liste
// — kein AudioContext, kein crossOrigin, keine Rechenlast.
//
// Ergebnis pro Track: FRAMES_PER_SEC Messungen pro Sekunde, je BAND_COUNT
// Frequenzbänder, jeder Wert ein Byte (0..255) — kodiert als Base64.
// Ein Vier-Minuten-Track landet damit bei etwa 100 KB.
//
// Die Bandgrenzen sind so gewählt, dass sich daraus sowohl die 5-Balken-
// als auch die 3-Balken-Anzeige exakt zusammenrechnen lässt (siehe
// eqData.js). 250, 1000, 2000, 4000 und 6000 Hz sind bewusst enthalten.
// ─────────────────────────────────────────────────────────────

export const EQ_FORMAT_VERSION = 1;
export const FRAMES_PER_SEC = 20;
export const FFT_SIZE = 2048;

export const BAND_EDGES = [
  20, 40, 80, 150, 250, 500, 1000, 1500, 2000,
  3000, 4000, 5000, 6000, 8000, 11000, 15000, 20000,
];
export const BAND_COUNT = BAND_EDGES.length - 1; // 16

// Pegel-Fenster in dB, entspricht den Standardwerten des AnalyserNode.
const MIN_DB = -100;
const MAX_DB = -30;

// ── FFT (iterativ, radix-2) ──────────────────────────────────────────
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len;
    const wRe = Math.cos(ang), wIm = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let curRe = 1, curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const aRe = re[i + k], aIm = im[i + k];
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;
        re[i + k] = aRe + bRe; im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe; im[i + k + len / 2] = aIm - bIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

// Hann-Fenster, einmal vorberechnet
function hannWindow(n) {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (n - 1)));
  return w;
}

function toBase64(bytes) {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(s);
}

// ── Hauptfunktion ────────────────────────────────────────────────────
// Nimmt eine Datei oder einen ArrayBuffer und liefert den fertigen
// JSON-String für die Spalte tracks.eq_data.
// onProgress bekommt einen Wert 0..1, damit der Admin einen Balken zeigen kann.
export async function analyseAudio(input, onProgress) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Web Audio is not available in this browser.');

  const buf = input instanceof ArrayBuffer ? input : await input.arrayBuffer();

  // Zum Dekodieren reicht ein kurzlebiger Context. Er wird sofort wieder
  // geschlossen — das hier läuft im Admin, nicht auf der Player-Seite.
  const ctx = new AC();
  let audio;
  try {
    audio = await ctx.decodeAudioData(buf.slice(0));
  } catch (e) {
    try { ctx.close(); } catch (e2) {}
    throw new Error('Could not decode this audio file. Is it a valid AAC/MP3 file?');
  }
  try { ctx.close(); } catch (e) {}

  const rate = audio.sampleRate;
  const chCount = Math.min(2, audio.numberOfChannels);
  const chans = [];
  for (let c = 0; c < chCount; c++) chans.push(audio.getChannelData(c));
  const len = audio.length;

  const hop = Math.max(1, Math.round(rate / FRAMES_PER_SEC));
  const frames = Math.max(1, Math.floor(len / hop));
  const win = hannWindow(FFT_SIZE);

  // Bin-Grenzen je Band einmal vorberechnen
  const nyquist = rate / 2;
  const bins = FFT_SIZE / 2;
  const bandBins = [];
  for (let b = 0; b < BAND_COUNT; b++) {
    const i0 = Math.max(0, Math.floor((BAND_EDGES[b] / nyquist) * bins));
    const i1 = Math.min(bins - 1, Math.ceil((BAND_EDGES[b + 1] / nyquist) * bins));
    bandBins.push([i0, Math.max(i0, i1)]);
  }

  const out = new Uint8Array(frames * BAND_COUNT);
  const re = new Float64Array(FFT_SIZE);
  const im = new Float64Array(FFT_SIZE);
  // Normalisierung: Hann halbiert die Amplitude, FFT skaliert mit N/2.
  const norm = 1 / (FFT_SIZE * 0.25);

  for (let f = 0; f < frames; f++) {
    const start = f * hop;
    for (let i = 0; i < FFT_SIZE; i++) {
      const idx = start + i;
      let s = 0;
      if (idx < len) {
        for (let c = 0; c < chCount; c++) s += chans[c][idx];
        s /= chCount;
      }
      re[i] = s * win[i];
      im[i] = 0;
    }
    fft(re, im);

    for (let b = 0; b < BAND_COUNT; b++) {
      const [i0, i1] = bandBins[b];
      // Wichtig: erst jeden Bin einzeln in dB und auf 0..255 umrechnen,
      // dann mitteln — genau in dieser Reihenfolge arbeitet auch der
      // AnalyserNode der Web Audio API. Andersherum (Beträge mitteln und
      // erst danach in dB) überstrahlt ein einzelner lauter Bin das ganze
      // Band, und der Balken klebt dauerhaft am Anschlag.
      let sum = 0, cnt = 0;
      for (let i = i0; i <= i1; i++) {
        const mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]) * norm;
        const db = mag > 0 ? 20 * Math.log10(mag) : MIN_DB;
        let v = 255 * (db - MIN_DB) / (MAX_DB - MIN_DB);
        if (v < 0) v = 0; else if (v > 255) v = 255;
        sum += v; cnt++;
      }
      out[f * BAND_COUNT + b] = cnt ? Math.round(sum / cnt) : 0;
    }

    // Alle ~40 Frames kurz Luft holen, damit der Browser nicht einfriert
    if (onProgress && (f % 40 === 0)) {
      onProgress(f / frames);
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  if (onProgress) onProgress(1);

  return JSON.stringify({
    v: EQ_FORMAT_VERSION,
    fps: FRAMES_PER_SEC,
    n: BAND_COUNT,
    dur: Math.round(audio.duration * 100) / 100,
    d: toBase64(out),
  });
}

// Sekundengenaue Laufzeit als "M:SS" — praktisch, um im Admin gleich die
// echte Dauer eintragen zu können statt sie zu tippen.
export function formatDuration(seconds) {
  const s = Math.round(seconds || 0);
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
