import React from 'react';
import ReactDOM from 'react-dom';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle,
  TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton
} from './tweaks-panel.jsx';
// LIBRARY_IDS (das Admin-Häkchen) wird bewusst nicht mehr importiert:
// Die Library speist sich jetzt ausschließlich aus den Downloads des
// Besuchers. Das Häkchen im Admin bleibt vorerst stehen, wirkt aber nicht.
import { ALBUMS, COVER_IMAGES, GALLERY, SITE, loadTrackEq } from './content.js';
import * as eqData from './eqData.js';
import * as downloads from './downloads.js';
import * as beatMotion from './beatMotion.js';
import { siteText } from './siteTexts.js';
import * as imageLoader from './imageLoader.js';
import { fetchWithProgress, saveBlob, makeZip, safeFilename, extensionFromUrl } from './fileTransfer.js';



const { useState, useEffect, useRef, useCallback, useSyncExternalStore } = React;

// Bequemer Zugriff auf den Download-Stand. Jede Komponente, die das hier
// benutzt, rendert automatisch neu, sobald ein Download fertig wird.
function useDownloads() {
  return useSyncExternalStore(downloads.subscribe, downloads.getSnapshot, downloads.getSnapshot);
}

// Alle Tracks der Seite haben dasselbe Format, deshalb steht es einmal
// hier statt in der Datenbank. Falls du später anders exportierst, ist das
// die einzige Stelle, die geändert werden muss.
const DOWNLOAD_FORMAT = 'M4A (AAC / 256 kbit/s)';

// „16 June 2026, 14:32“ — bewusst von Hand gesetzt, damit das Format
// unabhängig von der Spracheinstellung des Geräts immer gleich aussieht.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
'July', 'August', 'September', 'October', 'November', 'December'];
function formatDownloadDate(d) {
  if (!d) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Das laufende <audio>-Element auf Modulebene, damit die EQ-Balken die
// Wiedergabezeit pro Bild direkt ablesen können, ohne dass dafür jedes
// Mal React neu rendert. Wird unten in App gesetzt.
let playbackEl = null;

// ─── DATA ───────────────────────────────────────────────────────────
// ALBUMS -> aus content.js (Supabase)

// Albums the user has downloaded (shown in YOUR LIBRARY).
// LIBRARY_IDS -> aus content.js


// ─── ICONS ──────────────────────────────────────────────────────────

// Centre logo: real camel figurine photo
const CamelLogo = () =>
<img
  src="/uploads/juma.png"
  alt="CARGO"
  draggable={false}
  onDragStart={(e) => e.preventDefault()}
  onContextMenu={(e) => e.preventDefault()}
  style={{
    height: 130,
    width: 'auto',
    display: 'block',
    objectFit: 'contain'
  }} />;



// Right-side icon: two overlapping rounded rectangles (CARGO brand mark)
const CargoMarkIcon = () =>
<svg viewBox="0 0 56 42" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 48, height: 36, transform: 'scaleX(-1)' }}>
        <rect x="2" y="2" width="36" height="24" rx="6" stroke="var(--red)" strokeWidth="1.8" fill="none" />
        <rect x="18" y="16" width="36" height="24" rx="6" stroke="var(--red)" strokeWidth="1.8" fill="none" />
      </svg>;


// Häkchen für fertige Downloads.
const CheckIcon = () =>
<svg viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12.5l5.5 5.5L20 6.5" />
      </svg>;

// Ring, der sich im Uhrzeigersinn füllt — zeigt den echten Ladefortschritt
// eines einzelnen Tracks. Der graue Ring dahinter bleibt immer sichtbar,
// damit der Knopf nicht leer wirkt, solange noch nichts geladen ist.
const ProgressRing = ({ value = 0 }) => {
  const r = 9.25;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value || 0));
  return (
    <svg viewBox="0 0 24 24" fill="none" className="dl-ring">
          <circle cx="12" cy="12" r={r} className="dl-ring-track" />
          <circle
        cx="12" cy="12" r={r}
        className="dl-ring-value"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - v)}
        strokeLinecap="round" />
        </svg>);


};

// Sich drehender Pfeilbogen für den großen Knopf. Bewusst ohne
// Fortschrittsanzeige — den echten Fortschritt sieht man an den
// einzelnen Tracks darunter.
// Maße nach der Photoshop-Vorlage: Das Koordinatensystem ist exakt so groß
// wie der Knopf (44), der Bogen misst 27 im Durchmesser und lässt oben
// links eine Lücke von 90°, an der die Pfeilspitze sitzt.
const SpinnerArc = () =>
<svg viewBox="0 0 44 44" fill="none" className="dl-spin" strokeLinecap="round" strokeLinejoin="round">
        <path d="M28.75 10.31 A13.5 13.5 0 1 1 10.31 15.25" />
        <path d="M6.55 16.62 L10.31 15.25 L11.01 19.19" />
      </svg>;

const DownloadIcon = () =>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M12 3v13M7 11l5 5 5-5M4 20h16" />
      </svg>;


const PlayIcon = () =>
<svg viewBox="0 0 24 24" fill="currentColor">
        <polygon points="5,3 19,12 5,21" />
      </svg>;


const PauseIcon = () =>
<svg viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>;


const PrevIcon = () =>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="19,5 9,12 19,19" fill="currentColor" stroke="none" />
        <line x1="5" y1="5" x2="5" y2="19" stroke="currentColor" strokeWidth="2" />
      </svg>;


const NextIcon = () =>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <polygon points="5,5 15,12 5,19" fill="currentColor" stroke="none" />
        <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth="2" />
      </svg>;


// Player: double-chevron prev / next — same height as the play button
const PrevDouble = () =>
<svg viewBox="0 0 22 26" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17,3 8,13 17,23" />
        <polyline points="10,3 1,13 10,23" />
      </svg>;

const NextDouble = () =>
<svg viewBox="0 0 22 26" fill="none" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="5,3 14,13 5,23" />
        <polyline points="12,3 21,13 12,23" />
      </svg>;

// Player: thin outline play / pause (matching the supplied SVG glyphs)
const PlayThin = () =>
<svg className="play-glyph" viewBox="0 0 24 24" fill="none" strokeWidth="2.1" strokeLinejoin="round">
        <polygon points="7,6 17,12 7,18" />
      </svg>;

const PauseThin = () =>
<svg viewBox="0 0 24 24" fill="none" strokeWidth="2.1" strokeLinecap="butt">
        <line x1="9" y1="6" x2="9" y2="18" />
        <line x1="15" y1="6" x2="15" y2="18" />
      </svg>;


// Library: download-details icon (receipt with a coin)
const InfoReceiptIcon = () =>
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 2.75h8.2L18 6.5V20a1.2 1.2 0 0 1-1.2 1.2H6A1.2 1.2 0 0 1 4.8 20V4A1.25 1.25 0 0 1 6 2.75z" />
        <line x1="7.6" y1="8" x2="14.4" y2="8" />
        <line x1="7.6" y1="11" x2="14.4" y2="11" />
        <line x1="7.6" y1="14" x2="12" y2="14" />
        <circle cx="14.2" cy="16.4" r="2.2" />
      </svg>;


// Pegel -> Balkenhöhe: gedämpfte Kurve, damit die Balken im Schnitt schön mittig
// stehen statt dauernd am Anschlag. Deckel < 1, damit sie selten ganz oben anschlagen.
const eqMap = (v, gain) => Math.max(0.08, Math.min(0.9, 0.08 + Math.pow(v, 1.6) * gain));

// Wie schnell die Balken einem neuen Pegel folgen (0..1 pro Bild).
// Kleiner = träger und weicher, größer = direkter und nervöser.
// 0.22 kommt der Trägheit des früheren Live-Analyzers (smoothingTimeConstant
// 0.86) sehr nahe. Höher = direkter, niedriger = weicher.
const EQ_FOLLOW = 0.22;

