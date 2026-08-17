/* Versand der Fehlermeldungen. Getrennt von reports.js, weil das hier Supabase
   importiert und damit außerhalb des Browsers nicht ladbar ist — dieselbe Trennung
   wie leaderboard.js / leaderboardScore.js.

   Die Tabelle pc_reports ist für den öffentlichen Schlüssel gesperrt (RLS an, keine
   Policies). Geschrieben wird nur über die Datenbankfunktion, die doppelte Paare zu
   einem Datensatz mit Zähler zusammenführt. */
import { supabase, getClientId } from "./supabaseClient.js";
import { DATA_ASOF } from "./dataInfo.js";
import { reportPayload } from "./reports.js";

/** Meldung abgeben. Wirft mit lesbarer Meldung, wenn es schiefgeht. */
export async function submitReport({ player, clubName, mode, gameCode = null }) {
  const args = reportPayload({
    player, clubName, mode, gameCode,
    clientId: getClientId(),
    dataAsof: DATA_ASOF,
  });
  const { error } = await supabase.rpc("pc_report_submit", args);
  if (error) throw new Error(error.message || "Die Meldung konnte nicht gespeichert werden.");
  return true;
}
