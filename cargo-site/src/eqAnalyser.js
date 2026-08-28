// ─────────────────────────────────────────────────────────────
// eqAnalyser.js — echter Frequenz-Analyzer (Web Audio API / FFT).
//
// WICHTIG (Hintergrund-Wiedergabe):
// Das echte <audio>-Element des Players wird NIEMALS an einen AudioContext
// gehängt. Sobald man createMediaElementSource() auf ein Element anwendet,
// läuft dessen Ton dauerhaft durch die Web-Audio-Kette — und iOS friert
// Web Audio ein, sobald der Bildschirm gesperrt wird oder Safari in den
// Hintergrund geht. Ergebnis wäre: Sperrbildschirm zeigt den Track, aber
// es kommt kein Ton mehr.
//
// Deshalb analysieren wir ein ZWEITES, lautloses Audio-Element ("Probe"),
// das dieselbe Datei abspielt und dem echten Player hinterherläuft.
// Die Probe hängt an Analyser -> Gain(0) -> Destination:
//   * Gain 0  = absolut lautlos
//   * aber mit Verbindung zur Destination, sonst rendert der Browser den
//     Graphen gar nicht und der Analyser bekäme nur Nullen.
//
// Die Probe wird pausiert, sobald die Seite unsichtbar ist. Im Hintergrund
// läuft dann ausschließlich das echte <audio>-Element — ganz normal, wie
// bei jedem anderen Musik-Player.
//
// Hinweis: funktioniert nur, wenn die Audiodatei CORS-lesbar ist
// (crossOrigin = 'anonymous' + Access-Control-Allow-Origin von R2).
// ─────────────────────────────────────────────────────────────

let ctx = null;
let source = null;
let analyser = null;
let gain = null;
let data = null;

let probe = null;    // zweites, lautloses Element — nur für die Analyse
let player = null;   // das echte <audio> — bleibt unangetastet
let ready = false;
let failed = false;
let timer = 0;

const DRIFT = 0.35;  // Sekunden Abweichung, ab der die Probe nachgezogen wird

// Das echte Player-Element merken. Bewusst KEIN Web-Audio-Anschluss hier.
export function attach(audioEl) {
  player = audioEl;
  if (player) player.crossOrigin = 'anonymous';
}

// Muss nach einer Nutzer-Geste laufen (Klick auf Play) — sonst blockt der
// Browser den AudioContext.
export function start() {
  if (failed || !player) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      ctx = new AC();

      probe = new Audio();
      probe.crossOrigin = 'anonymous';
      probe.preload = 'auto';
      probe.playsInline = true;
      probe.setAttribute('playsinline', '');

      source = ctx.createMediaElementSource(probe);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.86; // flüssige, ruhige Bewegung
      gain = ctx.createGain();
      gain.gain.value = 0;                   // lautlos, aber im Render-Graph

      source.connect(analyser);
      analyser.connect(gain);
      gain.connect(ctx.destination);

      data = new Uint8Array(analyser.frequencyBinCount);
      ready = true;

      document.addEventListener('visibilitychange', onVisibility);
      timer = setInterval(sync, 900);
    }
    if (ctx.state === 'suspended') ctx.resume();
    sync();
  } catch (e) {
    console.warn('[eq] Analyzer nicht verfügbar:', e && e.message);
    failed = true;
    ready = false;
    stopProbe();
  }
}

function stopProbe() {
  try { if (probe) probe.pause(); } catch (e) {}
}

function onVisibility() {
  if (document.hidden) {
    // Seite im Hintergrund / Bildschirm aus: Probe stilllegen, damit das
    // echte Element allein weiterläuft und die Media-Session eindeutig ist.
    stopProbe();
  } else {
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    sync();
  }
}

// Probe an den echten Player angleichen: Quelle, Position, Play/Pause.
export function sync() {
  if (!ready || failed || !player || !probe) return;
  try {
    if (document.hidden) { stopProbe(); return; }

    const url = player.currentSrc || player.getAttribute('src') || '';
    if (!url) { stopProbe(); return; }

    if (probe.src !== url) {
      probe.src = url;
      try { probe.currentTime = player.currentTime || 0; } catch (e) {}
    }

    if (player.paused) { stopProbe(); return; }

    if (Math.abs((probe.currentTime || 0) - (player.currentTime || 0)) > DRIFT) {
      try { probe.currentTime = player.currentTime; } catch (e) {}
    }

    if (probe.paused) {
      const p = probe.play();
      if (p && p.catch) p.catch(() => {});
    }
  } catch (e) {}
}

export function isReady() {
  return ready && !failed && !!analyser && !!data && !document.hidden;
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