// Gemeinsame Animationsschleife für beide EQ-Varianten.
// Die Pegel kommen aus den im Admin vorberechneten Frequenzdaten und
// werden über die Wiedergabezeit abgegriffen — kein Web Audio nötig.
// Ohne Daten (oder bei einem noch nicht analysierten Track) fassen wir
// die Balken nicht an, dann läuft weiter die CSS-Animation.
function useEqBars(refs, count, gains) {
  useEffect(() => {
    let raf;
    const smooth = new Array(count).fill(0);
    let styled = false;   // schreiben wir gerade selbst in die Balken?
    let atRest = false;   // Ruhezustand schon erreicht?

    const write = () => {
      for (let i = 0; i < count; i++) {
        const b = refs[i].current;
        if (b) { b.style.animation = 'none'; b.style.transform = `scaleY(${eqMap(smooth[i], gains[i])})`; }
      }
      styled = true;
    };

    const tick = () => {
      const has = eqData.hasData();
      const playing = playbackEl && !playbackEl.paused;

      if (has && playing) {
        const lv = eqData.levelsAt(playbackEl.currentTime, count);
        for (let i = 0; i < count; i++) smooth[i] += (lv[i] - smooth[i]) * EQ_FOLLOW;
        write();
        atRest = false;
      } else if (has || eqData.isPending()) {
        // Pausiert oder gerade am Nachladen: weich in den Ruhezustand
        // fahren und dort stehen bleiben, statt auf zufälliger Höhe
        // einzufrieren.
        if (!atRest) {
          let done = true;
          for (let i = 0; i < count; i++) {
            smooth[i] += (0 - smooth[i]) * EQ_FOLLOW;
            if (smooth[i] > 0.003) done = false; else smooth[i] = 0;
          }
          write();
          if (done) atRest = true;
        }
      } else if (styled) {
        // Track ohne Analyse: Balken wieder der CSS-Animation überlassen.
        for (let i = 0; i < count; i++) {
          const b = refs[i].current;
          if (b) { b.style.animation = ''; b.style.transform = ''; }
          smooth[i] = 0;
        }
        styled = false; atRest = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);
}

// 3-Band-Equalizer: Bass / Mitten / Höhen — folgt der echten Musik.
const EQ_3_GAIN = [0.9, 1.3, 1.9];
const EQ = () => {
  const r0 = useRef(null), r1 = useRef(null), r2 = useRef(null);
  useEqBars([r0, r1, r2], 3, EQ_3_GAIN);
  const barStyle = { height: '100%', transformOrigin: 'bottom' };
  return (
    <div className="eq">
      <div className="eq-bar" ref={r0} style={barStyle} />
      <div className="eq-bar" ref={r1} style={barStyle} />
      <div className="eq-bar" ref={r2} style={barStyle} />
    </div>
  );
};

// 5-Band-Equalizer (Mini-Player): Bass / untere Mitten / Mitten / obere Mitten / Höhen.
const EQ_5_GAIN = [0.9, 1.1, 1.4, 1.7, 2.0];
const EQMini = ({ playing }) => {
  const refs = [useRef(null), useRef(null), useRef(null), useRef(null), useRef(null)];
  useEqBars(refs, 5, EQ_5_GAIN);
  return (
    <div className={`eq-mini ${playing ? '' : 'paused'}`} style={{ alignItems: 'flex-end' }}>
      {refs.map((r, i) => <span key={i} ref={r} style={{ transformOrigin: 'bottom' }} />)}
    </div>
  );
};


// ─── BILD MIT LADERING ──────────────────────────────────────────────
// Zeigt beim Laden denselben Fortschrittsring wie ein Track-Download,
// nur größer und mitwachsend. Drei Wege, in dieser Reihenfolge:
//   1. Schon einmal geladen -> sofort da, kein Ring.
//   2. Selbst geladen -> echter Fortschritt, der Ring füllt sich.
//   3. Speicher erlaubt das nicht -> ganz normales Bild, der Ring dreht
//      sich nur, bis es da ist. Ein Bild bleibt nie aus.
// Der Ring erscheint erst nach kurzer Verzögerung, sonst blitzt er beim
// Durchwischen bereits geladener Bilder bei jedem Wechsel auf.
const RING_DELAY = 200;

const ProgressImage = ({ src, alt, className, imgStyle, ringSize = '24%', wrapStyle, onImgLoad }) => {
  const [url, setUrl] = useState(() => imageLoader.cached(src));
  const [progress, setProgress] = useState(0);
  const [ring, setRing] = useState(false);
  const [direkt, setDirekt] = useState(() => imageLoader.blocked());
  const [fertig, setFertig] = useState(() => !!imageLoader.cached(src));

  useEffect(() => {
    let abgemeldet = false;
    const bereit = imageLoader.cached(src);
    setUrl(bereit);
    setFertig(!!bereit);
    setProgress(0);
    setRing(false);
    setDirekt(imageLoader.blocked());
    if (bereit || !src) return;

    const timer = setTimeout(() => { if (!abgemeldet) setRing(true); }, RING_DELAY);

    if (!imageLoader.blocked()) {
      imageLoader.load(src, (p) => { if (!abgemeldet && p !== null) setProgress(p); }).
      then((u) => { if (!abgemeldet) { setUrl(u); setFertig(true); setRing(false); } }).
      catch(() => { if (!abgemeldet) setDirekt(true); });
    }

    return () => { abgemeldet = true; clearTimeout(timer); };
  }, [src]);

  // Im Rückfall lädt das Bild normal; fertig meldet dann das Bild selbst.
  const quelle = direkt ? src : url;

  return (
    <div className={`pimg${className ? ' ' + className : ''}`} style={wrapStyle}>
          {quelle &&
      <img
        src={quelle}
        alt={alt}
        style={imgStyle}
        draggable={false}
        onLoad={(e) => { setFertig(true); setRing(false); if (onImgLoad) onImgLoad(e); }}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()} />
      }
          {ring && !fertig &&
      <span className="pimg-ring" style={{ width: ringSize }}>
              {direkt ?
        <SpinnerArc /> :
        <ProgressRing value={progress} />}
            </span>
      }
        </div>);


};

// ─── COVER PLACEHOLDER ──────────────────────────────────────────────
// COVER_IMAGES -> aus content.js

const CoverPlaceholder = ({ album, size = 280 }) => {
  const imgSrc = COVER_IMAGES[album.id];
  if (imgSrc) {
    // Cover sind große Flächen — hier lohnt der Ladering am meisten.
    return (
      <ProgressImage
        src={imgSrc}
        alt={album.title}
        className="protected-cover-wrap"
        ringSize="26%"
        wrapStyle={{ width: size, maxWidth: '100%', aspectRatio: '1 / 1', flexShrink: 0 }}
        imgStyle={{
          width: '100%', height: '100%',
          objectFit: 'cover', display: 'block'
        }} />);


  }
  const colors = {
    'psy-atlas': ['#8B3A1A', '#C65A20', '#4A1A0A'],
    'twin-sun-static': ['#C65A20', '#DAA520', '#4A2A00']
  };
  const [c1, c2, c3] = colors[album.id] || ['#333', '#555', '#111'];
  return (
    <div style={{
      // Wie beim echten Cover: nie breiter als die Spalte, immer quadratisch.
      width: size, maxWidth: '100%', aspectRatio: '1 / 1', height: 'auto',
      background: `radial-gradient(circle at 40% 40%, ${c1}, ${c3})`,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden',
      flexShrink: 0
    }}>
          <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 2px, rgba(255,255,255,0.02) 2px, rgba(255,255,255,0.02) 4px)`
      }} />
          <div style={{
        fontFamily: 'monospace', fontSize: 9, letterSpacing: '0.1em',
        color: 'rgba(255,255,255,0.2)', textAlign: 'center', padding: 16,
        lineHeight: 1.6, position: 'relative', zIndex: 1
      }}>
            [ cover art ]<br />{album.title}
          </div>
          <div style={{
        position: 'absolute', bottom: 8, left: 8,
        fontFamily: 'monospace', fontSize: 8, letterSpacing: '0.15em',
        color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase'
      }}>CARGO</div>
        </div>);

};

// ─── BILDANSICHT MIT WISCHEN ────────────────────────────────────────
// Drei Bilder liegen nebeneinander auf einer Schiene: vorheriges,
// aktuelles, nächstes. Die Schiene steht um genau eine Bildbreite nach
// links versetzt, sodass das aktuelle Bild mittig sitzt.
//
// Beim Ziehen folgt die Schiene dem Finger eins zu eins — das Nachbarbild
// schiebt sich dadurch schon am Rand herein. Beim Loslassen entscheidet
// die zurückgelegte Strecke oder die Wurfgeschwindigkeit, ob es weiter-
// rastet oder zurückfedert. Danach springt die Schiene ohne Animation in
// die Mitte zurück und der Index wandert weiter; sichtbar bleibt das
// gleiche Bild, es wirkt also nahtlos.
const SWIPE_EASE = 'transform 0.34s cubic-bezier(0.22, 0.61, 0.36, 1)';

const Lightbox = ({ items, index, onIndex, onClose }) => {
  const trackRef = useRef(null);
  const stateRef = useRef({ dragging: false, startX: 0, startY: 0, dx: 0, moved: false, lastX: 0, lastT: 0, v: 0, locked: null });
  const busyRef = useRef(false);

  const wrap = (i) => (i % items.length + items.length) % items.length;
  const at = (offset) => items[wrap(index + offset)];

  const setTrack = (px, animate) => {
    const el = trackRef.current;
    if (!el) return;
    el.style.transition = animate ? SWIPE_EASE : 'none';
    el.style.transform = `translate3d(calc(-100% / 3 + ${px}px), 0, 0)`;
  };

  // Nach der Animation eine Position weiterschalten und die Schiene ohne
  // sichtbaren Sprung wieder mittig setzen.
  const commit = (dir) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const width = window.innerWidth;
    setTrack(-dir * width, true);
    setTimeout(() => {
      onIndex(wrap(index + dir));
      setTrack(0, false);
      busyRef.current = false;
    }, 340);
  };

  const go = (dir) => { if (items.length > 1) commit(dir); };

  useEffect(() => { setTrack(0, false); }, [index]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const down = (e) => {
    if (items.length < 2 || busyRef.current) return;
    // Auf dem Video selbst nicht wischen — sonst käme man an die
    // Abspielsteuerung nicht heran. Daneben, auf der schwarzen Fläche,
    // funktioniert das Wischen weiterhin.
    if (e.target && e.target.tagName === 'VIDEO') return;
    const s = stateRef.current;
    s.dragging = true; s.moved = false; s.locked = null;
    s.startX = s.lastX = e.clientX; s.startY = e.clientY;
    s.dx = 0; s.v = 0; s.lastT = performance.now();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  };

  const move = (e) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.startX;
    const dy = e.clientY - s.startY;
    // Erst ab einer kleinen Strecke entscheiden, ob es ein Wischen ist.
    if (s.locked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      s.locked = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (s.locked !== 'x') return;
    const now = performance.now();
    const dt = Math.max(1, now - s.lastT);
    s.v = (e.clientX - s.lastX) / dt * 1000;   // Pixel pro Sekunde
    s.lastX = e.clientX; s.lastT = now;
    s.dx = dx; s.moved = true;
    setTrack(dx, false);
  };

  const up = (e) => {
    const s = stateRef.current;
    if (!s.dragging) return;
    s.dragging = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}

    if (!s.moved) {
      // Kein Ziehen, also ein Tipp: neben dem Bild schließt die Ansicht.
      if (e.target && e.target.tagName !== 'IMG') onClose();
      return;
    }
    const width = window.innerWidth;
    const weit = Math.abs(s.dx) > width * 0.2;
    const schnell = Math.abs(s.v) > 500;
    if (weit || schnell) commit(s.dx < 0 ? 1 : -1);else
    setTrack(0, true);
  };

  const cur = items[index];

  return (
    <div className="lightbox">
          <div
        className="lb-viewport"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}>

            <div className="lb-track" ref={trackRef}>
              {[-1, 0, 1].map((o) => {
            const it = at(o);
            return (
              <div className="lb-slide" key={o}>
                    {it.type === 'video' ?
                // Echter Player mit Steuerung und Ton. Nur das mittlere,
                // sichtbare Video spielt von selbst — die Nachbarn liegen
                // bereit, sollen aber nicht im Hintergrund mitlaufen.
                <video
                  className="lb-video"
                  src={it.src}
                  controls
                  playsInline
                  preload="metadata"
                  autoPlay={o === 0}
                  loop /> :

                <ProgressImage
                  src={it.src}
                  alt={it.label}
                  className="lb-pimg"
                  ringSize="clamp(64px, 13vmin, 130px)"
                  imgStyle={{}} />
                }
                  </div>);

          })}
            </div>
          </div>

          <button className="lightbox-close" onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none"><line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" /></svg>
          </button>

          {items.length > 1 &&
      <>
              <button className="lightbox-arrow prev" onClick={() => go(-1)} aria-label="Previous image">
                <svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6" /></svg>
              </button>
              <button className="lightbox-arrow next" onClick={() => go(1)} aria-label="Next image">
                <svg viewBox="0 0 24 24"><polyline points="9,18 15,12 9,6" /></svg>
              </button>
            </>
      }
          <div className="lightbox-label">{index + 1} / {items.length} — {cur.label}</div>
        </div>);


};

// ─── MEDIA PANEL ────────────────────────────────────────────────────
const MediaPanel = ({ open, onClose }) => {
  const [tab, setTab] = React.useState('images');
  const [lightboxIdx, setLightboxIdx] = React.useState(null);
  // Inhalte kommen aus dem Admin. Früher ließen sich hier Platzhalter
  // anlegen — das hatte keinen Effekt und ist raus.
  const items = GALLERY;

  const ImageIcon = () =>
  <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>;

  const VideoIcon = () =>
  <svg viewBox="0 0 24 24"><rect x="2" y="4" width="15" height="16" rx="2" /><path d="M17 8l5-3v14l-5-3V8z" /></svg>;

  const currentItems = items[tab];
  const imgItems = currentItems.filter((i) => i.src);

  const openLightbox = (idx) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  // Blättern und Tastatur liegen jetzt in Lightbox, damit Wischen und
  // Pfeile denselben Weg nehmen und dieselbe Animation auslösen.

  return (
    <>
          <div className={`media-panel-backdrop ${open ? 'open' : ''}`} onClick={onClose} />
          <div className={`media-panel ${open ? 'open' : ''}`}>
            <div className="media-panel-header">
              <div className="media-panel-title">CARGO — MEDIA</div>
              <button className="media-panel-close" onClick={onClose}>
                <svg viewBox="0 0 24 24" fill="none">
                  <line x1="4" y1="4" x2="20" y2="20" />
                  <line x1="20" y1="4" x2="4" y2="20" />
                </svg>
              </button>
            </div>

            <div className="media-panel-tabs">
              {['images', 'videos'].map((t) =>
          <button key={t} className={`media-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                  {t}
                </button>
          )}
            </div>

            <div className="media-panel-body">
              {currentItems.length === 0 ?
          <div className="media-empty">
                  <p>No {tab} yet.</p>
                </div> :

          <div className="media-grid">
                  {currentItems.map((item, idx) => {
              const imgIdx = imgItems.indexOf(item);
              return (
                <div key={item.id} className="media-cell" onClick={() => item.src && openLightbox(imgIdx)} style={{ cursor: item.src ? 'pointer' : 'default' }}>
                      <div className="media-cell-overlay" />
                      {item.src ?
                  item.type === 'video' ?
                  // Stumme Vorschau in Schleife. Ein Video-Element statt
                  // eines Bildes ist hier Pflicht: Nur so übernimmt der
                  // Hardware-Decoder, und nur so läuft es in Echtzeit.
                  <video
                    src={item.src}
                    className="media-cell-media"
                    muted
                    loop
                    autoPlay
                    playsInline
                    preload="metadata"
                    disablePictureInPicture /> :

                  <img src={item.src} alt={item.label} className="media-cell-media" /> :


                  <div className="media-cell-icon">
                          {item.type === 'image' ? <ImageIcon /> : <VideoIcon />}
                        </div>
                  }
                      {!item.src && <span>{item.label}</span>}
                      <div className="media-cell-label">{item.src ? item.label : 'click to replace'}</div>
                    </div>);

            })}
                </div>
          }
            </div>
          </div>

        {lightboxIdx !== null && imgItems[lightboxIdx] &&
      <Lightbox
        items={imgItems}
        index={lightboxIdx}
        onIndex={setLightboxIdx}
        onClose={closeLightbox} />
      }
      </>);

};

// ─── HEADER ─────────────────────────────────────────────────────────
const Header = ({ onMenuOpen, onNavigate, onBagOpen, navOpen }) =>
<header className="header">
        <button className={`hamburger-btn ${navOpen ? 'is-open' : ''}`} onClick={onMenuOpen} aria-label="Menu">
          <span /><span /><span />
        </button>
        <div className="header-logo" onClick={() => onNavigate('landing')} style={{ cursor: 'pointer' }}>
          <CamelLogo />
        </div>
        <button className="bag-btn" aria-label="Media" onClick={onBagOpen}>
          <CargoMarkIcon />
        </button>
      </header>;


const NavOverlay = ({ open, onClose, onNavigate }) => {
  const items = ['MUSIC', 'LIBRARY', 'CARGO', 'STORE', 'CONTACT'];
  return (
    <div className={`nav-overlay ${open ? 'open' : ''}`}>
          <button className="nav-close" onClick={onClose} aria-label="Close menu">
            <svg viewBox="0 0 24 24" fill="none">
              <line x1="4" y1="4" x2="20" y2="20" />
              <line x1="20" y1="4" x2="4" y2="20" />
            </svg>
          </button>
          {items.map((item) =>
      <button key={item} className="nav-item" onClick={() => {onNavigate(item.toLowerCase());onClose();}}>
              {item}
            </button>
      )}
        </div>);

};

