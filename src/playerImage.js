/* Spielerfotos — reine Logik (kein React).
   Der Index kommt aus der Pipeline und ist über norm(name)|geburtsjahr verschlüsselt;
   fehlt ein Treffer, liefert imageFor() null und die UI zeigt Initialen. */
import { norm } from "./gameData.js";
import { PLAYER_IMAGES } from "./playerImages.js";

export const PLAYER_IMG_BASE = "/players/";

export function imageKey(player) {
  if (!player?.n || !player?.by) return null;
  return `${norm(player.n)}|${player.by}`;
}

// Dateiname des Fotos oder null.
export function imageFor(player) {
  const k = imageKey(player);
  return (k && PLAYER_IMAGES[k]) || null;
}

// Vollständige URL oder null.
export function imageUrlFor(player) {
  const f = imageFor(player);
  return f ? PLAYER_IMG_BASE + f : null;
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
