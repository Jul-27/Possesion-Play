import test from "node:test";
import assert from "node:assert/strict";
import { ordneKaderZu, NEU_AB } from "./wikidata_national.mjs";
import { norm } from "./wikidata_roster.mjs";

const bestand = () => {
  const players = [
    { n: "Hakan Çalhanoğlu", by: 1994, nat: ["GER"], clubs: [] },
    { n: "Andrij Jarmolenko", by: 1989, nat: [], clubs: [] },
    { n: "Zlatan Ibrahimović", by: 1981, nat: ["SWE"], clubs: [] },
  ];
  return { players, byKey: new Map(players.map((p) => [norm(p.n) + "|" + p.by, p])) };
};

test("ordneKaderZu: die Nation des A-Teams wird ergänzt, nicht nur in leere Felder gesetzt", () => {
  const { players, byKey } = bestand();
  const r = ordneKaderZu(players, byKey, "TUR", [{ name: "Hakan Çalhanoğlu", by: 1994, sl: 60 }]);
  assert.deepEqual(players[0].nat, ["GER", "TUR"]);
  assert.deepEqual(r, { ergaenzt: 1, neu: 0 });
});

test("ordneKaderZu: Abgleich auch über das deutsche Label, kein zweiter Datensatz", () => {
  const { players, byKey } = bestand();
  ordneKaderZu(players, byKey, "UKR", [{ name: "Andriy Yarmolenko", de: "Andrij Jarmolenko", by: 1989, sl: 40 }]);
  assert.equal(players.length, 3);
  assert.deepEqual(players[1].nat, ["UKR"]);
});

test("ordneKaderZu: vorhandener Code bleibt einfach, neue Spieler erst ab NEU_AB", () => {
  const { players, byKey } = bestand();
  const r = ordneKaderZu(players, byKey, "SWE", [
    { name: "Zlatan Ibrahimović", by: 1981, sl: 90 },
    { name: "Gunnar Nordahl", by: 1921, sl: 30 },
    { name: "Viktor Gyökeres", by: 1998, sl: 40 },
  ]);
  assert.deepEqual(players[2].nat, ["SWE"]);
  assert.deepEqual(r, { ergaenzt: 0, neu: 1 });
  assert.ok(NEU_AB <= 1998 && NEU_AB > 1921);
  assert.equal(players.at(-1).n, "Viktor Gyökeres");
});