// ─── LANDING PAGE ───────────────────────────────────────────────────
const LandingPage = ({ onEnter, scanlines = true, glow = true, tweaks = {} }) => {
  const [ship, setShip] = React.useState(null);
  const rafRef = React.useRef(null);
  const startRef = React.useRef(null);
  const shipDataRef = React.useRef(null);

  const launchShip = React.useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Always fly from top-left to bottom-right
    const sx = Math.random() * vw * 0.4; // start in left 40%
    const sy = -80;
    const ex = vw * 0.6 + Math.random() * vw * 0.4; // end in right 60%
    const ey = vh + 80;
    const dx = ex - sx;
    const dy = ey - sy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const duration = dist / 200;
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    shipDataRef.current = { sx, sy, ex, ey, dx, dy, duration, angle };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    startRef.current = null;

    const animate = (ts) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = (ts - startRef.current) / 1000;
      const t = Math.min(elapsed / duration, 1);
      const d = shipDataRef.current;
      const x = d.sx + d.dx * t;
      const y = d.sy + d.dy * t;
      const opacity = t < 0.08 ? t / 0.08 : t > 0.92 ? (1 - t) / 0.08 : 1;
      setShip({ x, y, opacity, angle: d.angle });
      if (t < 1) rafRef.current = requestAnimationFrame(animate);else
      setShip(null);
    };
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  React.useEffect(() => {
    const first = setTimeout(launchShip, 3000);
    const interval = setInterval(launchShip, 10000);
    return () => {
      clearTimeout(first);
      clearInterval(interval);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="landing">
        {glow && <div className="landing-glow" />}
        <div className="landing-noise" />
        {scanlines && <div className="landing-scanlines" />}

        {ship &&
      <div
        className="spaceship"
        style={{
          left: ship.x,
          top: ship.y,
          opacity: ship.opacity,
          perspective: '600px'
        }}>
        
            <img
          src="/uploads/Naboo_Royal_Starship_SWE.webp"
          alt=""
          style={{
            width: 130,
            height: 'auto',
            display: 'block',
            transform: `rotate(${ship.angle}deg)`,
            filter: 'drop-shadow(0 6px 16px rgba(160,160,255,0.5))',
            transformOrigin: 'center center'
          }} />
        
          </div>
      }

        <div className="landing-content">
          <button className="enter-btn" onClick={onEnter}>{tweaks.landingBtn || 'ENTER'}</button>
        </div>
      </div>);

};

// ─── HUB PAGE ───────────────────────────────────────────────────────
const HubPage = ({ onNavigate, tweaks }) => {
  const items = ['MUSIC', 'LIBRARY', 'CARGO', 'STORE', 'CONTACT'];
  const STORE_URL = 'https://your-store.com';
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100dvh - 72px)',
      gap: tweaks.navGap, padding: '60px 24px', marginTop: tweaks.navVerticalOffset
    }} className="page-enter">
          {items.map((item, i) =>
      <button
        key={item}
        className="nav-item"
        style={{
          opacity: 0,
          animation: `fadeInUp 0.5s ease forwards ${i * 0.08 + 0.1}s`,
          fontSize: tweaks.navFontSize * tweaks.navScale,
          width: tweaks.navBoxWidth * tweaks.navScale,
          paddingTop: tweaks.navBoxPadding * tweaks.navScale,
          paddingBottom: tweaks.navBoxPadding * tweaks.navScale,
          borderRadius: 100
        }}
        onClick={() => {
          if (item === 'STORE') {window.open(STORE_URL, '_blank', 'noopener,noreferrer');} else
          {onNavigate(item.toLowerCase());}
        }}>
        
              {item}
            </button>
      )}
        </div>);

};

