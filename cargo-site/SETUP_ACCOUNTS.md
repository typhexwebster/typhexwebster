# CARGO — Account-Setup (Supabase + Cloudflare R2)

Diese Anleitung führt dich durch die zwei kostenlosen Accounts, die wir brauchen.
Dauer: ~15–20 Minuten. Beide sind gratis, keine Kreditkarte nötig zum Start.

**Aufgabenteilung:**
- **Supabase** = die Datenbank (Alben, Tracks, Galerie-Infos, Texte).
- **Cloudflare R2** = die großen Dateien (Audio, später ggf. Videos). Egress gratis → Downloads kosten dich nichts.
- **Vercel + typhexwebster.com** hast du schon.

Am Ende der Anleitung steht, **welche Werte du mir schickst**, damit ich die Anbindung baue.

---

## TEIL 1 — Supabase

### 1.1 Account anlegen
1. Gehe auf **https://supabase.com** → **Start your project**.
2. Mit **GitHub** oder E-Mail anmelden (GitHub ist am schnellsten, brauchst du eh für Vercel).

### 1.2 Projekt erstellen
1. **New project**.
2. **Name:** `cargo` (egal, frei wählbar).
3. **Database Password:** ein starkes Passwort setzen → **notieren und aufbewahren** (brauchst du selten, aber nicht verlierbar).
4. **Region:** `Central EU (Frankfurt)` — nächstgelegen, schnellste Ladezeit für dich/Europa.
5. **Plan:** Free.
6. **Create new project** → ~2 Minuten warten, bis „Setting up" fertig ist.

### 1.3 Die Zugangsdaten finden (für mich)
Sobald das Projekt läuft:
1. Links unten **Project Settings** (Zahnrad) → **API** (bzw. „Data API").
2. Dort findest du:
   - **Project URL** — sieht aus wie `https://abcdefgh.supabase.co`
   - **anon / public key** — ein langer Text, beginnt mit `eyJ...` → **das ist öffentlich, unbedenklich zu teilen.**
   - **service_role key** — ebenfalls `eyJ...`, aber **GEHEIM.** Diesen NICHT hier im Chat posten. Den tragen wir später direkt bei Vercel als Umgebungsvariable ein.

> **Merke:** anon-Key = darf öffentlich sein (steckt eh im Browser). service_role-Key = niemals öffentlich, nie in den Frontend-Code, nie in den Chat.

Die Tabellen (albums, tracks, gallery_items, site_content) lege **ich** per fertigem SQL-Skript an — da musst du nichts von Hand bauen. Du kopierst später nur ein Skript in den „SQL Editor" und klickst **Run**.

---

## TEIL 2 — Cloudflare R2 (Audio-Speicher)

### 2.1 Account anlegen
1. Gehe auf **https://dash.cloudflare.com/sign-up**.
2. E-Mail + Passwort → Account bestätigen.

### 2.2 R2 aktivieren
1. Im Dashboard links **R2 Object Storage** anklicken.
2. Beim ersten Mal musst du R2 **aktivieren**. Cloudflare verlangt hier eine **Zahlungsmethode als Verifizierung** — es gibt aber ein **gratis Kontingent** (10 GB Speicher, Egress komplett gratis). Für unsere Größe fällt voraussichtlich **0 $** an.
3. Wähle das **Free**-Kontingent (kein kostenpflichtiger Plan nötig).

### 2.3 Bucket erstellen
1. **Create bucket**.
2. **Name:** `cargo-audio`.
3. **Location:** Automatic (oder EU).
4. **Create bucket**.

### 2.4 Bucket öffentlich machen (fürs Streaming/Download)
Damit die Musik auf der Seite abspielbar und ladbar ist, braucht der Bucket öffentliche URLs:
1. In den Bucket → Reiter **Settings**.
2. Unter **Public access** → **R2.dev subdomain** aktivieren (**Allow Access**).
   - Du bekommst eine öffentliche Basis-URL wie `https://pub-xxxxxxxx.r2.dev`.
   - (Optional später: eigene Subdomain `audio.typhexwebster.com` — machen wir, wenn alles steht.)

### 2.5 API-Token für Uploads erstellen (für die Admin-Seite)
1. Zurück in der R2-Übersicht → **Manage R2 API Tokens** (rechts oben, „API").
2. **Create API Token**.
3. **Permissions:** `Object Read & Write`.
4. **Specify bucket:** nur `cargo-audio` auswählen (Prinzip minimaler Rechte).
5. **Create**.
6. Cloudflare zeigt dir jetzt **einmalig**:
   - **Access Key ID**
   - **Secret Access Key**  ← **GEHEIM**, wird nur einmal angezeigt → sicher notieren.
   - Außerdem brauchen wir deine **Account ID** (steht in der R2-Übersicht / rechts im Dashboard).
7. Diese drei Werte sind **geheim** → **nicht in den Chat.** Kommen später direkt in die Vercel-Umgebungsvariablen.

---

## Was du mir schickst, wenn du fertig bist

**Unbedenklich, hier im Chat (öffentlich/nicht geheim):**
- [ ] Supabase **Project URL** (`https://….supabase.co`)
- [ ] Supabase **anon public key** (`eyJ…`)
- [ ] R2 **öffentliche Basis-URL** (`https://pub-….r2.dev`)

**Geheim — NICHT in den Chat.** Sag mir nur „hab ich", diese trägst du später selbst bei Vercel ein (ich zeige dir genau wo):
- [ ] Supabase **service_role key**
- [ ] R2 **Access Key ID** + **Secret Access Key**
- [ ] R2 **Account ID**

---

## Merkzettel-Vorlage (nur für dich, lokal speichern)

```
SUPABASE
  Project URL:        https://__________.supabase.co
  anon public key:    eyJ__________
  service_role key:   eyJ__________   (GEHEIM)
  DB Passwort:        __________       (GEHEIM)

CLOUDFLARE R2
  Public Base URL:    https://pub-__________.r2.dev
  Account ID:         __________
  Access Key ID:      __________        (GEHEIM)
  Secret Access Key:  __________        (GEHEIM)
  Bucket:             cargo-audio
```

Sobald du die drei unbedenklichen Werte hast, schick sie mir — dann baue ich Datenbank-Anbindung und Admin-Seite.
