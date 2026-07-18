import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('[cargo] Supabase env vars fehlen (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false },
});

export const R2_PUBLIC_URL = (import.meta.env.VITE_R2_PUBLIC_URL || '').replace(/\/$/, '');
export const SUPABASE_URL = (url || '').replace(/\/$/, '');
