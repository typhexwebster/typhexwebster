import React from 'react';
import ReactDOM from 'react-dom';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRow, TweakSlider, TweakToggle,
  TweakRadio, TweakSelect, TweakText, TweakNumber, TweakColor, TweakButton
} from './tweaks-panel.jsx';
import { ALBUMS, LIBRARY_IDS, COVER_IMAGES, GALLERY, SITE } from './content.js';



const { useState, useEffect, useRef, useCallback } = React;

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


const EQ = () =>
<div className="eq">
        <div className="eq-bar" />
        <div className="eq-bar" />
        <div className="eq-bar" />
      </div>;


// ─── COVER PLACEHOLDER ──────────────────────────────────────────────
// COVER_IMAGES -> aus content.js

const CoverPlaceholder = ({ album, size = 280 }) => {
  const imgSrc = COVER_IMAGES[album.id];
  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt={album.title}
        className="protected-cover"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        style={{
          width: size, maxWidth: '100%',
          aspectRatio: '1 / 1', height: 'auto',
          objectFit: 'cover',
          display: 'block',
          flexShrink: 0
        }} />);


  }
  const colors = {
    'psy-atlas': ['#8B3A1A', '#C65A20', '#4A1A0A'],
    'twin-sun-static': ['#C65A20', '#DAA520', '#4A2A00']
  };
  const [c1, c2, c3] = colors[album.id] || ['#333', '#555', '#111'];
  return (
    <div style={{
      width: size, height: size,
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

// ─── MEDIA PANEL ────────────────────────────────────────────────────
const MediaPanel = ({ open, onClose }) => {
  const [tab, setTab] = React.useState('images');
  const [lightboxIdx, setLightboxIdx] = React.useState(null);
  const [items, setItems] = React.useState(GALLERY);

  const ImageIcon = () =>
  <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg>;

  const VideoIcon = () =>
  <svg viewBox="0 0 24 24"><rect x="2" y="4" width="15" height="16" rx="2" /><path d="M17 8l5-3v14l-5-3V8z" /></svg>;

  const PlusIcon = () =>
  <svg viewBox="0 0 24 24" stroke="#444" strokeWidth="1.2" fill="none" style={{ width: 20, height: 20 }}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>;


  const currentItems = items[tab];
  const imgItems = currentItems.filter((i) => i.src);

  const openLightbox = (idx) => setLightboxIdx(idx);
  const closeLightbox = () => setLightboxIdx(null);
  const lbPrev = () => setLightboxIdx((i) => (i - 1 + imgItems.length) % imgItems.length);
  const lbNext = () => setLightboxIdx((i) => (i + 1) % imgItems.length);

  // keyboard nav
  React.useEffect(() => {
    if (lightboxIdx === null) return;
    const onKey = (e) => {
      if (e.key === 'ArrowLeft') lbPrev();
      if (e.key === 'ArrowRight') lbNext();
      if (e.key === 'Escape') closeLightbox();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lightboxIdx]);

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
                  <p>No {tab} yet.<br />Click + to add</p>
                </div> :

          <div className="media-grid">
                  {currentItems.map((item, idx) => {
              const imgIdx = imgItems.indexOf(item);
              return (
                <div key={item.id} className="media-cell" onClick={() => item.src && openLightbox(imgIdx)} style={{ cursor: item.src ? 'pointer' : 'default' }}>
                      <div className="media-cell-overlay" />
                      {item.src ?
                  <img src={item.src} alt={item.label} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} /> :

                  <div className="media-cell-icon">
                          {item.type === 'image' ? <ImageIcon /> : <VideoIcon />}
                        </div>
                  }
                      {!item.src && <span>{item.label}</span>}
                      <div className="media-cell-label">{item.src ? item.label : 'click to replace'}</div>
                    </div>);

            })}
                  <button
              className="media-add-btn"
              onClick={() => {
                const id = Date.now();
                const label = `${tab.slice(0, -1)} 0${currentItems.length + 1}`;
                setItems((prev) => ({
                  ...prev,
                  [tab]: [...prev[tab], { id, type: tab.slice(0, -1), label }]
                }));
              }}>
              
                    <PlusIcon /> &nbsp; ADD {tab.slice(0, -1).toUpperCase()}
                  </button>
                </div>
          }
            </div>
          </div>

        {lightboxIdx !== null && imgItems[lightboxIdx] &&
      <div className="lightbox" onClick={closeLightbox}>
            <img
          className="lightbox-img"
          src={imgItems[lightboxIdx].src}
          alt={imgItems[lightboxIdx].label}
          onClick={(e) => e.stopPropagation()} />
        
            <button className="lightbox-close" onClick={closeLightbox}>
              <svg viewBox="0 0 24 24" fill="none"><line x1="4" y1="4" x2="20" y2="20" /><line x1="20" y1="4" x2="4" y2="20" /></svg>
            </button>
            {imgItems.length > 1 &&
        <>
                <button className="lightbox-arrow prev" onClick={(e) => {e.stopPropagation();lbPrev();}}>
                  <svg viewBox="0 0 24 24"><polyline points="15,18 9,12 15,6" /></svg>
                </button>
                <button className="lightbox-arrow next" onClick={(e) => {e.stopPropagation();lbNext();}}>
                  <svg viewBox="0 0 24 24"><polyline points="9,18 15,12 9,6" /></svg>
                </button>
              </>
        }
            <div className="lightbox-label">{lightboxIdx + 1} / {imgItems.length} — {imgItems[lightboxIdx].label}</div>
          </div>
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
const AlbumDetail = ({ album, onBack, onPlay, currentTrack, isPlaying, variant = 'music' }) => {
  const isLibrary = variant === 'library';
  const [descOpen, setDescOpen] = useState(false);
  const [descClosing, setDescClosing] = useState(false);
  const [descOrigin, setDescOrigin] = useState({ tx: '0px', ty: '0px' });
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoClosing, setInfoClosing] = useState(false);
  const [infoOrigin, setInfoOrigin] = useState({ tx: '0px', ty: '0px' });

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

  const handleRedownload = () => {

    /* no function for now */};

  const handleDownloadAll = () => {
    alert('Download all: Dateien werden bereitgestellt sobald MP3s hochgeladen sind.');
  };

  const handleDownloadTrack = async (track) => {
    if (!track.file) {
      alert(`Download: "${track.title}" — Audiodatei noch nicht hochgeladen.`);
      return;
    }
    const ext = (track.file.split('.').pop() || 'm4a').split('?')[0].slice(0, 4);
    const filename = `${track.title}.${ext}`;
    try {
      // Blob-Download erzwingt das Speichern (auch über Domain-Grenzen).
      const res = await fetch(track.file);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) {
      // Fallback: direkter Link (öffnet ggf. in neuem Tab)
      const a = document.createElement('a');
      a.href = track.file;
      a.download = filename;
      a.target = '_blank';
      a.click();
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
            <button className="action-circle play" onClick={() => album.tracks[0] && onPlay(album.tracks[0], album)} title="Play album" aria-label="Play album">
              <PlayThin />
            </button>
            {isLibrary ?
        <>
              <div className="redownload-wrap">
                <button className="redownload-btn" onClick={handleRedownload}>RE-DOWNLOAD</button>
              </div>
              <button className="action-circle" onClick={openInfo} title="Download details" aria-label="Download details">
                <InfoReceiptIcon />
              </button>
            </> :

        <button className="dl-circle" onClick={handleDownloadAll} title="Download all">
              <svg viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5M4 20h16" /></svg>
            </button>
        }
          </div>

          <div className="tracklist">
            {album.tracks.map((track) => {
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
                    <button className="track-dl" onClick={(e) => {e.stopPropagation();handleDownloadTrack(track);}}>
                      <svg viewBox="0 0 24 24"><path d="M12 3v13M7 11l5 5 5-5M4 20h16" /></svg>
                    </button>
                  </div>
              }
                </div>);

        })}
          </div>

          <div className="detail-meta">
            {album.totalTracks} Songs, {album.duration} · © CARGO 2026. All rights reserved.
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
                <div className="desc-modal-title">download details</div>
                <div className="info-modal-rows">
                  <div className="info-row info-album">{album.title}</div>
                  <div className="info-row">{album.downloadInfo && album.downloadInfo.format || 'FLAC (24-bit / Lossless)'}</div>
                  <div className="info-row">Total: {album.downloadInfo && album.downloadInfo.total || 'Free (CHF 0.00)'}</div>
                  <div className="info-row">Downloaded: {album.downloadInfo && album.downloadInfo.downloaded || '—'}</div>
                </div>
              </div>
            </div>,
        document.body
      )}
        </div>);

};

