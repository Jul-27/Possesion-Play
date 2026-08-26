import { test } from "node:test";
import assert from "node:assert/strict";
import { beitrittsLage, beitrittsFelder, duellName, LAGE } from "./duelJoin.js";
import { START_SECONDS } from "./gameData.js";
import { CAROUSEL_SECONDS } from "./carousel.js";

const spiel = (extra = {}) => ({
  code: "ABC123", host_id: "wirt", guest_id: null, status: "waiting",
  names: { 1: "Anna", 2: "Spieler 2" }, board: { kind: "hex" }, ...extra,
});

// ── Wer darf beitreten ───────────────────────────────────────────────────────

test("beitrittsLage unterscheidet Ersteller, freien Platz und volles Spiel", () => {
  assert.equal(beitrittsLage(spiel(), "wirt"), LAGE.DABEI, "der Ersteller ist schon dabei");
  assert.equal(beitrittsLage(spiel(), "gast"), LAGE.FREI);
  assert.equal(beitrittsLage(spiel({ guest_id: "gast" }), "gast"), LAGE.DABEI, "Wiedereinstieg");
  assert.equal(beitrittsLage(spiel({ guest_id: "wer-anders" }), "gast"), LAGE.VOLL);
});

test("beitrittsLage bleibt still, wenn nichts da ist", () => {
  assert.equal(beitrittsLage(null, "gast"), null);
  assert.equal(beitrittsLage(spiel(), null), null);
});

/* Ein beendetes Spiel bleibt für einen Dritten voll — sonst würde ein alter Link
   jemanden in eine Partie setzen, die längst vorbei ist. */
test("ein fertiges Spiel nimmt niemanden mehr auf", () => {
  const fertig = spiel({ guest_id: "gast", status: "finished" });
  assert.equal(beitrittsLage(fertig, "dritter"), LAGE.VOLL);
  assert.equal(beitrittsLage(fertig, "gast"), LAGE.DABEI, "die Beteiligten dürfen zurück");
});

// ── Was ein Beitritt setzt ───────────────────────────────────────────────────

test("beitrittsFelder trägt Gast, Name und Startzeit ein", () => {
  const f = beitrittsFelder(spiel(), "gast", "Bert", Date.parse("2026-08-26T12:00:00Z"));
  assert.equal(f.guest_id, "gast");
  assert.equal(f.status, "playing");
  assert.deepEqual(f.names, { 1: "Anna", 2: "Bert" }, "Spieler 1 bleibt unberührt");
  assert.equal(f.clocks.started, "2026-08-26T12:00:00.000Z");
  assert.equal(f.clocks[1], START_SECONDS);
});

/* Das Karussell zählt PRO ZUG. Begänne die Frist schon beim Erstellen, liefe sie
   ab, während der Ersteller auf einen Gegner wartet — der Gast verlöre seinen
   ersten Zug, bevor er das Brett gesehen hat. */
test("beim Karussell beginnt die Zugfrist erst mit dem Beitritt", () => {
  const jetzt = 1_800_000_000_000;
  const f = beitrittsFelder(spiel({ board: { kind: "carousel" }, last_move: { runde: 1 } }), "gast", "Bert", jetzt);
  assert.equal(f.last_move.frist, jetzt + CAROUSEL_SECONDS * 1000);
  assert.equal(f.last_move.runde, 1, "der übrige Zug bleibt stehen");
});

test("die anderen Modi bekommen keine Zugfrist", () => {
  for (const kind of ["hex", "grid", "guess"]) {
    assert.equal(beitrittsFelder(spiel({ board: { kind } }), "gast", "Bert").last_move, undefined, kind);
  }
});

test("beitrittsFelder kommt auch mit einem lückenhaften Spiel zurecht", () => {
  const f = beitrittsFelder({}, "gast", "Bert");
  assert.deepEqual(f.names, { 2: "Bert" });
  assert.equal(f.clocks[1], START_SECONDS);
});

/* Der Eingeladene soll sehen, wozu er eingeladen wird. `board.kind` fehlt bei den
   ältesten Partien — dort war board noch ein reines Feld-Array. */
test("duellName kennt alle vier Modi und die alte Brettform", () => {
  assert.equal(duellName({ kind: "hex" }), "Hex-Duell");
  assert.equal(duellName({ kind: "grid" }), "Raster-Duell");
  assert.equal(duellName({ kind: "guess" }), "Errate den Star");
  assert.equal(duellName({ kind: "carousel" }), "Transferkarussell");
  assert.equal(duellName([{ type: "club" }]), "Hex-Duell", "altes Array-Brett");
  assert.equal(duellName(null), "Hex-Duell");
  assert.equal(duellName({ kind: "gibtsnicht" }), "Hex-Duell", "kein Absturz bei Unbekanntem");
});
