import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { loadContent } from './content.js';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

// Inhalte aus Supabase laden, DANN rendern (Daten sind beim ersten Render da).
loadContent()
  .catch((e) => console.error('[cargo] loadContent failed:', e))
  .finally(() => {
    root.render(<App />);
  });