// ─── MUSIC GALLERY ──────────────────────────────────────────────────
const MusicGallery = ({ active, onActiveChange, onSelectAlbum, tweaks }) => {
  const [vw, setVw] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 800);
  const [vh, setVh] = useState(() => typeof window !== 'undefined' ? window.innerHeight : 600);
  const [ready, setReady] = useState(false);
  const wrapRef = useRef(null);
  const touchRef = useRef({ x: 0, y: 0, active: false, swiped: false, horizontal: false });
  const album = ALBUMS[active];

  useEffect(() => {
    const measure = () => {setVw(window.innerWidth);setVh(window.innerHeight);};
    measure();
    // enable the horizontal slide transition only AFTER mount, so the
    // carousel doesn't slide left/right when returning from a tracklist.
    const raf = requestAnimationFrame(() => setReady(true));
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      cancelAnimationFrame(raf);
    };
  }, []);

  // ── responsive cover sizing ───────────────────────────────────────
  // The active cover scales fluidly with the viewport width but never grows
  // past MAX_CARD (the desktop size). CARD is chosen as the LARGEST size that
  // still keeps a small positive gap, so the side covers always retain the
  // SAME visible proportion as on desktop — no clamping to 0, no layout jumps
  // between breakpoints. On wide screens CARD pins to MAX_CARD and the gap
  // simply grows, leaving the desktop layout untouched.
  const MAX_CARD = 420;
  const sideScale = 0.65;
  const GAP_MIN = 6;
  // On phones the active cover should grow and the neighbours crop in more,
  // so we ease the effective side visibility down as the viewport narrows.
  // At desktop widths it stays the user's tweak value (layout unchanged);
  // on phones it drops toward MOBILE_SIDE_VIS for a bigger hero cover.
  const MOBILE_SIDE_VIS = 0.4;
  const sideVisBase = tweaks.carouselSideVisibility;
  const t = Math.max(0, Math.min(1, (vw - 480) / (900 - 480)));
  const sideVis = MOBILE_SIDE_VIS + (sideVisBase - MOBILE_SIDE_VIS) * t;

  // Album title shrinks on small screens (carousel only).
  const titleSize = vw < 600 ?
  Math.max(13, Math.round(tweaks.albumTitleSize * 0.6)) :
  tweaks.albumTitleSize;

  // ── fit-to-viewport sizing ─────────────────────────────────────────
  // The cover is limited by BOTH the available width AND the available
  // height, so the whole gallery (cover + title + availability + dots)
  // always fits on screen — no clipping, no vertical scroll — and stays
  // centred at any window size. Whichever axis is tighter wins.
  const HEADER_H = 100;
  const PAD_V = 24; // carousel top+bottom breathing room
  const TITLE_BLOCK = 18 + Math.round(titleSize * 1.5); // title gap + line
  const BELOW_BLOCK = 86; // availability + dots + margins
  const SAFETY = 16;
  const reservedV = HEADER_H + PAD_V + TITLE_BLOCK + BELOW_BLOCK + SAFETY;
  const heightLimit = vh - reservedV;
  const widthLimit = (vw / 2 - GAP_MIN) / (0.5 + sideScale * sideVis);
  const CARD = Math.round(
    Math.max(120, Math.min(MAX_CARD, widthLimit, heightLimit))
  );
  const GAP = Math.max(
    GAP_MIN,
    Math.round(vw / 2 - CARD / 2 - CARD * sideScale * sideVis)
  );

  const getPos = (i) => {
    const diff = (i - active + ALBUMS.length) % ALBUMS.length;
    if (diff === 0) return 'center';
    if (diff === 1 || diff === ALBUMS.length - 1) return 'side';
    return 'far-side';
  };

  const goTo = (i) => onActiveChange((i % ALBUMS.length + ALBUMS.length) % ALBUMS.length);

  // ── swipe detection: the carousel stays fixed and snaps cleanly to the
  //    next/prev album. No live drag-follow, so it never moves irregularly
  //    and can't be pulled around. Vertical gestures are ignored. ──
  const SWIPE_THRESHOLD = 45;

  const onSwipeStart = (clientX, clientY) => {
    touchRef.current = { x: clientX, y: clientY, active: true, swiped: false, horizontal: false };
  };
  const onSwipeMove = (clientX, clientY) => {
    const t = touchRef.current;
    if (!t.active) return;
    const dx = clientX - t.x;
    const dy = clientY - t.y;
    if (!t.horizontal && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
      t.horizontal = true;
    }
  };
  const onSwipeEnd = (clientX) => {
    const t = touchRef.current;
    if (!t.active) return;
    t.active = false;
    const dx = clientX - t.x;
    if (t.horizontal && Math.abs(dx) > SWIPE_THRESHOLD) {
      t.swiped = true;
      if (dx < 0) goTo(active + 1);else
      goTo(active - 1);
    }
  };

  // compute translateX so active is centred — fixed position, snaps on swipe
  const centreOffset = vw / 2 - CARD / 2;
  const baseTranslate = centreOffset - active * (CARD + GAP);

  return (
    <div className="music-gallery gallery-fade">
          <div
        className="album-carousel-wrap"
        ref={wrapRef}
        onMouseDown={(e) => onSwipeStart(e.clientX, e.clientY)}
        onMouseMove={(e) => onSwipeMove(e.clientX, e.clientY)}
        onMouseUp={(e) => onSwipeEnd(e.clientX)}
        onMouseLeave={(e) => onSwipeEnd(e.clientX)}
        onTouchStart={(e) => onSwipeStart(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchMove={(e) => onSwipeMove(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={(e) => onSwipeEnd((e.changedTouches[0] || { clientX: touchRef.current.x }).clientX)}>
        
            <div
          className="album-carousel"
          style={{
            transform: `translateX(${baseTranslate}px)`,
            transition: ready ? 'transform 0.45s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none',
            gap: GAP,
            paddingTop: 12, paddingBottom: 12
          }}>
          
              {ALBUMS.map((a, i) => {
            const pos = getPos(i);
            return (
              <div
                key={a.id}
                className={`album-card ${pos}`}
                style={{ width: CARD, flexShrink: 0, cursor: 'pointer' }}
                onClick={() => {
                  if (!touchRef.current.swiped) {
                    if (pos === 'center') onSelectAlbum(a);else
                    if (pos === 'side') {
                      const diff = (i - active + ALBUMS.length) % ALBUMS.length;
                      goTo(diff === 1 ? active + 1 : active - 1);
                    }
                  }
                }}>
                
                    <CoverPlaceholder album={a} size={CARD} />
                    <div style={{
                  textAlign: 'center',
                  fontFamily: 'var(--mono)',
                  fontSize: titleSize,
                  letterSpacing: tweaks.albumTitleLetterSpacing + 'em',
                  color: 'var(--white)',
                  textTransform: 'uppercase',
                  marginTop: tweaks.albumTitleOffset + 20,
                  marginBottom: tweaks.albumTitleMarginBottom,
                  opacity: pos === 'center' ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                  pointerEvents: 'none'
                }}>{a.title}</div>
                  </div>);

          })}
            </div>
          </div>

          <div className="album-availability">
            {album.availabilityLinks ?
        <>also available at <a href={album.availabilityLinks.apple}>apple music</a> &amp; <a href={album.availabilityLinks.spotify}>spotify</a></> :
        album.availability
        }
          </div>

          <div className="carousel-dots">
            {ALBUMS.map((_, i) =>
        <div key={i} className={`dot ${i === active ? 'active' : ''}`} onClick={() => goTo(i)} />
        )}
          </div>
        </div>);

};

// ─── ALBUM DETAIL ───────────────────────────────────────────────────
const AlbumDetail = ({ album, onBack, onPlay, currentTrack, isPlaying, variant = 'music', onGoLibrary }) => {
  const isLibrary = variant === 'library';
  // Gehört das gerade geladene Lied zu diesem Album? Danach richtet sich
  // der große Play-/Pause-Knopf über der Trackliste.
  const albumIsCurrent = !!currentTrack && currentTrack.albumId === album.id;
  const albumIsPlaying = albumIsCurrent && isPlaying;

  // In der Library nur die Tracks zeigen, die man tatsächlich geladen hat —
  // mit ihren Originalnummern. Track 7 bleibt Track 7, es wird nichts neu
  // durchnummeriert.
  const visibleTracks = isLibrary ?
  album.tracks.filter((t) => downloads.isDownloaded(album.id, t.id)) :
  album.tracks;

  // Für das Release-Info-Fenster: Die Seite rechnet den Besitzstand selbst
  // aus, es steht nirgends fest geschrieben. Lädt man einen Track nach,
  // stimmt die Zahl beim nächsten Öffnen automatisch.
  const ownedCount = downloads.downloadedTrackIds(album.id).length;
  const lastDownloadText = formatDownloadDate(downloads.lastDownloadAt(album.id));
  const [descOpen, setDescOpen] = useState(false);
  const [descClosing, setDescClosing] = useState(false);
  const [descOrigin, setDescOrigin] = useState({ tx: '0px', ty: '0px' });
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoClosing, setInfoClosing] = useState(false);
  const [infoOrigin, setInfoOrigin] = useState({ tx: '0px', ty: '0px' });
  const [thanksOpen, setThanksOpen] = useState(false);
  const [thanksClosing, setThanksClosing] = useState(false);
  const [thanksOrigin, setThanksOrigin] = useState({ tx: '0px', ty: '0px' });
  const [redlOpen, setRedlOpen] = useState(false);
  const [redlClosing, setRedlClosing] = useState(false);
  const [redlOrigin, setRedlOrigin] = useState({ tx: '0px', ty: '0px' });
  const [redlSel, setRedlSel] = useState([]);   // angehakte Tracknummern
  const [redlDone, setRedlDone] = useState([]); // in diesem Durchgang fertig
  const [redlBusy, setRedlBusy] = useState(false);

  // Neu rendern, sobald sich der Download-Stand ändert.
  useDownloads();
  const albumDone = downloads.albumIsComplete(album);

  const openDesc = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vx = window.innerWidth / 2;
    const vy = window.innerHeight / 2;
    setDescOrigin({
      tx: `${cx - vx}px`,
      ty: `${cy - vy}px`
    });
    setDescClosing(false);
    setDescOpen(true);
  };

  const closeDesc = () => {
    if (descClosing) return;
    setDescClosing(true);
    setTimeout(() => {
      setDescOpen(false);
      setDescClosing(false);
    }, 320);
  };

  const openInfo = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setInfoOrigin({
      tx: `${cx - window.innerWidth / 2}px`,
      ty: `${cy - window.innerHeight / 2}px`
    });
    setInfoClosing(false);
    setInfoOpen(true);
  };

  const closeInfo = () => {
    if (infoClosing) return;
    setInfoClosing(true);
    setTimeout(() => {
      setInfoOpen(false);
      setInfoClosing(false);
    }, 320);
  };

  const closeThanks = () => {
    setThanksClosing(true);
    setTimeout(() => {
      setThanksOpen(false);
      setThanksClosing(false);
    }, 320);
  };

  // „library“ im Fenstertext führt direkt dorthin.
  const goToLibrary = () => {
    setThanksOpen(false);
    setThanksClosing(false);
    if (onGoLibrary) onGoLibrary();
  };

  // ── Re-Download ────────────────────────────────────────────────────
  // Fenster mit Auswahlliste: nur Tracks, die man wirklich besitzt.
  // Beim Öffnen ist nichts angehakt — wer alles will, tippt ALL.
  const openRedownload = (e) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    setRedlOrigin({
      tx: `${rect.left + rect.width / 2 - window.innerWidth / 2}px`,
      ty: `${rect.top + rect.height / 2 - window.innerHeight / 2}px`
    });
    setRedlSel([]);
    setRedlClosing(false);
    setRedlOpen(true);
  };

  const closeRedownload = () => {
    if (redlBusy) return; // während des Ladens bleibt das Fenster zu
    setRedlClosing(true);
    setTimeout(() => {
      setRedlOpen(false);
      setRedlClosing(false);
      setRedlSel([]);
      setRedlDone([]);
    }, 320);
  };

  const toggleSel = (id) =>
  setRedlSel((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);

  const allSelected = visibleTracks.length > 0 && redlSel.length === visibleTracks.length;
  const toggleAll = () =>
  setRedlSel(allSelected ? [] : visibleTracks.map((t) => t.id));

  const handleRedownload = async () => {
    if (redlBusy || !redlSel.length) return;
    const list = visibleTracks.filter((t) => redlSel.includes(t.id) && t.file);
    if (!list.length) return;
    setRedlBusy(true);
    setRedlDone([]);
    const files = [];
    try {
      for (const t of list) {
        setTrackProgress(t.id, 0);
        try {
          const bytes = await fetchWithProgress(t.file, (p) =>
          setTrackProgress(t.id, p === null ? 0.5 : p)
          );
          files.push({ name: trackFilename(t), bytes });
          setRedlDone((p) => [...p, t.id]);
        } catch (err) {
          console.warn('[re-download]', t.title, err && err.message);
        } finally {
          clearTrack(t.id);
        }
      }
      // Wie beim großen Knopf: mehrere Tracks als Archiv, einer als Datei.
      if (files.length === 1) {
        saveBlob(new Blob([files[0].bytes], { type: 'audio/mp4' }), files[0].name);
      } else if (files.length > 1) {
        saveBlob(makeZip(files), `${safeFilename(album.title, 'release')}.zip`);
      }
      if (files.length) downloads.touch(album.id);
    } finally {
      setRedlBusy(false);
    }
  };

  // ── Downloads ──────────────────────────────────────────────────────
  // Zustand je Track: nichts | { progress } während des Ladens.
  // Was fertig ist, steht dauerhaft im downloads-Modul und übersteht das
  // Neuladen der Seite.
  const [busy, setBusy] = useState({});          // trackId -> 0..1
  const [allBusy, setAllBusy] = useState(false); // großer Knopf dreht sich

  // Der große Knopf steht für das ganze Release, nicht für einen einzelnen
  // Track. Er soll sich deshalb auch dann drehen, wenn der laufende
  // Download das Release vollständig macht — sonst springt er bei einer
  // Single vom Pfeil direkt auf den Haken, ganz ohne Animation.
  // Lädt man dagegen Track 3 von 5, bleibt oben der Pfeil stehen: Das
  // Release ist danach ja immer noch unvollständig.
  const finishingRelease = (() => {
    if (albumDone) return false;
    const running = Object.keys(busy).map(Number);
    if (!running.length) return false;
    const have = downloads.downloadedTrackIds(album.id);
    const missing = album.tracks.filter((t) => t.file && !have.includes(t.id));
    return missing.length > 0 && missing.every((t) => running.includes(t.id));
  })();
  const albumBusy = allBusy || finishingRelease;

  const setTrackProgress = (id, v) =>
  setBusy((p) => ({ ...p, [id]: v }));

  const clearTrack = (id) =>
  setBusy((p) => { const n = { ...p };delete n[id];return n; });

  const trackFilename = (track) =>
  `${String(track.id).padStart(2, '0')} ${safeFilename(track.title, 'track')}.${extensionFromUrl(track.file)}`;

  // Das Dankesfenster wächst aus dem Knopf heraus, der gedrückt wurde.
  const openThanks = (el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setThanksOrigin({
      tx: `${rect.left + rect.width / 2 - window.innerWidth / 2}px`,
      ty: `${rect.top + rect.height / 2 - window.innerHeight / 2}px`
    });
    setThanksClosing(false);
    setThanksOpen(true);
  };

  const handleDownloadTrack = async (track, el) => {
    if (!track.file || busy[track.id] !== undefined) return;
    if (downloads.isDownloaded(album.id, track.id)) return; // fertig = passiv
    setTrackProgress(track.id, 0);
    try {
      const bytes = await fetchWithProgress(track.file, (p) =>
      setTrackProgress(track.id, p === null ? 0.5 : p)
      );
      saveBlob(new Blob([bytes], { type: 'audio/mp4' }), trackFilename(track));
      const isNewForLibrary = downloads.markDownloaded(album.id, track.id);
      if (isNewForLibrary) openThanks(el);
    } catch (e) {
      console.warn('[download]', e && e.message);
    } finally {
      clearTrack(track.id);
    }
  };

  // Alles herunterladen: nacheinander laden, dabei je Track den echten
  // Fortschritt zeigen, am Ende alles als ein Archiv speichern.
  // Tracks ohne hinterlegte Datei werden übersprungen.
  const handleDownloadAll = async (el) => {
    if (allBusy) return;
    const list = album.tracks.filter((t) => t.file);
    if (!list.length) return;
    setAllBusy(true);
    const files = [];
    let isNewForLibrary = false;
    try {
      for (const t of list) {
        if (downloads.isDownloaded(album.id, t.id)) continue;
        setTrackProgress(t.id, 0);
        try {
          const bytes = await fetchWithProgress(t.file, (p) =>
          setTrackProgress(t.id, p === null ? 0.5 : p)
          );
          files.push({ name: trackFilename(t), bytes });
          if (downloads.markDownloaded(album.id, t.id)) isNewForLibrary = true;
        } catch (e) {
          console.warn('[download]', t.title, e && e.message);
        } finally {
          clearTrack(t.id);
        }
      }
      if (files.length) {
        const zipName = `${safeFilename(album.title, 'release')}.zip`;
        saveBlob(makeZip(files), zipName);
      }
      if (isNewForLibrary) openThanks(el);
    } finally {
      setAllBusy(false);
    }
  };

  return (
    <div className="album-detail page-enter">
          <button className="back-btn" onClick={onBack}>
            ← BACK
          </button>

          <div className="detail-hero">
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <CoverPlaceholder album={album} size={400} />
            </div>

            <div className="detail-info">
              <div className="detail-title">{album.title}</div>
              <div className="detail-artist">{album.artist}</div>
              {!isLibrary &&
          <button className="detail-desc-toggle" onClick={openDesc}>
                description
              </button>
          }
            </div>
          </div>

          <div className="detail-actions">
            {/* Großer Knopf über der Trackliste: Schalter für das ganze Album.
                Läuft bereits ein Lied dieses Albums, pausiert er es und setzt
                es an derselben Stelle wieder fort — er springt also nicht
                zurück auf Lied 1. Nur wenn das Album gar nicht aktiv ist,
                startet er es von vorne. */}
            <button
              className={`action-circle play ${albumIsPlaying ? 'is-pause' : ''}`}
              onClick={() => {
                if (albumIsCurrent && currentTrack) onPlay(currentTrack, album);
                else if (visibleTracks[0]) onPlay(visibleTracks[0], album);
              }}
              title={albumIsPlaying ? 'Pause' : 'Play album'}
              aria-label={albumIsPlaying ? 'Pause' : 'Play album'}>
              {albumIsPlaying ? <PauseThin /> : <PlayThin />}
            </button>
            {isLibrary ?
        <>
              <div className="redownload-wrap">
                <button className="redownload-btn" onClick={openRedownload}>RE-DOWNLOAD</button>
              </div>
              <button className="action-circle" onClick={openInfo} title="Download details" aria-label="Download details">
                <InfoReceiptIcon />
              </button>
            </> :

        <button
              className={`dl-circle${albumBusy ? ' is-busy' : ''}${albumDone ? ' is-done' : ''}`}
              onClick={(e) => handleDownloadAll(e.currentTarget)}
              disabled={albumBusy || albumDone}
              title={albumDone ? 'Already in your library' : 'Download all'}
              aria-label={albumDone ? 'Already in your library' : 'Download all'}>
              {albumDone ? <CheckIcon /> : albumBusy ? <SpinnerArc /> :
          <svg viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5M4 20h16" /></svg>}
            </button>
        }
          </div>

          <div className="tracklist">
            {visibleTracks.map((track) => {
          const isThisPlaying = currentTrack?.id === track.id && currentTrack?.albumId === album.id && isPlaying;
          const isThisLoaded = currentTrack?.id === track.id && currentTrack?.albumId === album.id;
          return (
            <div key={track.id} className={`track-row ${isThisLoaded ? 'playing' : ''}`} onClick={() => onPlay(track, album)}>
                  <div className="track-num">
                    {isThisPlaying ? <EQ /> : track.id}
                  </div>
                  <div className="track-info">
                    <div className="track-title">{track.title}</div>
                    <div className="track-sub">{track.artist}</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#444', marginRight: 8 }}>{track.duration}</div>
                  {!isLibrary &&
              <div className="track-dl-col" style={{ width: 44, alignItems: 'center' }}>
                    {(() => {
                  const done = downloads.isDownloaded(album.id, track.id);
                  const loading = busy[track.id] !== undefined;
                  return (
                    <button
                      className={`track-dl${loading ? ' is-busy' : ''}${done ? ' is-done' : ''}`}
                      disabled={done || loading || !track.file}
                      title={done ? 'Already in your library' : 'Download'}
                      aria-label={done ? 'Already in your library' : 'Download'}
                      onClick={(e) => {e.stopPropagation();handleDownloadTrack(track, e.currentTarget);}}>
                          {done ? <CheckIcon /> :
                      loading ? <ProgressRing value={busy[track.id]} /> :
                      <svg viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5M4 20h16" /></svg>}
                        </button>);

                })()}
                  </div>
              }
                </div>);

        })}
          </div>

          {/* Copyright kommt aus der Albumbearbeitung im Admin.
              Ist das Feld leer, erscheint auch kein Trennpunkt. */}
          {/* Jede Angabe auf ihrer eigenen Zeile, ohne Umbruch — auch auf
              breiten Schirmen, wo sie nebeneinander Platz hätten. Das
              Datum steht mit einer Leerzeile Abstand darunter, in Grau.
              Copyright und Datum kommen aus der Albumbearbeitung; sind
              sie leer, fehlt die Zeile ganz. */}
          <div className="detail-meta">
            <div className="detail-meta-line">
              {isLibrary ? visibleTracks.length : album.totalTracks} Songs, {album.duration}
            </div>
            {album.copyright &&
        <div className="detail-meta-line">{album.copyright}</div>
        }
            {album.releaseDate &&
        <div className="detail-meta-date">{album.releaseDate}</div>
        }
          </div>

          {descOpen && ReactDOM.createPortal(
        <div
          className={`desc-modal-overlay${descClosing ? ' closing' : ''}`}
          onClick={closeDesc}>
          
              <div
            className="desc-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ '--tx': descOrigin.tx, '--ty': descOrigin.ty }}>
            
                <button
              className="desc-modal-close"
              onClick={closeDesc}
              aria-label="Close description">
              
                  <svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" /></svg>
                </button>
                <div className="desc-modal-text">{album.description}</div>
              </div>
            </div>,
        document.body
      )}

          {infoOpen && ReactDOM.createPortal(
        <div
          className={`desc-modal-overlay${infoClosing ? ' closing' : ''}`}
          onClick={closeInfo}>
          
              <div
            className="desc-modal info-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ '--tx': infoOrigin.tx, '--ty': infoOrigin.ty }}>
            
                <button
              className="desc-modal-close"
              onClick={closeInfo}
              aria-label="Close details">
              
                  <svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" /></svg>
                </button>
                <div className="desc-modal-title">release details</div>
                <div className="info-modal-rows">
                  <div className="info-row">Release: <span className="info-value">{album.title}</span></div>
                  <div className="info-row">Owned: <span className="info-value">{ownedCount} of {album.tracks.length} Tracks</span></div>
                  <div className="info-row">Format: <span className="info-value">{DOWNLOAD_FORMAT}</span></div>
                  <div className="info-row">Downloaded: <span className="info-value">{lastDownloadText}</span></div>
                  <div className="info-row">Total: <span className="info-value">Free (CHF 0.00)</span></div>
                </div>
              </div>
            </div>,
        document.body
      )}

          {/* Re-Download — Auswahl aus den Tracks, die man besitzt.
              Solange geladen wird, lässt sich das Fenster nicht schließen,
              damit kein angefangener Download verloren geht. */}
          {redlOpen && ReactDOM.createPortal(
        <div
          className={`desc-modal-overlay${redlClosing ? ' closing' : ''}`}
          onClick={closeRedownload}>

              <div
            className="desc-modal redl-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ '--tx': redlOrigin.tx, '--ty': redlOrigin.ty }}>

                {!redlBusy &&
            <button className="desc-modal-close" onClick={closeRedownload} aria-label="Close">
                    <svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" /></svg>
                  </button>
            }
                <div className="redl-title">select tracks</div>

                <div className="redl-list">
                  <label className="redl-row redl-row-all">
                    <span
                className={`redl-box${allSelected ? ' checked' : ''}`}
                role="checkbox"
                aria-checked={allSelected}
                tabIndex={0}
                onClick={() => !redlBusy && toggleAll()}
                onKeyDown={(e) => {if (e.key === ' ' || e.key === 'Enter') {e.preventDefault();!redlBusy && toggleAll();}}} />
                    <span className="redl-num" />
                    <span className="redl-info"><span className="redl-name">ALL</span></span>
                    <span className="redl-state" />
                  </label>

                  {visibleTracks.map((t) => {
                const sel = redlSel.includes(t.id);
                const loading = busy[t.id] !== undefined;
                const done = redlDone.includes(t.id);
                return (
                  <label key={t.id} className="redl-row">
                        <span
                    className={`redl-box${sel ? ' checked' : ''}`}
                    role="checkbox"
                    aria-checked={sel}
                    tabIndex={0}
                    onClick={() => !redlBusy && toggleSel(t.id)}
                    onKeyDown={(e) => {if (e.key === ' ' || e.key === 'Enter') {e.preventDefault();!redlBusy && toggleSel(t.id);}}} />
                        <span className="redl-num">{t.id}</span>
                        <span className="redl-info">
                          <span className="redl-name">{t.title}</span>
                          <span className="redl-artist">{t.artist}</span>
                        </span>
                        <span className="redl-state">
                          {done ? <CheckIcon /> : loading ? <ProgressRing value={busy[t.id]} /> : null}
                        </span>
                      </label>);

              })}
                </div>

                <div className="redl-action">
                  {redlBusy ?
              <div className="dl-circle is-busy redl-spinner"><SpinnerArc /></div> :

              <button
                className="redownload-btn redl-go"
                onClick={handleRedownload}
                disabled={!redlSel.length}>
                      RE-DOWNLOAD
                    </button>
              }
                </div>
                <div className="redl-note">files will download directly to your device.</div>
              </div>
            </div>,
        document.body
      )}

          {/* Dankesfenster — erscheint, wenn dieses Release neu in die
              Library gekommen ist, und wächst aus dem gedrückten Knopf. */}
          {thanksOpen && ReactDOM.createPortal(
        <div
          className={`desc-modal-overlay${thanksClosing ? ' closing' : ''}`}
          onClick={closeThanks}>

              <div
            className="desc-modal thanks-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ '--tx': thanksOrigin.tx, '--ty': thanksOrigin.ty }}>

                <button
              className="desc-modal-close"
              onClick={closeThanks}
              aria-label="Close">

                  <svg viewBox="0 0 24 24"><path d="M5 5l14 14M19 5L5 19" /></svg>
                </button>
                <div className="thanks-title">thank you!</div>
                <div className="thanks-text">
                  The release is now also in your{' '}
                  <button className="thanks-link" onClick={goToLibrary}>library</button>
                  {' '}and available for re-downloads.
                </div>
              </div>
            </div>,
        document.body
      )}
        </div>);

};

// ─── LIBRARY PAGE ───────────────────────────────────────────────────
const LibraryPage = ({ onSelectAlbum }) => {
  // Die Library zeigt ausschließlich, was dieser Besucher heruntergeladen
  // hat — ein einziger geladener Track genügt, damit das Release erscheint.
  useDownloads();
  const albums = ALBUMS.filter((a) => downloads.albumHasDownloads(a.id));
  // Das Logo leuchtet erst, wenn man es antippt — und beim nächsten Aufruf
  // der Seite wieder von vorne, es wird bewusst nichts gemerkt.
  const [lit, setLit] = useState(false);
  return (
    <div className="library-page page-enter">
          <h1 className="library-title">
            <button
              type="button"
              className="library-logo-btn"
              onClick={() => setLit((v) => !v)}
              aria-pressed={lit}
              aria-label={lit ? 'Turn the library sign off' : 'Turn the library sign on'}>
              <img
                className={`library-logo ${lit ? 'is-lit' : ''}`}
                src="/uploads/library-logo.webp"
                alt="Library"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                onContextMenu={(e) => e.preventDefault()} />
            </button>
          </h1>
          {albums.length === 0 ?
      <div className="library-empty">
              <div className="library-empty-title">your library is empty</div>
              <div className="library-empty-sub">Your downloaded music will appear here.<br />You can re-download your files anytime.</div>
            </div> :

      <div className="library-grid">
              {albums.map((a) =>
        <div key={a.id} className="library-card" onClick={() => onSelectAlbum(a)}>
                  <CoverPlaceholder album={a} size={420} />
                  <div className="library-card-title">{a.title}</div>
                  <div className="library-card-artist">{a.artist}</div>
                </div>
        )}
            </div>
      }
        </div>);

};

// ─── NOW PLAYING PLAYER (responsive) ───────────────────────────────
const parseDur = (d) => {
  if (!d) return 0;
  const parts = d.split(':').map(Number);
  return parts.length === 2 ? parts[0] * 60 + parts[1] : parts[0] || 0;
};
const timecode = (sec) => {
  const pad = (n) => String(n).padStart(2, '0');
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const f = Math.floor(sec % 1 * 60); // frames
  return `00:${pad(m)}:${pad(s)}:${pad(f)}`;
};

const NowPlayingBar = ({ track, album, isPlaying, phase, minimized, tweaks, onToggle, onPrev, onNext, onClose, onExpand, progress, currentTime, duration, onSeekTo, onScrubStart, onScrubEnd, canPrev = true }) => {
  // Ziehen am Fortschrittsbalken. Während des Ziehens folgt die Anzeige
  // sofort dem Finger bzw. der Maus, die Musik springt aber erst beim
  // Loslassen — sonst stottert es bei jeder Bewegung.
  // Hooks stehen bewusst VOR dem frühen return, sonst verletzt das die
  // Regeln von React.
  const barRef = useRef(null);
  const [dragFrac, setDragFrac] = useState(null);

  const fracFromEvent = (clientX) => {
    const el = barRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    if (!r.width) return 0;
    return Math.max(0, Math.min(1, (clientX - r.left) / r.width));
  };

  const onPointerDown = (e) => {
    // Pointer einfangen: dadurch laufen Bewegung und Loslassen auch dann
    // hier auf, wenn man beim Ziehen über den Balken hinausgerät.
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    // Einklapp-Timer anhalten: der Player darf während des Ziehens nicht
    // unter dem Finger wegklappen.
    if (onScrubStart) onScrubStart();
    setDragFrac(fracFromEvent(e.clientX));
  };
  const onPointerMove = (e) => {
    if (dragFrac === null) return;
    setDragFrac(fracFromEvent(e.clientX));
  };
  const endDrag = (e) => {
    if (dragFrac === null) return;
    const f = fracFromEvent(e.clientX);
    setDragFrac(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch (err) {}
    if (onSeekTo) onSeekTo(f);
    // Timer läuft ab jetzt wieder von vorne — volle vier Sekunden.
    if (onScrubEnd) onScrubEnd();
  };

  if (phase === 'closed' || !track) return null;
  // Echte Datei-Länge bevorzugen; nur bis Metadaten geladen sind auf die getippte Dauer zurückfallen.
  const total = duration > 0 ? duration : parseDur(track?.duration);
  // Beim Ziehen zeigt der Balken die Zielposition, nicht die laufende.
  const shown = dragFrac !== null ? dragFrac : progress;
  const cur = dragFrac !== null ? total * dragFrac : (duration > 0 ? currentTime : total * progress);
  return (
    <>
        <div
        className={`np-mini ${phase === 'open' && minimized ? 'show' : ''}`}
        onClick={onExpand}
        role="button"
        aria-label="Expand player"
        title={`${track?.title} — ${track?.artist}`} style={{ height: "60px", borderWidth: "2px", width: "60px" }}>
          <EQMini playing={isPlaying} />
        </div>
        <div className={`np-player ${phase === 'closing' ? 'np-closing' : minimized ? 'np-min' : 'np-open'}`} aria-hidden={minimized}>
          <div className="np-inner">
            <div className="np-row">
              <div className="np-controls">
                <button className="np-ctrl" onClick={onPrev} aria-label="Previous"
                  disabled={!canPrev} aria-disabled={!canPrev}><PrevDouble /></button>
                <button className={`np-pp ${isPlaying ? '' : 'show-play'}`} onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
                  {isPlaying ? <PauseThin /> : <PlayThin />}
                </button>
                <button className="np-ctrl" onClick={onNext} aria-label="Next"><NextDouble /></button>
              </div>
              <div className="np-meta">
                <div className="np-title">{track?.title}</div>
                <div className="np-artist">{track?.artist}</div>
              </div>
              <button
              className="np-close"
              onClick={onClose}
              style={{ fontSize: (tweaks?.navFontSize ?? 38) * (tweaks?.navScale ?? 0.55) }}>
            CLOSE</button>
            </div>
            <div
              className={`np-progress ${dragFrac !== null ? 'np-dragging' : ''}`}
              ref={barRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}>
              <div className="np-bar">
                <div className="np-bar-fill" style={{ width: `${shown * 100}%` }} />
                <div className="np-bar-dot" style={{ left: `${shown * 100}%` }} />
              </div>
              <div className="np-times">
                <span>{timecode(cur)}</span>
                <span>{timecode(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </>);

};

// ─── CARGO PAGE ─────────────────────────────────────────────────────
// ─── CARGO: OBJEKTE DER STRECKE ─────────────────────────────────────
// Reihenfolge = Reihenfolge auf der Seite. `side` bestimmt, auf welcher
// Seite das Objekt sitzt, der Text steht jeweils gegenüber. `depth` ist
// der Weg in Pixeln, den das Objekt über eine Fensterhöhe hinweg zurücklegt
// — je größer, desto stärker die Parallaxe und desto mehr zieht es nach.
// `width` ist die Breite in Prozent der Spalte.
// Die Texte sind Beispiele und stehen bewusst noch im Code.
const CARGO_OBJECTS = [
{
  // Die Platte wird nicht als ein Bild geladen, sondern aus vier
  // drehbaren Schichten zusammengesetzt — siehe RECORD_LAYERS.
  src: 'record',
  alt: 'Atlas phonograph record',
  kind: 'record',
  side: 'left', depth: 74, width: 78, tilt: -4,
  caption: 'atlas phonograph record. the oldest one ever found on cargo. the tribes did not play it for pleasure — they knelt around it. sound was the only thing that came from the sky and answered back.'
},
{
  src: '/uploads/cargo-angel.webp',
  alt: 'Cargo angel',
  side: 'right', depth: 44, width: 84, tilt: 3,
  caption: '4394 years old cargo angel. if you see one, you are meant to die — but he will protect you.'
},
{
  src: '/uploads/cargo-pot.webp',
  alt: 'Atlas pot',
  side: 'left', depth: 96, width: 34, tilt: 2,
  caption: 'pot of the atlas sector. crafted by an old civilisation. they buried one with every record, so the music would have something to drink.'
},
{
  src: '/uploads/cargo-mask.webp',
  alt: 'Tribe mask',
  side: 'right', depth: 58, width: 62, tilt: -3,
  caption: 'mask of one of the first tribes in the great desert of atlas, in the hot atlas section. worn only by the one who was allowed to touch the record.'
},
{
  src: '/uploads/cargo-symbol.webp',
  alt: 'Cargo symbol',
  side: 'left', depth: 30, width: 58, tilt: 0,
  caption: 'logo of cargo. scratched into the rock above every listening pit, long before anyone wrote it down.'
}];


// ─── DIE PLATTE ─────────────────────────────────────────────────────
// Antippen startet den Beat. Die Scheibe ist dafür in vier konzentrische
// Schichten zerlegt, die sich unterschiedlich schnell und teils gegenläufig
// drehen. Das Hüpfen nach vorne, der Schein dahinter und die Lichter im
// Hintergrund folgen der vorberechneten Kurve aus beatMotion.js — ohne
// Web Audio, siehe die Erklärung dort.
const RECORD_LAYERS = [
{ src: '/uploads/cargo-record-band.webp', spin: -0.34 },  // dunkles Band, gegenläufig
{ src: '/uploads/cargo-record-rings.webp', spin: 0.19 },  // äußere Ringe, träge mit
{ src: '/uploads/cargo-record-disc.webp', spin: 0.58 },   // Scheibe mit den Speichen
{ src: '/uploads/cargo-record-core.webp', spin: 1.0 }];   // Kern, am schnellsten


const CargoRecord = ({ item, onBeatStart }) => {
  const rootRef = useRef(null);
  const audioRef = useRef(null);
  const liveRef = useRef(false);
  const [live, setLive] = useState(false);

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    const next = !liveRef.current;
    liveRef.current = next;
    setLive(next);
    if (next) {
      if (onBeatStart) onBeatStart();   // laufenden Song anhalten
      beatMotion.load();
      a.loop = true;
      a.volume = 0;                     // wird in der Schleife hochgezogen
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    }
    // Das Anhalten macht die Schleife, damit Ton und Drehung gemeinsam
    // austrudeln statt abrupt abzureißen.
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const layers = Array.from(root.querySelectorAll('.rec-layer'));
    const glow = root.querySelector('.rec-glow');
    const stack = root.querySelector('.rec-stack');
    const factors = layers.map((el) => Number(el.dataset.spin) || 0);

    let raf = 0, last = performance.now(), running = true;
    let spin = 0, energy = 0, hit = 0;
    const vals = [0, 0, 0, 0];

    const tick = (now) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 1 / 30) dt = 1 / 30;

      const a = audioRef.current;
      const want = liveRef.current ? 1 : 0;
      // Weiches Auf- und Abblenden. Beim Ausschalten dauert es länger,
      // damit die Platte sichtbar austrudelt.
      const tau = want ? 0.35 : 0.75;
      energy += (want - energy) * (1 - Math.exp(-dt / tau));

      if (a) {
        a.volume = Math.max(0, Math.min(1, energy));   // Ton blendet mit
        if (!want && energy < 0.02 && !a.paused) a.pause();
      }

      if (energy > 0.005 && a && beatMotion.ready()) {
        beatMotion.sample(a.currentTime, vals);
      } else {
        vals[0] = vals[1] = vals[2] = vals[3] = 0;
      }

      // Schlag-Hüllkurve: springt sofort hoch, fällt gemächlich —
      // dadurch wird aus einem kurzen Impuls ein sichtbarer Stoß.
      hit = Math.max(vals[0], hit - dt * 2.4);

      // Grunddrehung, leicht vom Mittenpegel angetrieben
      spin += (16 + vals[2] * 22) * energy * dt;

      const pop = hit * energy;
      for (let i = 0; i < layers.length; i++) {
        layers[i].style.transform = `rotate(${(spin * factors[i]).toFixed(2)}deg)`;
      }
      if (stack) {
        // Nach vorne aus dem Bild: echte Tiefe plus eine Spur größer.
        stack.style.transform =
        `translate3d(0,${(-pop * 10).toFixed(2)}px,${(pop * 70).toFixed(1)}px) scale(${(1 + pop * 0.05).toFixed(4)})`;
      }
      if (glow) {
        glow.style.opacity = (energy * (0.30 + vals[1] * 0.55)).toFixed(3);
        glow.style.transform = `scale(${(0.82 + vals[1] * 0.3 + pop * 0.12).toFixed(3)})`;
      }

      // Für die Lichter im Hintergrund bereitstellen
      beatMotion.pulse.energy = energy;
      beatMotion.pulse.attack = hit;
      beatMotion.pulse.bass = vals[1];
      beatMotion.pulse.mid = vals[2];
      beatMotion.pulse.high = vals[3];

      if (running) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      beatMotion.pulse.energy = 0;
      const a = audioRef.current;
      if (a) { try { a.pause(); } catch (e) {} }
    };
  }, []);

  return (
    <div className={`cargo-obj cargo-obj-${item.side}`} data-depth={item.depth} data-tilt={item.tilt}>
          <div className="cargo-obj-media" style={{ width: `${item.width}%` }}>
            <button
          type="button"
          className={`rec-btn${live ? ' is-live' : ''}`}
          ref={rootRef}
          onClick={toggle}
          aria-pressed={live}
          aria-label={live ? 'Stop the record' : 'Play the record'}>

              <span className="rec-glow" />
              <span className="rec-stack">
                {RECORD_LAYERS.map((l) =>
            <img
              key={l.src}
              className="rec-layer"
              data-spin={l.spin}
              src={l.src}
              alt=""
              loading="lazy"
              draggable={false} />
            )}
              </span>
              {/* Nur zur Größenbestimmung: gibt dem Stapel seine Höhe. */}
              <img className="rec-sizer" src="/uploads/cargo-record-disc.webp" alt={item.alt} aria-hidden="true" draggable={false} />
              <audio ref={audioRef} src="/uploads/cargo-beat.m4a" preload="none" playsInline />
            </button>
          </div>
          <div className="cargo-obj-caption">
            {item.caption}
            <span className="rec-hint">{live ? '— now playing. tap to stop.' : '— tap the record.'}</span>
          </div>
        </div>);


};

// Farbige Schleier über dem schwarzen Hintergrund des CARGO-Bereichs.
// Sie leben nur, solange der Beat läuft, und atmen mit ihm. Bewusst weiche,
// langsame Verläufe statt harter Blitze — schnelles Blinken kann bei
// lichtempfindlichen Menschen Anfälle auslösen.
const CARGO_LIGHTS = [
{ x: 18, y: 16, size: 46, hue: 320, drift: 13 },
{ x: 78, y: 34, size: 38, hue: 22, drift: -17 },
{ x: 32, y: 62, size: 52, hue: 268, drift: 21 },
{ x: 68, y: 86, size: 40, hue: 200, drift: -11 }];


const CargoLights = () => {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const blobs = Array.from(root.querySelectorAll('.cargo-light'));
    const drift = blobs.map((b) => Number(b.dataset.drift) || 10);
    let raf = 0, t = 0, last = performance.now(), running = true;

    const tick = (now) => {
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 1 / 30) dt = 1 / 30;
      t += dt;

      const p = beatMotion.pulse;
      root.style.opacity = (p.energy * 0.9).toFixed(3);

      for (let i = 0; i < blobs.length; i++) {
        // Langsames Schweben, dazu ein Atmen im Takt. Jede Blase hat ihre
        // eigene Geschwindigkeit, damit nichts synchron wirkt.
        const ph = t * (0.12 + i * 0.037);
        const dx = Math.sin(ph * 1.7 + i) * drift[i];
        const dy = Math.cos(ph * 1.3 + i * 2) * drift[i] * 0.7;
        const band = i % 2 === 0 ? p.bass : p.high;
        const s = 0.8 + band * 0.35 + p.attack * 0.12;
        blobs[i].style.transform =
        `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0) scale(${s.toFixed(3)})`;
        blobs[i].style.opacity = (0.45 + band * 0.45).toFixed(3);
      }
      if (running) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, []);

  return (
    <div className="cargo-lights" ref={ref} aria-hidden="true">
          {CARGO_LIGHTS.map((l, i) =>
      <span
        key={i}
        className="cargo-light"
        data-drift={l.drift}
        style={{
          left: `${l.x}%`, top: `${l.y}%`,
          width: `${l.size}vmax`, height: `${l.size}vmax`,
          background: `radial-gradient(circle, hsla(${l.hue},85%,55%,0.5) 0%, hsla(${l.hue},85%,45%,0.22) 38%, transparent 70%)`
        }} />
      )}
        </div>);


};

