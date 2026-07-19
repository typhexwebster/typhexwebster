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
  Promise.all([import('./App.jsx'), import('./content.js')]).then(([{ default: App }, { loadContent }]) => {
    loadContent()
      .catch((e) => console.error('[cargo] loadContent failed:', e))
      .finally(() => root.render(<App />));
  });
}
