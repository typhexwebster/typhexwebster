import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));
const path = window.location.pathname.replace(/\/+$/, '');

if (path === '/admin') {
  // Admin-Bereich: eigenes Bündel, wird für normale Besucher nie geladen.
  import('./Admin.jsx').then(({ default: Admin }) => {
    root.render(<Admin />);
  });
} else {
  // Öffentliche Seite: Inhalte aus Supabase laden, DANN rendern.
  // Sicherung: spätestens nach 8s rendern, damit die Seite nie schwarz bleibt,
  // falls Supabase mal nicht/langsam antwortet.
  Promise.all([import('./App.jsx'), import('./content.js')]).then(([{ default: App }, { loadContent }]) => {
    let done = false;
    const render = () => { if (!done) { done = true; root.render(<App />); } };
    loadContent().catch((e) => console.error('[cargo] loadContent failed:', e)).finally(render);
    setTimeout(render, 8000);
  });
}
