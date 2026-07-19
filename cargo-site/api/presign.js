// Vercel Serverless Function — erzeugt Upload-URLs.
// Audio -> Cloudflare R2 (S3 presigned PUT). Bilder/Videos -> Supabase Storage (signed upload).
// Der eigentliche Datei-Upload läuft danach direkt vom Browser dorthin (nicht durch diese Funktion).
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createClient } from '@supabase/supabase-js';

const ADMIN = process.env.ADMIN_PASSWORD;

function safeName(name = 'file') {
  return String(name).normalize('NFKD').replace(/[^\w.\-]+/g, '_').slice(-80);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!ADMIN || (req.headers['x-admin-password'] || '') !== ADMIN) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { target, filename, contentType } = req.body || {};
  const stamp = Date.now();

  try {
    if (target === 'audio') {
      const endpoint = process.env.R2_S3_ENDPOINT;
      const bucket = process.env.R2_BUCKET;
      const pub = (process.env.R2_PUBLIC_URL || '').replace(/\/$/, '');
      if (!endpoint || !bucket) return res.status(500).json({ error: 'R2 nicht konfiguriert.' });

      const s3 = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      });
      const key = `audio/${stamp}-${safeName(filename)}`;
      const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType || 'audio/mp4' });
      const uploadUrl = await getSignedUrl(s3, cmd, { expiresIn: 600 });
      return res.json({ uploadUrl, key, publicUrl: `${pub}/${key}`, contentType: contentType || 'audio/mp4' });
    }

    if (target === 'media') {
      const SUPABASE_URL = process.env.SUPABASE_URL;
      const SUPABASE_SECRET = process.env.SUPABASE_SECRET;
      if (!SUPABASE_URL || !SUPABASE_SECRET) return res.status(500).json({ error: 'Supabase nicht konfiguriert.' });

      const supabase = createClient(SUPABASE_URL, SUPABASE_SECRET, { auth: { persistSession: false } });
      const path = `${stamp}-${safeName(filename)}`;
      const { data, error } = await supabase.storage.from('media').createSignedUploadUrl(path);
      if (error) throw error;
      return res.json({
        path: data.path,
        token: data.token,
        publicUrl: `${SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/media/${data.path}`,
      });
    }

    return res.status(400).json({ error: 'unbekanntes Ziel: ' + target });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
