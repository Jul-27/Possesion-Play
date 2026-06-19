import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.warn("Supabase-Umgebungsvariablen fehlen. Lege eine .env nach Vorbild von .env.example an.");
}

export const supabase = createClient(url || "http://localhost", anon || "anon");

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
