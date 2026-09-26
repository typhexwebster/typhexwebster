// ─────────────────────────────────────────────────────────────
// imageLoader.js — Bilder selbst laden, um den Fortschritt zu kennen.
//
// Ein normales <img> verrät nichts über seinen Ladestand: Es ist entweder
// noch nicht da oder fertig. Für einen Fortschrittsring muss das Bild
// deshalb in Häppchen geholt und danach aus den Bytes zusammengesetzt
// werden — genau wie bei den Tracks.
//
// Das setzt voraus, dass der Speicher solche Abfragen von unserer Domain
// aus erlaubt. Tut er das nicht, wirft der Versuch, und der Aufrufer fällt
// auf ein ganz normales <img> zurück. Ein Bild darf dadurch nie ausbleiben.
//
// Einmal geladene Bilder bleiben gemerkt: Ein Cover taucht in der
// Musikübersicht, in der Albumansicht und in der Library auf — geladen
// wird es trotzdem nur einmal.
// ─────────────────────────────────────────────────────────────
import { fetchWithProgress } from './fileTransfer.js';

const fertig = new Map();     // Quelle -> Objekt-URL
const laufend = new Map();    // Quelle -> Versprechen
let erlaubt = null;           // null = unbekannt, false = Speicher blockt

// Liegt das Bild schon bereit? Dann kein Ring, kein Flackern.
export function cached(src) {
  return src && fertig.has(src) ? fertig.get(src) : null;
}

// Hat sich der Speicher schon einmal verweigert, sparen wir uns weitere
// Versuche und gehen für den Rest des Besuchs direkt den normalen Weg.
export function blocked() { return erlaubt === false; }

export function load(src, onProgress) {
  if (!src) return Promise.reject(new Error('keine Quelle'));
  if (fertig.has(src)) return Promise.resolve(fertig.get(src));
  if (laufend.has(src)) return laufend.get(src);
  if (erlaubt === false) return Promise.reject(new Error('Selbstladen nicht möglich'));

  let typ = '';
  const p = fetchWithProgress(src, onProgress, (t) => { typ = t; }).
  then((bytes) => {
    const blob = new Blob([bytes], { type: typ || 'image/jpeg' });
    const url = URL.createObjectURL(blob);
    fertig.set(src, url);
    laufend.delete(src);
    erlaubt = true;
    return url;
  }).
  catch((err) => {
    laufend.delete(src);
    // Beim allerersten Fehlschlag merken, dass es nicht geht.
    if (erlaubt === null) erlaubt = false;
    throw err;
  });

  laufend.set(src, p);
  return p;
}
