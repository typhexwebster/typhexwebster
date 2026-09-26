// ─────────────────────────────────────────────────────────────
// siteTexts.js — die Texte, die sich im Admin unter TEXTS ändern lassen.
//
// Der Reiter TEXTS hat früher ins Leere geschrieben: Man konnte beliebige
// Schlüssel anlegen, aber keine Stelle der Seite hat sie gelesen. Ein
// Schlüssel bedeutet erst dann etwas, wenn er hier steht UND im Code
// benutzt wird — deshalb liegt die Liste an einer Stelle, die beide Seiten
// teilen: die öffentliche Seite zum Anzeigen, der Admin zum Beschriften.
//
// Neuen Text pflegbar machen heißt: hier einen Eintrag ergänzen und an der
// betreffenden Stelle in App.jsx `siteText(SITE, '<schlüssel>')` benutzen.
// ─────────────────────────────────────────────────────────────

export const SITE_TEXTS = [
{
  key: 'label_text',
  label: 'CARGO — label text',
  hint: 'Shown directly under the CARGO logo. An empty line starts a new paragraph.',
  multiline: true,
  fallback:
  'CARGO is an independent music label founded by Typhex Webster.\n\n' +
  'We exist outside the mainstream — built for artists who move between ' +
  'worlds, genres, and aesthetics without asking permission.\n\n' +
  'CARGO releases music, clothing, and visual projects under one roof. ' +
  'Everything is made with intention. Nothing is rushed.'
}];


// Nachschlagen mit Rückfall auf den Text im Code. Solange im Admin nichts
// eingetragen ist — oder falls die Datenbank mal nicht antwortet — steht
// auf der Seite trotzdem etwas Sinnvolles.
export function siteText(SITE, key) {
  const entry = SITE_TEXTS.find((t) => t.key === key);
  const stored = SITE && typeof SITE[key] === 'string' ? SITE[key].trim() : '';
  if (stored) return stored;
  return entry ? entry.fallback : '';
}