// Ein Objekt samt Bildunterschrift. Die Bewegung macht die gemeinsame
// Schleife unten (useCargoMotion), deshalb steht hier nur das Markup.
// Tiefe und Neigung wandern als data-Attribute mit, damit die Schleife sie
// findet, ohne dass React beim Scrollen etwas neu rendern muss.
const CargoObject = ({ item }) =>
<div className={`cargo-obj cargo-obj-${item.side}`} data-depth={item.depth} data-tilt={item.tilt}>
      <div className="cargo-obj-media" style={{ width: `${item.width}%` }}>
        <img
      src={item.src}
      alt={item.alt}
      loading="lazy"
      draggable={false}
      onDragStart={(e) => e.preventDefault()}
      onContextMenu={(e) => e.preventDefault()} />
      </div>
      <div className="cargo-obj-caption">{item.caption}</div>
    </div>;


// ─── BEWEGUNG DER OBJEKTSTRECKE ─────────────────────────────────────
// Erster Versuch hing die Bewegung an der Scroll-GESCHWINDIGKEIT. Die
// springt aber bei jedem Mausrad-Klick sprunghaft, und das übertrug sich
// als Zucken auf die Objekte.
//
// Jetzt hängt das Ziel allein an der Scroll-POSITION — eine ruhige, stetige
// Größe ohne Sprünge. Darauf sitzt eine träge Feder: Sie kommt beim
// schnellen Scrollen nicht hinterher, dadurch entsteht das Schleifen ganz
// von selbst. Und wenn das Scrollen aufhört — auch unten am Ende —,
// schwingt sie einmal sanft über und kommt zur Ruhe. Das ist das Abprallen.
//
// Die Feder rechnet mit echter Zeit statt pro Bild. Auf einem 120-Hz-iPhone
// läuft sie dadurch genauso schnell ab wie auf einem 60-Hz-Monitor.
function useCargoMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const scroller = root.closest('.page');
    if (!scroller) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const nodes = Array.from(root.querySelectorAll('.cargo-obj'));
    if (!nodes.length) return;

    const items = nodes.map((el) => ({
      el,
      // Bewusst der ganze Medien-Container, nicht das erste Bild darin.
      // Die Platte besteht aus mehreren übereinanderliegenden Bildern —
      // würde hier nur eines verschoben, risse der Stapel auseinander,
      // und die Drehung der Platte und die Scroll-Bewegung würden sich
      // gegenseitig überschreiben.
      media: el.querySelector('.cargo-obj-media'),
      caption: el.querySelector('.cargo-obj-caption'),
      depth: Number(el.dataset.depth) || 40,
      tilt: Number(el.dataset.tilt) || 0,
      top: 0, height: 0,
      y: 0, v: 0, ty: 0, tv: 0
    }));

    let viewH = scroller.clientHeight || 1;
    const measure = () => {
      viewH = scroller.clientHeight || 1;
      const base = scroller.getBoundingClientRect().top - scroller.scrollTop;
      for (const it of items) {
        const r = it.el.getBoundingClientRect();
        it.top = r.top - base;
        it.height = r.height;
      }
    };
    measure();

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(root);
    window.addEventListener('resize', measure);

    // 0.8 Hz ist bewusst langsam, die Dämpfung knapp unter 1 lässt sie
    // einmal weich überschwingen statt hart einzurasten.
    const FREQ = 0.8;
    const ZETA = 0.7;
    const W = 2 * Math.PI * FREQ;

    let raf = 0, last = performance.now(), running = true;

    const tick = (now) => {
      let dt = (now - last) / 1000;
      last = now;
      // Nach einem Tabwechsel kommt ein riesiger Sprung — abfangen, sonst
      // schießt die Feder aus dem Bild.
      if (dt > 1 / 30) dt = 1 / 30;

      const scroll = scroller.scrollTop;

      for (const it of items) {
        // Abstand der Objektmitte zur Bildschirmmitte, auf die Fensterhöhe
        // normiert: oben etwa -1, in der Mitte 0, unten etwa +1.
        const offset = (it.top + it.height / 2 - scroll - viewH / 2) / viewH;
        const target = offset * it.depth;
        const targetText = target * 0.4;   // Text zieht schwächer nach

        it.v += (W * W * (target - it.y) - 2 * ZETA * W * it.v) * dt;
        it.y += it.v * dt;
        it.tv += (W * W * (targetText - it.ty) - 2 * ZETA * W * it.tv) * dt;
        it.ty += it.tv * dt;

        if (it.media) {
          it.media.style.transform =
          `translate3d(0, ${it.y.toFixed(2)}px, 0) rotate(${it.tilt}deg)`;
        }
        if (it.caption) {
          it.caption.style.transform = `translate3d(0, ${it.ty.toFixed(2)}px, 0)`;
        }
      }
      if (running) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      if (ro) ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
}

