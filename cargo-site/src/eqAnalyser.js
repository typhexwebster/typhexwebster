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
// welches Element den Ton erzeugt. Auf diesen Geräten darf also gar kein
// Graph entstehen.
//
// Deshalb zwei klar getrennte Wege:
//
//   Handy / Safari  ->  Es passiert hier NICHTS. Kein AudioContext, kein
//                       crossOrigin, keine Verbindung zum Ausgang. Das
//                       <audio> bleibt ein ganz normales <audio> und darf
//                       im Hintergrund weiterspielen wie jeder andere
//                       Musik-Player. Die EQ-Balken laufen dort auf ihrer
//                       CSS-Animation (Keyframes in index.css).
//
//   Desktop         ->  Der Player hängt direkt im Graphen und wird live
//                       analysiert. Chrome und Firefox lassen den Audio-
//                       Context im Hintergrund weiterlaufen, hier gibt es
//                       das Sperrbildschirm-Problem nicht.
//
// Bewusst KEIN zweites Element mehr für die Analyse: Zwei parallele
// Anfragen auf dieselbe Audiodatei blockieren sich in Chrome gegenseitig
// über den Cache-Lock — der Player wartet dann darauf, dass die Analyse-
// Kopie fertig geladen ist, und die Musik startet verzögert oder gar nicht.
//
// Zum Testen lässt sich die Automatik per URL überschreiben:
//   ?eq=off  -> Analyzer aus, auch am Desktop
//   ?eq=on   -> Analyzer an, auch auf dem Handy (NUR zum Gegentesten!)
// ─────────────────────────────────────────────────────────────

let ctx = null;
let source = null;
let analyser = null;
let data = null;
let el = null;
let ready = false;
let allowed = null;  // Cache für die Geräte-Entscheidung

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

// Das <audio>-Element merken.
// crossOrigin wird NUR gesetzt, wenn wirklich analysiert wird — sonst soll
// das Playback ein ganz normaler Media-Request bleiben. Muss vor dem ersten
// src passieren, deshalb schon hier und nicht erst in start().
export function attach(audioEl) {
  el = audioEl;
  if (el && webAudioAllowed()) el.crossOrigin = 'anonymous';
}

// Muss nach einer Nutzer-Geste laufen (Klick auf Play) — sonst blockt der
// Browser den AudioContext. Auf Mobilgeräten passiert hier gar nichts.
export function start() {
  if (!webAudioAllowed() || !el) return;
  try {
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