// ─── LIBRARY PAGE ───────────────────────────────────────────────────
const LibraryPage = ({ onSelectAlbum }) => {
  const albums = ALBUMS.filter((a) => LIBRARY_IDS.includes(a.id));
  return (
    <div className="library-page page-enter">
          <h1 className="library-title">YOUR LIBRARY</h1>
          {albums.length === 0 ?
      <div className="library-empty">
              <div className="library-empty-title">your library is empty</div>
              <div className="library-empty-sub">Your downloaded music will appear here.<br />You can re-download your files anytime.</div>
            </div> :

      <div className={`library-grid${albums.length === 1 ? ' library-grid--single' : ''}`}>
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

const NowPlayingBar = ({ track, album, isPlaying, phase, minimized, tweaks, onToggle, onPrev, onNext, onClose, onExpand, progress, onSeek }) => {
  if (phase === 'closed' || !track) return null;
  const total = parseDur(track?.duration);
  const cur = total * progress;
  return (
    <>
        <div
        className={`np-mini ${phase === 'open' && minimized ? 'show' : ''}`}
        onClick={onExpand}
        role="button"
        aria-label="Expand player"
        title={`${track?.title} — ${track?.artist}`} style={{ height: "60px", borderWidth: "2px", width: "60px" }}>
          <div className={`eq-mini ${isPlaying ? '' : 'paused'}`}>
            <span /><span /><span /><span /><span />
          </div>
        </div>
        <div className={`np-player ${phase === 'closing' ? 'np-closing' : minimized ? 'np-min' : 'np-open'}`} aria-hidden={minimized}>
          <div className="np-inner">
            <div className="np-row">
              <div className="np-controls">
                <button className="np-ctrl" onClick={onPrev} aria-label="Previous"><PrevDouble /></button>
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
            <div className="np-progress" onClick={onSeek}>
              <div className="np-bar">
                <div className="np-bar-fill" style={{ width: `${progress * 100}%` }} />
                <div className="np-bar-dot" style={{ left: `${progress * 100}%` }} />
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
const CargoPage = () =>
<div className="cargo-page page-enter">
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
  
        <div className="cargo-text">
          CARGO is an independent music label founded by Typhex Webster.<br /><br />
          We exist outside the mainstream — built for artists who move between worlds, genres, and aesthetics without asking permission.<br /><br />
          CARGO releases music, clothing, and visual projects under one roof. Everything is made with intention. Nothing is rushed.
        </div>
        <div className="cargo-visuals">
          {['visual 01', 'visual 02', 'visual 03', 'visual 04'].map((v) =>
    <div key={v} className="cargo-visual-item" style={{
      background: `linear-gradient(135deg, #0d0d0d, #1a1a1a)`,
      backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(200,64,42,0.03) 3px, rgba(200,64,42,0.03) 6px)`
    }}>
              <span>[ {v} ]<br />drop photo here</span>
            </div>
    )}
        </div>
      </div>;


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
  const [playerPhase, setPlayerPhase] = useState('closed');
  const [minimized, setMinimized] = useState(false);
  const closeTimerRef = useRef(null);
  const miniTimerRef = useRef(null);
  const audioRef = useRef(null);

  // After 4s of resting, the open player collapses into a circle. Any call
  // re-expands it and restarts the 4s countdown.
  const scheduleMinimize = useCallback(() => {
    if (miniTimerRef.current) clearTimeout(miniTimerRef.current);
    setMinimized(false);
    miniTimerRef.current = setTimeout(() => setMinimized(true), 4000);
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
  const handleEnded = useCallback(() => {setIsPlaying(false);}, []);

  // ── Echter Audio-Player ───────────────────────────────────────────
  // Lädt die R2-Datei des aktuellen Tracks und spielt/pausiert sie.
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
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
    if (a && a.duration) setProgress(a.currentTime / a.duration);
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

  const handlePrev = () => {
    if (!currentAlbum || !currentTrack) return;
    const idx = currentAlbum.tracks.findIndex((t) => t.id === currentTrack.id);
    const prev = currentAlbum.tracks[(idx - 1 + currentAlbum.tracks.length) % currentAlbum.tracks.length];
    setCurrentTrack({ ...prev, albumId: currentAlbum.id });
    setProgress(0);setIsPlaying(true);
    scheduleMinimize();
  };

  const handleNext = () => {
    if (!currentAlbum || !currentTrack) return;
    const idx = currentAlbum.tracks.findIndex((t) => t.id === currentTrack.id);
    const next = currentAlbum.tracks[(idx + 1) % currentAlbum.tracks.length];
    setCurrentTrack({ ...next, albumId: currentAlbum.id });
    setProgress(0);setIsPlaying(true);
    scheduleMinimize();
  };

  const handleSeek = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frac = Math.max(0, Math.min(1, x / rect.width));
    setProgress(frac);
    const a = audioRef.current;
    if (a && a.duration) a.currentTime = frac * a.duration;
  };

  const showHeader = screen !== 'landing';
  const showPlayer = currentTrack !== null;
  const hamburgerOpen = screen === 'hub';

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
          isPlaying={isPlaying} />

        }
            </div>
      }

          {screen === 'library' &&
      <div className="main-page page">
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

          {screen === 'cargo' && <div className="main-page page"><CargoPage /></div>}
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
        onNext={handleNext}
        onClose={handleClosePlayer}
        onExpand={scheduleMinimize}
        progress={progress}
        onSeek={handleSeek} />

          <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleNext}
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