const CargoPage = ({ onBeatStart }) => {
  const pageRef = useRef(null);
  useCargoMotion(pageRef);
  return (
    <div className="cargo-page page-enter" ref={pageRef}>
        <div className="cargo-section-label">THE LABEL</div>
        <div className="section-divider" />
        <img
    src="/uploads/cargologo_clean.svg"
    alt="CARGO"
    draggable={false}
    onDragStart={(e) => e.preventDefault()}
    onContextMenu={(e) => e.preventDefault()}
    style={{
      width: '100%',
      maxWidth: 520,
      display: 'block',
      marginBottom: 40,
      filter: `brightness(0) saturate(100%) invert(35%) sepia(80%) saturate(800%) hue-rotate(345deg)`
    }} />
  
        {/* Kommt aus dem Admin unter TEXTS, Schlüssel `label_text`.
            Solange dort nichts steht, greift der Text aus siteTexts.js.
            Absätze entstehen durch Leerzeilen, das erledigt das CSS. */}
        <div className="cargo-text">{siteText(SITE, 'label_text')}</div>
        {/* Übergang vom echten Label in die erfundene Welt: Planet und
            Erzähltext leiten die Objektstrecke ein. */}
        <div className="cargo-world">
          <div className="cargo-planet">
            <img
        src="/uploads/cargo-planet.webp"
        alt="Cargo"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()} />
          </div>
          <div className="cargo-world-text">
            Cargo drifts along the forgotten routes of the outer systems,
            carrying resources, relics, and secrets between distant stars.
            Its vast industrial surface glows beneath perpetual twilight,
            earning it the title: The Lifeline of the Frontier.
          </div>
        </div>

        <div className="cargo-objects">
          {CARGO_OBJECTS.map((item) =>
    item.kind === 'record' ?
    <CargoRecord key={item.src} item={item} onBeatStart={onBeatStart} /> :
    <CargoObject key={item.src} item={item} />
    )}
        </div>

        <div className="cargo-outro">
          relics recovered from the atlas sector — catalogued by CARGO.
        </div>
      </div>);

};


