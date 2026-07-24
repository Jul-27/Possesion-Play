/* Bestenliste im Freundeskreis.

   Zugriff läuft ausschließlich über Datenbankfunktionen, die den Gruppencode verlangen —
   die Tabellen selbst sind für den öffentlichen Schlüssel gesperrt. Ohne Code ist die
   Liste weder lesbar noch beschreibbar.

   Ehrliche Grenze: Ohne Anmeldung lässt sich nicht prüfen, ob ein gemeldetes Ergebnis
   echt erspielt wurde — wer mag, kann Werte fälschen. Für einen Freundeskreis ist das
   vertretbar; eine Rangliste unter Fremden wäre es nicht. */
import { supabase, getClientId } from "./supabaseClient.js";
import { dailyDateStr } from "./dailyLogic.js";
import { scoreFor, MODES } from "./leaderboardScore.js";

export { scoreFor, MODES };

const GROUP_KEY = "pp:lbGroup";     // { code, name }
const NAME_KEY = "pp:lbName";       // frei gewählter Anzeigename

const read = (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ohne Speicher weiter */ } };

export const getGroup = () => read(GROUP_KEY);
export const setGroup = (g) => write(GROUP_KEY, g);
export const leaveGroup = () => { try { localStorage.removeItem(GROUP_KEY); } catch { /* egal */ } };
export const getName = () => read(NAME_KEY);
export const setName = (n) => write(NAME_KEY, String(n).trim().slice(0, 24));

export async function createGroup(name) {
  const { data, error } = await supabase.rpc("lb_create_group", { p_name: name });
  if (error) throw new Error(error.message);
  const g = { code: data, name: String(name).trim().slice(0, 40) };
  setGroup(g);
  return g;
}

export async function joinGroup(code) {
  const clean = String(code).trim().toUpperCase();
  const { data, error } = await supabase.rpc("lb_group_name", { p_code: clean });
  if (error) throw new Error(error.message);
  if (!data) return null;                    // Code existiert nicht
  const g = { code: clean, name: data };
  setGroup(g);
  return g;
}

// Ergebnis melden — still, ohne den Spielfluss zu stören.
export async function submit(mode, result, day = dailyDateStr()) {
  const g = getGroup();
  const name = getName();
  if (!g || !name) return false;             // ohne Gruppe/Name kein Versand
  const { error } = await supabase.rpc("lb_submit", {
    p_code: g.code, p_client: getClientId(), p_name: name,
    p_mode: mode, p_day: day, p_score: scoreFor(mode, result), p_detail: result,
  });
  return !error;
}

export async function top(mode, day = dailyDateStr()) {
  const g = getGroup();
  if (!g) return [];
  const { data, error } = await supabase.rpc("lb_top", { p_code: g.code, p_mode: mode, p_day: day });
  if (error) return [];
  const me = getClientId();
  return (data || []).map((r, i) => ({ ...r, rank: i + 1, isMe: r.client_id === me }));
}
