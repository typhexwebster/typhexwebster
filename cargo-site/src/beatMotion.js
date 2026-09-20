// ─────────────────────────────────────────────────────────────
// beatMotion.js — die vorberechnete Bewegungskurve des CARGO-Beats.
//
// WARUM VORBERECHNET: Auf der öffentlichen Seite darf kein Web Audio
// laufen. Ein aktiver AudioContext lässt iOS die Audio-Session der ganzen
// Seite als Web-Audio-Session einstufen, und die wird stummgeschaltet,
// sobald der Bildschirm gesperrt wird — genau der Fehler, der die
// Hintergrund-Wiedergabe wochenlang lahmgelegt hat. Deshalb wurde der Beat
// einmal vorab analysiert; hier werden nur noch Zahlen abgelesen.
//
// Vier Kanäle, 30 Messungen pro Sekunde:
//   anschlag — nur die Zunahme der Bassenergie, also der eigentliche
//              Schlag. Treibt das Hüpfen nach vorne.
//   bass     — Pegel der Tiefen, treibt den Schein dahinter.
//   mitten   — Pegel der Mitten, variiert das Tempo der Ringe.
//   hoehen   — Pegel der Höhen, treibt das Flirren der Lichter.
// ─────────────────────────────────────────────────────────────

const URL_MOTION = '/uploads/cargo-beat-motion.json';

let frames = null;   // Uint8Array, frames * 4
let count = 0;
let fps = 30;
let loading = null;

export const CHANNELS = { ATTACK: 0, BASS: 1, MID: 2, HIGH: 3 };

function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// Wird erst beim ersten Antippen geladen, nicht beim Seitenstart.
export function load() {
  if (frames || loading) return loading || Promise.resolve(true);
  loading = fetch(URL_MOTION).
  then((r) => r.json()).
  then((o) => {
    if (!o || !o.d || o.n !== 4) return false;
    const bytes = fromBase64(o.d);
    count = Math.floor(bytes.length / 4);
    if (!count) return false;
    frames = bytes;
    fps = o.fps || 30;
    return true;
  }).
  catch(() => false);
  return loading;
}

export function ready() { return !!frames && count > 0; }

// Gemeinsamer Zustand: Die Platte schreibt ihn jedes Bild, die Lichter im
// Hintergrund lesen ihn. Bewusst ein einfaches Objekt statt React-State —
// sonst würde die halbe Seite 60-mal pro Sekunde neu rendern.
export const pulse = {
  energy: 0,   // 0 = aus, 1 = voll an (blendet weich über)
  attack: 0,   // Schlag-Hüllkurve, schnell hoch, langsam runter
  bass: 0,
  mid: 0,
  high: 0
};

// Alle vier Werte zum Zeitpunkt `time` (Sekunden), linear überblendet.
// `out` kann wiederverwendet werden, damit pro Bild nichts neu entsteht.
export function sample(time, out) {
  const r = out || [0, 0, 0, 0];
  if (!frames) { r[0] = r[1] = r[2] = r[3] = 0; return r; }
  const pos = Math.max(0, (time || 0) * fps);
  let f0 = Math.floor(pos) % count;
  let f1 = (f0 + 1) % count;
  const t = pos - Math.floor(pos);
  const o0 = f0 * 4, o1 = f1 * 4;
  for (let i = 0; i < 4; i++) {
    const a = frames[o0 + i], b = frames[o1 + i];
    r[i] = (a + (b - a) * t) / 255;
  }
  return r;
}
