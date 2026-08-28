// ─────────────────────────────────────────────────────────────
// eqAnalyser.js — echter Frequenz-Analyzer (Web Audio API / FFT).
//
// ═══ REGEL NUMMER EINS ═══
// Die Wiedergabe hat Vorrang vor dem EQ. Immer.
//
// Warum: Auf iOS schließen sich Web Audio und Hintergrund-Wiedergabe aus.
// Sobald eine Seite einen aktiven AudioContext mit Verbindung zum Ausgang
// hat, behandelt iOS die Audio-Session der GANZEN Seite als Web-Audio-
// Session — und die wird stummgeschaltet, sobald der Bildschirm gesperrt
// wird oder Safari in den Hintergrund geht. Das gilt unabhängig davon,
// welches Element den Ton tatsächlich erzeugt. Es genügt also nicht, das
// Player-Element aus dem Graphen herauszuhalten; der Graph darf auf diesen
// Geräten gar nicht erst existieren.
//
// Deshalb: Auf Touch-Geräten und in Safari wird hier NICHTS angelegt —
// kein AudioContext, kein zweites Element, keine Verbindung zum Ausgang.
// Das <audio>-Element des Players bleibt ein ganz normales <audio>-Element
// und verhält sich wie jeder andere Musik-Player: Bildschirm aus, App im
// Hintergrund, Sperrbildschirm-Steuerung — alles läuft weiter.
//
// Die EQ-Balken fallen dort auf ihre CSS-Animation zurück (Keyframes
// `eqAnim` / `eqMini` in index.css). Sie bewegen sich also weiterhin,
// nur eben nicht im Takt der Musik.
//
// Am Desktop (Chrome/Firefox, kein Touch) läuft der echte Analyzer über
// ein zweites, lautloses Element. Dort gibt es kein Sperrbildschirm-
// Problem, also kostet es nichts.
//
// Zum Testen lässt sich die Automatik per URL überschreiben:
//   ?eq=off  -> Analyzer aus, auch am Desktop
//   ?eq=on   -> Analyzer an, auch auf dem Handy (NUR zum Gegentesten!)
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
let allowed = null;  // Cache für die Geräte-Entscheidung

const DRIFT = 0.35;  // Sekunden Abweichung, ab der die Probe nachgezogen wird

// Darf auf diesem Gerät überhaupt ein AudioContext entstehen?
function webAudioAllowed() {
  if (allowed !== null) return allowed;
  allowed = false;
  try {
    // Manueller Schalter zum Gegentesten
    const q = new URLSearchParams(window.location.search).get('eq');
    if (q === 'off') return (allowed = false);
    if (q === 'on') return (allowed = true);

    // Touch-Gerät -> iPhone, iPad, Android. Hier niemals Web Audio.
    // (iPadOS meldet sich als Mac, wird aber über maxTouchPoints erkannt.)
    const touch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
    if (touch) return (allowed = false);

    // Safari friert den AudioContext auch am Mac ein, sobald das Fenster
    // in den Hintergrund geht (WebKit-Bug 231105). Also ebenfalls aus.
    const ua = navigator.userAgent || '';
    const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|Edg|OPR|Firefox/.test(ua);
    if (isSafari) return (allowed = false);

    allowed = true;
  } catch (e) {
    allowed = false;
  }
  return allowed;
}

export function isEnabled() {
  return webAudioAllowed();
}

// Das echte Player-Element merken.
// Bewusst KEIN Web-Audio-Anschluss und bewusst KEIN crossOrigin: Das
// Playback soll ein ganz normaler Media-Request bleiben.
export function attach(audioEl) {
  player = audioEl;
}

// Muss nach einer Nutzer-Geste laufen (Klick auf Play) — sonst blockt der
// Browser den AudioContext. Auf Mobilgeräten passiert hier gar nichts.
export function start() {
  if (!webAudioAllowed() || failed || !player) return;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;

      ctx = new AC();

      probe = new Audio();
      probe.crossOrigin = 'anonymous';
      probe.preload = 'auto';

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
// Ohne Analyzer kommen Nullen zurück; die Balken behalten dann ihre
// CSS-Animation, weil App.jsx sie in dem Fall nicht überschreibt.
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