// ─── STORE PAGE ─────────────────────────────────────────────────────
const StorePage = () =>
<div className="store-page page-enter">
        <div className="store-soon">
          <div className="cargo-section-label">CARGO STORE</div>
          <div className="section-divider" style={{ margin: '12px auto 24px' }} />
          <h1>STORE</h1>
          <p>SOON</p>
        </div>
        <div className="store-grid">
          {['TEE 001', 'TEE 002', 'HOODIE 001', 'CAP 001'].map((item) =>
    <div key={item} className="store-item">
              <span>[ clothing photo ]</span>
              <span className="soon-tag">SOON</span>
              <span style={{ color: '#333', fontSize: 10, letterSpacing: '0.2em' }}>{item}</span>
            </div>
    )}
        </div>
      </div>;


// ─── CONTACT PAGE ───────────────────────────────────────────────────
const ContactPage = () => {
  const [sent, setSent] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', message: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSent(true);
  };

  if (sent) return (
    <div className="contact-page page-enter" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 'calc(100dvh - 72px)' }}>
          <div className="cargo-section-label">MESSAGE SENT</div>
          <div className="section-divider" />
          <h1>THANKS.</h1>
          <p style={{ fontFamily: 'monospace', fontSize: 12, color: '#666', letterSpacing: '0.1em', lineHeight: 1.8 }}>
            Your message has been received.<br />
            We'll get back to you shortly.
          </p>
        </div>);


  return (
    <div className="contact-page page-enter">
          <div className="cargo-section-label">GET IN TOUCH</div>
          <div className="section-divider" />
          <h1>CONTACT</h1>
          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="your name" />
            </div>
            <div className="form-group">
              <label>E-Mail</label>
              <input type="email" required value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="your@email.com" />
            </div>
            <div className="form-group">
              <label>Message</label>
              <textarea required value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} placeholder="write your message..." />
            </div>
            <button type="submit" className="submit-btn">SEND →</button>
          </form>
        </div>);

};

// ─── APP ────────────────────────────────────────────────────────────
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentColor": "#ec5600",
  "bgColor": "#000000",
  "fontScale": 1,
  "scanlines": true,
  "glowEffect": true,
  "navFontSize": 38,
  "navBoxWidth": 240,
  "navBoxPadding": 16,
  "navGap": 16,
  "navVerticalOffset": -16,
  "navScale": 0.55,
  "albumTitleSize": 28,
  "albumTitleOffset": -4,
  "albumTitleMarginBottom": 0,
  "albumTitleLetterSpacing": 0.16,
  "carouselSideVisibility": 0.95,
  "landingLabel": "",
  "landingTitle": "",
  "landingSubtitle": "",
  "landingBtn": "ENTER"
} /*EDITMODE-END*/;

