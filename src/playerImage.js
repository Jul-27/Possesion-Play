/* Spielerfotos — reine Logik (kein React).
   Hybrid: Was unter public/players/ liegt, kommt lokal; alles Übrige lädt der Browser
   direkt von Wikimedia Commons. Grund: Ein Massen-Download aller ~2.100 Bilder läuft in
   Wikimedias Bulk-Limit (gemessen ~3,6 Dateien/min ≈ 9 h), während verteilte Einzelabrufe
   aus den Browsern der Spieler völlig normale Nutzung sind.
   Beide Karten sind über norm(name)|geburtsjahr verschlüsselt; fehlt ein Treffer,
   liefert imageUrlFor() null und die UI zeigt Initialen. */
import { norm } from "./gameData.js";
import { PLAYER_IMG_LOCAL, PLAYER_IMG_COMMONS } from "./playerImages.js";

export const PLAYER_IMG_BASE = "/players/";
export const COMMONS_BASE = "https://upload.wikimedia.org/wikipedia/commons/thumb/";
export const COMMONS_WIDTH = 120; // gleiche Stufe wie die lokalen Thumbnails

export function imageKey(player) {
  if (!player?.n || !player?.by) return null;
  return `${norm(player.n)}|${player.by}`;
}

// Lokaler Dateiname oder null.
export function imageFor(player) {
  const k = imageKey(player);
  return (k && PLAYER_IMG_LOCAL[k]) || null;
}

/* "b/b4/Lionel_Messi.jpg" -> volle Thumbnail-URL auf dem Commons-CDN.
   Der Dateiname steckt zweimal in der URL: einmal als Verzeichnis, einmal mit Breiten-Präfix. */
export function commonsUrl(path, width = COMMONS_WIDTH) {
  const i = path.lastIndexOf("/");
  const file = encodeURIComponent(path.slice(i + 1));
  return `${COMMONS_BASE}${path.slice(0, i)}/${file}/${width}px-${file}`;
}

// Anzuzeigende URL: lokal bevorzugt, sonst Commons, sonst null.
export function imageUrlFor(player) {
  const k = imageKey(player);
  if (!k) return null;
  const local = PLAYER_IMG_LOCAL[k];
  if (local) return PLAYER_IMG_BASE + local;
  const remote = PLAYER_IMG_COMMONS[k];
  return remote ? commonsUrl(remote) : null;
}

// „Lionel Messi" -> „LM"; fällt auf den Nachnamen zurück, wenn nur ein Wort da ist.
export function initialsOf(player) {
  const name = (player?.n || player?.ln || "").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministische Farbe je Spieler, damit Fallback-Avatare unterscheidbar bleiben.
export function avatarHue(player) {
  const s = (player?.n || "") + (player?.by || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
