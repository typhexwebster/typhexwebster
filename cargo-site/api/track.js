// Vercel Serverless Function — nimmt Ereignisse der Webseite entgegen
// (Seitenaufruf, Abspielen, Download) und schreibt sie in Supabase.
//
// Datenschutz: Die IP-Adresse wird nie gespeichert. Aus IP + Browser +
// heutigem Datum + einem geheimen Salz entsteht ein kurzer Prüfwert.
// Er ist nur einen Tag lang gleich — genug, um Besucher eines Tages zu
// zählen, zu wenig, um jemanden über Tage wiederzuerkennen. Kein Cookie.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
const SALT = process.env.ANALYTICS_SALT || SUPABASE_SECRET || 'cargo';

// Vorschau-Roboter von Messengern, Suchmaschinen usw. zählen nicht.
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora|whatsapp|telegram|discord|skype|slack|headless|lighthouse|pingdom|monitor|curl|wget|python|go-http|node-fetch|axios|vercel/i;

const TYPES = ['view', 'play', 'download'];
const DEVICES = ['mobile', 'tablet', 'desktop'];

let client = null;
function db() {
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_SECRET, { auth: { persistSession: false } });
  return client;
}

function str(v, max) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
}

function browserOf(ua) {
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/musical_ly|BytedanceWebview|TikTok/i.test(ua)) return 'TikTok';
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook';
  if (/Snapchat/i.test(ua)) return 'Snapchat';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/FxiOS|Firefox\//.test(ua)) return 'Firefox';
  if (/CriOS|Chrome\//.test(ua)) return 'Chrome';
  if (/Safari\//.test(ua)) return 'Safari';
  return 'Other';
}

function osOf(ua) {
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Android/.test(ua)) return 'Android';
  if (/Windows/.test(ua)) return 'Windows';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Mac OS X|Macintosh/.test(ua)) return 'macOS';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

// Datum in Schweizer Zeit — der Prüfwert wechselt um Mitternacht hier,
// nicht um Mitternacht in London.
function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(new Date());
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).end();
  if (!SUPABASE_URL || !SUPABASE_SECRET) return res.status(204).end();

  // sendBeacon schickt text/plain — dann kommt der Inhalt als Text an.
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b || typeof b !== 'object') return res.status(400).end();

  const ua = String(req.headers['user-agent'] || '');
  if (!ua || BOT.test(ua)) return res.status(204).end();

  const type = b.t;
  if (!TYPES.includes(type)) return res.status(400).end();

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim()
    || String(req.headers['x-real-ip'] || '')
    || (req.socket && req.socket.remoteAddress) || '';
  const visitor = crypto.createHash('sha256')
    .update(`${SALT}|${today()}|${ip}|${ua}`)
    .digest('hex').slice(0, 16);

  const trackNo = Number.parseInt(b.n, 10);
  const row = {
    type,
    visitor,
    section: str(b.s, 40),
    album_id: str(b.a, 120),
    album_title: str(b.at, 200),
    track_no: Number.isFinite(trackNo) ? trackNo : null,
    track_title: str(b.tt, 200),
    redownload: b.r === true,
    country: str(req.headers['x-vercel-ip-country'], 2),
    device: DEVICES.includes(b.d) ? b.d : null,
    browser: browserOf(ua),
    os: osOf(ua),
    referrer: str(b.ref, 120),
  };

  try {
    const { error } = await db().from('events').insert(row);
    if (error) console.warn('[track]', error.message);
  } catch (e) {
    console.warn('[track]', e && e.message);
  }
  // Der Besucher wartet nie auf die Antwort — egal, was passiert.
  return res.status(204).end();
}
