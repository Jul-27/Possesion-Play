/* Der Datenbankteil des Beitritts. Die Regel dazu steht in duelJoin.js. */
import { supabase } from "./supabaseClient.js";
import { beitrittsLage, beitrittsFelder, LAGE } from "./duelJoin.js";

/**
 * Gästeplatz beanspruchen. Liefert `{ ok: true }` oder `{ fehler: "…" }`.
 *
 * Der Zuschlag hängt an `.is("guest_id", null)`: Öffnen zwei Leute den Link
 * gleichzeitig, gewinnt genau einer, der andere bekommt eine klare Absage statt
 * eines halb betretenen Spiels.
 */
export async function gastPlatzBeanspruchen(code, clientId, name) {
  const { data: row, error: selErr } = await supabase
    .from("games").select("*").eq("code", code).maybeSingle();
  if (selErr) return { fehler: selErr.message };
  if (!row) return { fehler: "Kein Spiel mit diesem Code gefunden." };

  const lage = beitrittsLage(row, clientId);
  if (lage === LAGE.DABEI) return { ok: true };          // Wiedereinstieg
  if (lage === LAGE.VOLL) return { fehler: "Dieses Spiel ist bereits voll." };

  const { data: upd, error: updErr } = await supabase
    .from("games")
    .update(beitrittsFelder(row, clientId, name))
    .eq("code", code)
    .is("guest_id", null)
    .select()
    .maybeSingle();
  if (updErr) return { fehler: updErr.message };
  if (!upd) return { fehler: "Jemand anderes ist gerade beigetreten." };
  return { ok: true };
}
