import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("Supabase-Umgebungsvariablen fehlen. Lege eine .env nach Vorbild von .env.example an.");
}

export const supabase = createClient(url || "http://localhost", anon || "anon");

// Update, das das Entladen der Seite überlebt (normaler supabase-js-Client wird
// beim Schließen abgebrochen). Direkt gegen die REST-API mit keepalive.
export function beaconUpdate(code, patch) {
  try {
    fetch(`${url}/rest/v1/games?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH", keepalive: true,
      headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
  } catch { /* nie kritisch */ }
}

// Stabile, anonyme Spieler-ID pro Browser (kein Login nötig)
export function getClientId() {
  let id = localStorage.getItem("pp_client_id");
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : "id-" + Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem("pp_client_id", id);
  }
  return id;
}

export function getSavedName() {
  return localStorage.getItem("pp_name") || "";
}
export function saveName(name) {
  localStorage.setItem("pp_name", name || "");
}
