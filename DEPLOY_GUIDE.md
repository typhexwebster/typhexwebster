# CARGO — Deploy (GitHub → Vercel)

Ziel: die Seite live schalten. Danach sehen wir, ob die Alben + Cover korrekt aus
Supabase kommen. Dauer: ~15 Min. Du brauchst nichts zu installieren.

---

## TEIL 1 — Code auf GitHub laden (über den Browser, ohne Programm)

1. **ZIP entpacken:** Lade `cargo-site.zip` aus dem Chat herunter und doppelklick es.
   Du bekommst einen Ordner **`cargo-site`**.

2. Gehe auf **https://github.com** → oben rechts auf **+** → **New repository**.

3. **Repository name:** `cargo-site`. Sichtbarkeit egal (Public ist ok).
   **Wichtig:** *kein* Häkchen bei „Add a README". → **Create repository**.

4. Auf der jetzt leeren Repo-Seite gibt es den Link **„uploading an existing file"** — anklicken.

5. Finder öffnen, den entpackten Ordner **`cargo-site`** packen und **in das Upload-Feld im Browser ziehen**.
   GitHub lädt den ganzen Ordner mit Unterordnern hoch (ca. 23 MB, dauert kurz).
   > Falls „node_modules" fehlt: richtig so — das gehört nicht hochgeladen.

6. Unten grün **„Commit changes"** klicken. Fertig — dein Code ist auf GitHub.

---

## TEIL 2 — Auf Vercel deployen

7. Gehe auf **https://vercel.com** → **Add New…** → **Project**.

8. **Import Git Repository** → falls gefragt, GitHub verbinden/autorisieren →
   in der Liste **`cargo-site`** wählen → **Import**.

9. **Root Directory:** klick **Edit** und wähle den Ordner **`cargo-site`**
   (weil im Repo alles in diesem Unterordner liegt). Framework wird als **Vite** erkannt —
   Build- und Output-Einstellungen nicht ändern.

10. **Environment Variables** aufklappen und diese **drei** eintragen
    (Name links, Value rechts, jeweils **Add**):

    | Name | Value |
    |------|-------|
    | `VITE_SUPABASE_URL` | `https://kzzmavcwwxkfbjvxjpja.supabase.co` |
    | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_Hiqs_ZcQUI9dQWClRlJLpQ_n7RuYIEi` |
    | `VITE_R2_PUBLIC_URL` | `https://pub-8ac90640b51146edbf2626c6a050123a.r2.dev` |

11. **Deploy** klicken. ~1 Minute warten.

12. Vercel zeigt eine Vorschau-URL (`…vercel.app`). **Öffnen** und testen:
    - ENTER → MUSIC → kommen die 4 Alben mit Covern?
    - (Audio spielt noch nicht — die Dateien laden wir gleich per Admin-Seite hoch.)

    **Schick mir die `…vercel.app`-URL**, dann prüfe ich mit dir, ob alles sitzt.

---

## TEIL 3 — Deine Domain typhexwebster.com (machen wir danach)

Wenn die Vorschau passt: Vercel-Projekt → **Settings → Domains** → `typhexwebster.com`
hinzufügen. Falls die Domain schon einem anderen Vercel-Projekt zugeordnet ist,
sag mir Bescheid — dann zeige ich dir, wie du sie umhängst.

---

### Wenn irgendwas hakt
Screenshot schicken + sagen, bei welcher Nummer. Häufige Punkte:
- **Build fehlgeschlagen:** meist Root Directory nicht auf `cargo-site` gesetzt (Schritt 9).
- **Seite lädt, aber keine Alben:** Environment Variables prüfen (Schritt 10), dann in
  Vercel unter **Deployments → Redeploy**.