const App = () => {
  // Neu rendern, sobald sich der Download-Stand ändert — davon hängt
  // unter anderem ab, ob die Library-Seite gescrollt werden darf.
  useDownloads();
  const [screen, setScreen] = useState('landing');
  const [prevScreen, setPrevScreen] = useState('landing');
  const [navOpen, setNavOpen] = useState(false);
  const [bagOpen, setBagOpen] = useState(false);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [musicActive, setMusicActive] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [currentAlbum, setCurrentAlbum] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [audioCur, setAudioCur] = useState(0);
  const [audioDur, setAudioDur] = useState(0);
  const [playerPhase, setPlayerPhase] = useState('closed');
  const [minimized, setMinimized] = useState(false);
  const closeTimerRef = useRef(null);
  const miniTimerRef = useRef(null);
  const audioRef = useRef(null);

  // After 4s of resting, the open player collapses into a circle.
  const MINI_DELAY = 4000;

  // Klappt den Player aus und startet die Zeit bis zum Einklappen neu.
  // Nur für bewusste Aktionen des Nutzers — etwa das Antippen eines Liedes
  // in der Trackliste.
  const scheduleMinimize = useCallback(() => {
    if (miniTimerRef.current) clearTimeout(miniTimerRef.current);
    setMinimized(false);
    miniTimerRef.current = setTimeout(() => setMinimized(true), MINI_DELAY);
  }, []);

  // Startet nur die Zeit neu, ohne an der Form des Players zu rühren.
  // Wichtig für alles, was von allein passiert: Ein Liedwechsel soll einen
  // eingeklappten Player nicht plötzlich aufklappen.
  const restartMinimizeTimer = useCallback(() => {
    if (miniTimerRef.current) clearTimeout(miniTimerRef.current);
    miniTimerRef.current = setTimeout(() => setMinimized(true), MINI_DELAY);
  }, []);

  // Solange am Regler gezogen wird, darf nichts einklappen.
  const holdMinimize = useCallback(() => {
    if (miniTimerRef.current) clearTimeout(miniTimerRef.current);
  }, []);

  useEffect(() => () => {
    if (miniTimerRef.current) clearTimeout(miniTimerRef.current);
  }, []);

  // Tweaks
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Apply tweaks to CSS vars
  useEffect(() => {
    document.documentElement.style.setProperty('--red', tweaks.accentColor);
    document.documentElement.style.setProperty('--black', tweaks.bgColor);
    document.documentElement.style.fontSize = `${tweaks.fontScale * 100}%`;
  }, [tweaks.accentColor, tweaks.bgColor, tweaks.fontScale]);

  // Persist screen
  useEffect(() => {
    try {
      const saved = localStorage.getItem('cargo_screen');
      const valid = ['hub', 'music', 'library', 'cargo', 'store', 'contact'];
      if (saved && valid.includes(saved)) setScreen(saved);
    } catch (e) {
      localStorage.removeItem('cargo_screen');
    }
  }, []);
  useEffect(() => {
    if (screen !== 'landing') localStorage.setItem('cargo_screen', screen);
  }, [screen]);

  // Progress is animated inside NowPlayingBar via requestAnimationFrame (smooth,
  // frame-rate independent, no per-frame React re-renders). App's `progress` is
  // only the seek/reset command; the bar reports track-end via onEnded.

  // Das Audio-Element für die EQ-Balken bekannt machen. Mehr passiert hier
  // nicht — kein Web Audio, kein crossOrigin. Genau deshalb darf iOS im
  // Hintergrund weiterspielen.
  useEffect(() => { playbackEl = audioRef.current; }, []);

  // Frequenzdaten des laufenden Tracks nachladen (erst beim Abspielen).
  // Tracks ohne Analyse liefern null — dann laufen die Balken auf der
  // CSS-Animation weiter, es geht also nichts kaputt.
  useEffect(() => {
    const id = currentTrack?.dbId;
    if (!id) { eqData.clear(); return; }
    eqData.beginLoad();
    let cancelled = false;
    loadTrackEq(id).then((json) => { if (!cancelled) eqData.setTrack(json); });
    return () => { cancelled = true; };
  }, [currentTrack]);

  // ── Echter Audio-Player ───────────────────────────────────────────
  // Lädt die R2-Datei des aktuellen Tracks und spielt/pausiert sie.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    setAudioCur(0); setAudioDur(0);
    const url = currentTrack?.file || '';
    if (url) {
      if (a.getAttribute('src') !== url) { a.src = url; a.load(); }
    } else {
      a.removeAttribute('src');
      a.load();
    }
  }, [currentTrack]);

  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    if (isPlaying && currentTrack?.file) {
      const p = a.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      a.pause();
    }
  }, [isPlaying, currentTrack]);

  const handleTimeUpdate = () => {
    const a = audioRef.current;
    if (a && a.duration) {
      setProgress(a.currentTime / a.duration);
      setAudioCur(a.currentTime);
      setAudioDur(a.duration);
      if ('mediaSession' in navigator && navigator.mediaSession.setPositionState) {
        try {
          navigator.mediaSession.setPositionState({
            duration: a.duration,
            position: a.currentTime,
            playbackRate: a.playbackRate || 1,
          });
        } catch (e) {}
      }
    }
  };

  const navigate = (page) => {
    setPrevScreen(screen);
    setScreen(page);
    setSelectedAlbum(null);
    if (page === 'landing') localStorage.removeItem('cargo_screen');
  };

  const handleClosePlayer = () => {
    setIsPlaying(false);
    if (miniTimerRef.current) clearTimeout(miniTimerRef.current);
    setMinimized(false);
    setPlayerPhase('closing');
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setPlayerPhase('closed'), 1050);
  };

  const handlePlay = (track, album) => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setPlayerPhase('open');
    if (currentTrack?.id === track.id && currentAlbum?.id === album.id) {
      setIsPlaying((p) => !p);
    } else {
      setCurrentTrack({ ...track, albumId: album.id });
      setCurrentAlbum(album);
      setIsPlaying(true);
      setProgress(0);
    }
    scheduleMinimize();
  };

  // Position des laufenden Liedes innerhalb seines Albums.
  // -1, solange nichts läuft.
  const trackIndex = (currentAlbum && currentTrack)
    ? currentAlbum.tracks.findIndex((t) => t.id === currentTrack.id)
    : -1;
  // Beim ersten Lied gibt es nichts davor — weder bei einem Album noch
  // bei einer Single. Der Knopf wird dann gesperrt und ausgegraut.
  const canPrev = trackIndex > 0;

  const handlePrev = () => {
    if (!currentAlbum || !currentTrack || !canPrev) return;
    const prev = currentAlbum.tracks[trackIndex - 1];
    if (!prev) return;
    setCurrentTrack({ ...prev, albumId: currentAlbum.id });
    setProgress(0);setIsPlaying(true);
    restartMinimizeTimer();
  };

  // Weiter-Knopf von Hand: bricht am Albumende bewusst um und fängt wieder
  // oben an. Bei einer Single mit nur einem Lied startet er es neu.
  const handleNext = () => {
    if (!currentAlbum || !currentTrack) return;
    const idx = currentAlbum.tracks.findIndex((t) => t.id === currentTrack.id);
    const next = currentAlbum.tracks[(idx + 1) % currentAlbum.tracks.length];
    setCurrentTrack({ ...next, albumId: currentAlbum.id });
    setProgress(0);setIsPlaying(true);
    const a = audioRef.current;
    // Gleicher Track (Single): das Element springt sonst nicht von selbst
    // an den Anfang, weil sich die Quelle nicht ändert.
    if (a && next && currentTrack && next.id === currentTrack.id) {
      try { a.currentTime = 0; } catch (e) {}
    }
    restartMinimizeTimer();
  };

  // Ein Lied ist von allein zu Ende gelaufen.
  // Innerhalb eines Albums geht es weiter — nach dem letzten Lied stellt
  // sich der Player auf das erste Lied zurück, startet es aber NICHT.
  // Es steht dann pausiert auf 0:00 bereit. Die Form des Players (offen
  // oder eingeklappt) bleibt dabei unverändert.
  const handleTrackEnd = () => {
    if (!currentAlbum || !currentTrack) { setIsPlaying(false); return; }
    const idx = currentAlbum.tracks.findIndex((t) => t.id === currentTrack.id);
    const isLast = idx < 0 || idx >= currentAlbum.tracks.length - 1;
    if (isLast) {
      const first = currentAlbum.tracks[0];
      setIsPlaying(false);
      setProgress(0);
      setAudioCur(0);
      // Bei einer Single ist das erste Lied dasselbe — dann ändert sich
      // die Quelle nicht, und die Zeit muss von Hand zurückgesetzt werden.
      const a = audioRef.current;
      if (a) { try { a.currentTime = 0; } catch (e) {} }
      if (first) setCurrentTrack({ ...first, albumId: currentAlbum.id });
      return;
    }
    const next = currentAlbum.tracks[idx + 1];
    setCurrentTrack({ ...next, albumId: currentAlbum.id });
    setProgress(0);setIsPlaying(true);
    // Bewusst kein Ein-/Ausklappen: ein Liedwechsel von allein darf
    // die Form des Players nicht verändern.
  };

  // Zielposition als Bruchteil 0..1 — kommt vom Klick oder vom Loslassen
  // nach dem Ziehen am Regler.
  const handleSeekTo = (frac) => {
    const f = Math.max(0, Math.min(1, frac || 0));
    setProgress(f);
    const a = audioRef.current;
    if (a && a.duration && isFinite(a.duration)) {
      try { a.currentTime = f * a.duration; } catch (e) {}
      setAudioCur(a.currentTime);
    }
  };

  // ── Media Session: Cover/Titel/Artist auf Sperrbildschirm & OS-Player ──
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack || !currentAlbum) return;
    const cover = COVER_IMAGES[currentAlbum.id] || '';
    const art = /^(https?:)?\/\//.test(cover) ? cover : (cover ? window.location.origin + cover : '');
    try {
      navigator.mediaSession.metadata = new window.MediaMetadata({
        title: currentTrack.title || '',
        artist: currentTrack.artist || currentAlbum.artist || '',
        album: currentAlbum.title || '',
        artwork: art ? [
          { src: art, sizes: '512x512' },
          { src: art, sizes: '256x256' },
          { src: art, sizes: '96x96' },
        ] : [],
      });
      navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
      navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
      // Beim ersten Lied den Zurück-Knopf abmelden: Sperrbildschirm und
      // Kontrollzentrum blenden ihn dann von selbst aus — dasselbe
      // Verhalten wie im Player auf der Seite.
      navigator.mediaSession.setActionHandler('previoustrack', canPrev ? () => handlePrev() : null);
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
      navigator.mediaSession.setActionHandler('seekto', (d) => {
        const a = audioRef.current;
        if (a && d.seekTime != null) { a.currentTime = d.seekTime; }
      });
    } catch (e) {}
  }, [currentTrack, currentAlbum, canPrev]);

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [isPlaying]);

  const showHeader = screen !== 'landing';
  const showPlayer = currentTrack !== null;

  // Wie viel Platz muss unten freibleiben, damit der Player die letzte
  // Zeile einer Seite nicht verdeckt? Statt einen festen Wert zu raten,
  // messen wir die tatsächliche Höhe des Players und geben sie als
  // CSS-Variable weiter. Ohne Player bleibt gar kein toter Raum übrig.
  useEffect(() => {
    const messen = () => {
      let h = 0;
      if (playerPhase === 'open') {
        const el = document.querySelector(minimized ? '.np-mini' : '.np-player');
        if (el) {
          const r = el.getBoundingClientRect();
          // Der ausgeklappte Player ist ein Verlauf mit viel Luft oben —
          // der untere, tatsächlich deckende Teil zählt.
          h = Math.min(r.height, window.innerHeight * 0.34) + 20;
        }
      }
      document.documentElement.style.setProperty('--player-space', `${Math.round(h)}px`);
    };
    // Nach dem Aus- und Einklappen einmal nachmessen, die Bewegung dauert.
    messen();
    const t = setTimeout(messen, 420);
    window.addEventListener('resize', messen);
    return () => { clearTimeout(t); window.removeEventListener('resize', messen); };
  }, [playerPhase, minimized, currentTrack]);
  const hamburgerOpen = screen === 'hub';
  // Leere Library-Übersicht (nicht die Detailansicht eines Albums) —
  // steuert unten die Scrollsperre.
  const libraryEmpty = !selectedAlbum && !ALBUMS.some((a) => downloads.albumHasDownloads(a.id));

  const handleMenuOpen = () => {
    if (screen === 'hub') {
      // X pressed — go back to previous page
      const back = prevScreen === 'hub' || prevScreen === 'landing' ? 'landing' : prevScreen;
      navigate(back);
    } else {
      navigate('hub');
    }
  };

  return (
    <>
          {screen === 'landing' &&
      <LandingPage onEnter={() => setScreen('hub')} scanlines={tweaks.scanlines} glow={tweaks.glowEffect} tweaks={tweaks} />
      }

          {showHeader &&
      <Header onMenuOpen={handleMenuOpen} onNavigate={navigate} onBagOpen={() => setBagOpen(true)} navOpen={hamburgerOpen} />
      }

          {screen === 'hub' &&
      <div className="main-page">
              <HubPage onNavigate={navigate} tweaks={tweaks} />
            </div>
      }

          {screen === 'music' &&
      <div className={`main-page ${selectedAlbum ? 'page' : 'page page-locked'}`}>
              {!selectedAlbum ?
        <MusicGallery active={musicActive} onActiveChange={setMusicActive} onSelectAlbum={(a) => setSelectedAlbum(a)} tweaks={tweaks} /> :
        <AlbumDetail
          album={selectedAlbum}
          onBack={() => setSelectedAlbum(null)}
          onPlay={handlePlay}
          currentTrack={currentTrack}
          isPlaying={isPlaying}
          onGoLibrary={() => { setSelectedAlbum(null); navigate('library'); }} />

        }
            </div>
      }

          {/* Leere Library: nichts zu scrollen, also wird der Scroll-
              Container gesperrt — dieselbe Klasse, die auch die MUSIC-
              Section festhält. Sobald Releases drin sind, darf gescrollt
              werden, sonst wären die unteren nicht erreichbar. */}
          {screen === 'library' &&
      <div className={`main-page page${libraryEmpty ? ' page-locked' : ''}`}>
              {!selectedAlbum ?
        <LibraryPage onSelectAlbum={(a) => setSelectedAlbum(a)} /> :
        <AlbumDetail
          album={selectedAlbum}
          variant="library"
          onBack={() => setSelectedAlbum(null)}
          onPlay={handlePlay}
          currentTrack={currentTrack}
          isPlaying={isPlaying} />

        }
            </div>
      }

          {screen === 'cargo' &&
      <div className="main-page page">
              {/* Die Lichter stehen bewusst AUSSERHALB von CargoPage:
                  Dort läuft die Einblend-Animation mit transform, und
                  innerhalb eines transformierten Elements bezieht sich
                  `fixed` nicht mehr auf den Bildschirm, sondern auf
                  dieses Element. */}
              <CargoLights />
              <CargoPage onBeatStart={() => setIsPlaying(false)} />
            </div>
      }
          {screen === 'store' && <div className="main-page page"><StorePage /></div>}
          {screen === 'contact' && <div className="main-page page contact-page-wrap"><ContactPage /></div>}

          <MediaPanel open={bagOpen} onClose={() => setBagOpen(false)} />

          <NowPlayingBar
        track={currentTrack}
        album={currentAlbum}
        isPlaying={isPlaying}
        phase={playerPhase}
        minimized={minimized}
        tweaks={tweaks}
        onToggle={() => setIsPlaying((p) => !p)}
        onPrev={handlePrev}
        canPrev={canPrev}
        onNext={handleNext}
        onClose={handleClosePlayer}
        onExpand={scheduleMinimize}
        progress={progress}
        currentTime={audioCur}
        duration={audioDur}
        onSeekTo={handleSeekTo}
        onScrubStart={holdMinimize}
        onScrubEnd={restartMinimizeTimer} />

          {/* Ganz normales <audio>: kein crossOrigin, kein Web Audio.
              Genau so darf iOS im Hintergrund weiterspielen. */}
          <audio
        ref={audioRef}
        preload="metadata"
        playsInline
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => { const a = audioRef.current; if (a && isFinite(a.duration)) setAudioDur(a.duration); }}
        onEnded={handleTrackEnd}
        style={{ display: 'none' }} />


          <TweaksPanel>
            <TweakSection label="Colours">
              <TweakColor id="accentColor" label="Accent" value={tweaks.accentColor} onChange={(v) => setTweak('accentColor', v)} />
              <TweakColor id="bgColor" label="Background" value={tweaks.bgColor} onChange={(v) => setTweak('bgColor', v)} />
            </TweakSection>
            <TweakSection label="Typography">
              <TweakSlider id="fontScale" label="Font Scale" value={tweaks.fontScale} min={0.8} max={1.3} step={0.05} onChange={(v) => setTweak('fontScale', v)} />
            </TweakSection>
            <TweakSection label="Nav Buttons">
              <TweakSlider id="navFontSize" label="Font Size" value={tweaks.navFontSize} min={14} max={52} step={1} onChange={(v) => setTweak('navFontSize', v)} />
              <TweakSlider id="navBoxWidth" label="Box Width" value={tweaks.navBoxWidth} min={160} max={600} step={4} onChange={(v) => setTweak('navBoxWidth', v)} />
              <TweakSlider id="navBoxPadding" label="Box Height" value={tweaks.navBoxPadding} min={8} max={48} step={1} onChange={(v) => setTweak('navBoxPadding', v)} />
              <TweakSlider id="navScale" label="Scale (all)" value={tweaks.navScale} min={0.3} max={2} step={0.05} onChange={(v) => setTweak('navScale', v)} />
              <TweakSlider id="navGap" label="Spacing" value={tweaks.navGap} min={8} max={80} step={2} onChange={(v) => setTweak('navGap', v)} />
              <TweakSlider id="navVerticalOffset" label="Vertical Position" value={tweaks.navVerticalOffset} min={-300} max={300} step={4} onChange={(v) => setTweak('navVerticalOffset', v)} />
            </TweakSection>
            <TweakSection label="Album Title">
              <TweakSlider id="carouselSideVisibility" label="Side Cover Visibility" value={tweaks.carouselSideVisibility} min={0.1} max={1.0} step={0.05} onChange={(v) => setTweak('carouselSideVisibility', v)} />
              <TweakSlider id="albumTitleSize" label="Font Size" value={tweaks.albumTitleSize} min={8} max={48} step={1} onChange={(v) => setTweak('albumTitleSize', v)} />
              <TweakSlider id="albumTitleOffset" label="Top Offset" value={tweaks.albumTitleOffset} min={-60} max={80} step={2} onChange={(v) => setTweak('albumTitleOffset', v)} />
              <TweakSlider id="albumTitleMarginBottom" label="Bottom Spacing" value={tweaks.albumTitleMarginBottom} min={0} max={60} step={2} onChange={(v) => setTweak('albumTitleMarginBottom', v)} />
              <TweakSlider id="albumTitleLetterSpacing" label="Letter Spacing" value={tweaks.albumTitleLetterSpacing} min={0} max={0.8} step={0.02} onChange={(v) => setTweak('albumTitleLetterSpacing', v)} />
            </TweakSection>
            <TweakSection label="Landing Page">
              <TweakText id="landingLabel" label="Label" value={tweaks.landingLabel} onChange={(v) => setTweak('landingLabel', v)} />
              <TweakText id="landingTitle" label="Title" value={tweaks.landingTitle} onChange={(v) => setTweak('landingTitle', v)} />
              <TweakText id="landingSubtitle" label="Subtitle" value={tweaks.landingSubtitle} onChange={(v) => setTweak('landingSubtitle', v)} />
              <TweakText id="landingBtn" label="Button" value={tweaks.landingBtn} onChange={(v) => setTweak('landingBtn', v)} />
            </TweakSection>
            <TweakSection label="Effects">
              <TweakToggle id="scanlines" label="Scanlines" value={tweaks.scanlines} onChange={(v) => setTweak('scanlines', v)} />
              <TweakToggle id="glowEffect" label="Landing Glow" value={tweaks.glowEffect} onChange={(v) => setTweak('glowEffect', v)} />
            </TweakSection>
          </TweaksPanel>
        </>);

};

// ── Global cover-art drag/copy guard ─────────────────────────────────
// Belt-and-suspenders to the CSS user-drag rule: catches Firefox (which
// ignores -webkit-user-drag) and any image-bearing element, on every
// device/browser, so covers can never be dragged out or pulled to the
// desktop / another app. Library swipe + tap gestures are unaffected.
// Now extended to EVERY image/logo on the site, not just album covers.
const __isCover = (el) =>
el && el.tagName === 'IMG';

document.addEventListener('dragstart', (e) => {
  if (__isCover(e.target)) e.preventDefault();
}, true);

// Block the native long-press / right-click "save / copy image" path on covers.
document.addEventListener('contextmenu', (e) => {
  if (__isCover(e.target)) e.preventDefault();
}, true);



export default App;
