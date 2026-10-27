import { test } from "node:test";
import assert from "node:assert/strict";
import { PLAYERS } from "./players.js";
import { mulberry32 } from "./dailyChallenge.js";
import { spielerKey, pruefeRaetsel, HINWEISE } from "./gesucht.js";
import {
  RUNDEN_VORRAT, HINWEIS_TAKT_S, RUNDE_S, neuesBrettDuell, duellPhase, rundeVorbei, sperreRest,
  versucheUebrig, siege, leererStand, RATE_TEXT,
} from "./gesuchtDuell.js";

const nk = new Map(PLAYERS.map((p) => [spielerKey(p), p]));
const T0 = Date.parse("2026-10-27T20:00:00.000Z");
const iso = (ms) => new Date(ms).toISOString();

test("neuesBrettDuell: sieben regelkonforme Bretter, frischer Stand", () => {
  const b = neuesBrettDuell(PLAYERS, mulberry32(11), nk);
  assert.equal(b.kind, "gesucht");
  assert.equal(b.runden.length, RUNDEN_VORRAT);
  for (const r of b.runden) assert.equal(pruefeRaetsel(r, nk), null);
  assert.deepEqual(b.stand, leererStand());
});

test("duellPhase: Vorlauf, dann alle 12 s ein Hinweis bis sechs", () => {
  const st = { ...leererStand(), start: iso(T0) };
  assert.equal(duellPhase({ ...leererStand() }, T0).name, "warten");
  assert.deepEqual(duellPhase(st, T0 - 2500), { name: "vorlauf", rest: 3 });
  const p0 = duellPhase(st, T0 + 1000);
  assert.equal(p0.name, "laeuft");
  assert.equal(p0.offen, 1);
  assert.equal(p0.naechsterIn, 11);
  assert.equal(duellPhase(st, T0 + HINWEIS_TAKT_S * 1000).offen, 2);
  assert.equal(duellPhase(st, T0 + 61_000).offen, HINWEISE);
  assert.equal(duellPhase(st, T0 + 61_000).naechsterIn, 0);
  assert.equal(duellPhase(st, T0 + 80_000).rest, 10);
});

test("Runde vorbei: Treffer, Zeit, oder beide ohne Versuche", () => {
  const st = { ...leererStand(), start: iso(T0) };
  assert.equal(rundeVorbei(st, T0 + 30_000), false);
  assert.equal(rundeVorbei({ ...st, sieger: 2, endzeit: iso(T0 + 20_000) }, T0 + 21_000), true);
  assert.equal(rundeVorbei(st, T0 + RUNDE_S * 1000), true);
  assert.equal(rundeVorbei({ ...st, fehler: { 1: 3, 2: 2 } }, T0 + 30_000), false);
  assert.equal(rundeVorbei({ ...st, fehler: { 1: 3, 2: 3 } }, T0 + 30_000), true);
  assert.deepEqual(duellPhase({ ...st, sieger: 1, endzeit: iso(T0 + 20_000) }, T0 + 22_000), { name: "aufloesung", seit: T0 + 20_000 });
  assert.deepEqual(duellPhase(st, T0 + 95_000), { name: "aufloesung", seit: T0 + 90_000 });
});

test("Sperre, Versuche, Siege", () => {
  const st = { ...leererStand(), fehler: { 1: 1 }, sperre: { 1: iso(T0 + 10_000) }, siege: { 2: 1 } };
  assert.equal(sperreRest(st, "1", T0 + 2500), 8);
  assert.equal(sperreRest(st, "1", T0 + 11_000), 0);
  assert.equal(sperreRest(st, "2", T0), 0);
  assert.equal(versucheUebrig(st, 1), 2);
  assert.equal(versucheUebrig(st, 2), 3);
  assert.equal(siege(st, 2), 1);
  assert.equal(siege(st, 1), 0);
  for (const k of ["falsch", "gesperrt", "keine_versuche", "vorbei", "noch_nicht"]) assert.ok(RATE_TEXT[k]);
});
