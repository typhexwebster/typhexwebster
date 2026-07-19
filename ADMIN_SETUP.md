# CARGO — Admin-Seite live schalten

Drei Schritte: (1) Code aktualisieren, (2) geheime Keys bei Vercel eintragen,
(3) R2-CORS setzen. Danach kannst du unter **deine-domain/admin** alles selbst pflegen.

---

## SCHRITT 1 — Code auf GitHub aktualisieren

Genau wie beim ersten Mal, nur mit dem neuen ZIP:

1. `cargo-site.zip` herunterladen und entpacken → Ordner `cargo-site`.
2. Dein GitHub-Repo `cargo-site` öffnen → **Add file → Upload files**.
3. Den entpackten Ordner **`cargo-site`** wieder reinziehen → **Commit changes**.
   Neue/geänderte Dateien werden übernommen (u. a. der neue Ordner `api/`, `vercel.json`, `src/Admin.jsx`).

Vercel startet dann automatisch ein neues Deployment. **Aber** vorher noch Schritt 2 machen,
sonst funktioniert die Admin-Seite noch nicht.

---

## SCHRITT 2 — Geheime Keys bei Vercel eintragen

Vercel → dein Projekt → **Environment Variables** → **Add Environment Variable**.
Diese **acht** eintragen (bei jeder **Production** und **Preview** anhaken):

**Diese kannst du direkt kopieren (nicht geheim):**

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://kzzmavcwwxkfbjvxjpja.supabase.co` |
| `R2_S3_ENDPOINT` | `https://b7ca9870598b9c0006d70552b3153e6e.r2.cloudflarestorage.com` |
| `R2_BUCKET` | `cargo-audio` |
| `R2_PUBLIC_URL` | `https://pub-8ac90640b51146edbf2626c6a050123a.r2.dev` |

**Diese aus deiner Notiz einsetzen (geheim — nicht in den Chat):**

| Name | Value |
|------|-------|
| `SUPABASE_SECRET` | dein `sb_secret_…` |
| `R2_ACCESS_KEY_ID` | deine R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | dein R2 Secret Access Key |
| `ADMIN_PASSWORD` | dein selbst gewähltes Admin-Passwort |

> Die Namen müssen **exakt** so stehen (Groß-/Kleinschreibung!). Kein `VITE_` davor —
> das sind Server-Variablen, keine Browser-Variablen.

Danach: **Deployments → oberstes → `…` → Redeploy → ohne Build Cache.**

---

## SCHRITT 3 — R2-CORS setzen (damit Uploads & Downloads funktionieren)

Damit dein Browser Dateien zu R2 hochladen und Besucher sie herunterladen können,
muss der Bucket CORS erlauben:

1. Cloudflare → R2 → Bucket **`cargo-audio`** → **Settings** → **CORS Policy** → **Edit/Add**.
2. Dieses einfügen und speichern:

```json
[
  {
    "AllowedOrigins": ["*"],
    "AllowedMethods": ["GET", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

---

## FERTIG — so benutzt du die Admin-Seite

Öffne **deine-domain/admin** (z. B. `typhexwebster.com/admin`) → Passwort eingeben.

- **ALBEN:** Album anlegen/bearbeiten, Cover hochladen, Tracks hinzufügen und pro Track
  die **.m4a hochladen**, sichtbar/LIBRARY schalten, Reihenfolge bestimmen, löschen.
- **GALERIE:** Bilder/Videos für den Media-Bereich hochladen und löschen.
- **TEXTE:** freie Textbausteine pflegen.

Änderungen sind **sofort live** (nach kurzem Neuladen der öffentlichen Seite).
Du musst dafür nie wieder Code anfassen oder mich fragen.

### Wenn ein Upload hakt
- „R2-Upload fehlgeschlagen": Schritt 3 (CORS) prüfen.
- „unauthorized": falsches Admin-Passwort, oder `ADMIN_PASSWORD` bei Vercel nicht gesetzt/nicht redeployt.
- Admin-Seite lädt gar nicht: Schritt 1 (Code) und der Redeploy nach Schritt 2 gemacht?
