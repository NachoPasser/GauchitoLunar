// Test del núcleo de ranking (H5). Corre con: node --test tests/  (desde frontend/).
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankBy, scores } from "../rank.js";

// Sitios de juguete: A gana en comms, C gana en energía, B es intermedio.
const E = [
  { name: "A", lat: -89, lon: 0, kind: "seed", vis: 0.80, gap: 10, energy: 5, ok: true },
  { name: "B", lat: -88, lon: 1, kind: "seed", vis: 0.50, gap: 20, energy: 8, ok: true },
  { name: "C", lat: -87, lon: 2, kind: "seed", vis: 0.20, gap: 40, energy: 12, ok: true },
  { name: "X", lat: -86, lon: 3, kind: "pin", vis: 0, gap: 0, energy: 0, ok: false },
];
const names = (r) => r.map((e) => e.name);

test("comms: ordena por visibilidad desc", () => {
  const { ranked, noData } = rankBy(E, "comms");
  assert.deepEqual(names(ranked), ["A", "B", "C"]);
  assert.deepEqual(ranked.map((e) => e.rank), [1, 2, 3]);
  assert.deepEqual(names(noData), ["X"]);           // sin datos, fuera del ranking
});

test("comms: desempata por menor corte continuo (gap)", () => {
  const tie = [
    { name: "P", vis: 0.5, gap: 30, energy: 1, ok: true },
    { name: "Q", vis: 0.5, gap: 12, energy: 1, ok: true },
  ];
  assert.deepEqual(names(rankBy(tie, "comms").ranked), ["Q", "P"]);
});

test("energy: ordena por kWh/m² horizontal desc", () => {
  assert.deepEqual(names(rankBy(E, "energy").ranked), ["C", "B", "A"]);
});

test("mixed 50/50: combina comms y energía normalizados", () => {
  // Normalizado sobre {A,B,C}: vis→A=1,B=.5,C=0 ; energy→A=0,B=.43,C=1.
  // mixed: A=.5, B≈.464, C=.5 → empate A/C arriba; B último.
  const { ranked } = rankBy(E, "mixed", { wComms: 0.5 });
  assert.equal(ranked[2].name, "B");
  assert.ok(Math.abs(ranked[0].score.mixed - 0.5) < 1e-9);
});

test("mixed con peso 1.0 en comms = ranking de comms", () => {
  assert.deepEqual(names(rankBy(E, "mixed", { wComms: 1 }).ranked), ["A", "B", "C"]);
});

test("scores: span 0 (todos iguales) → 1", () => {
  const same = [
    { name: "U", vis: 0.4, gap: 5, energy: 7, ok: true },
    { name: "V", vis: 0.4, gap: 5, energy: 7, ok: true },
  ];
  const sc = scores(same);
  for (const e of same) assert.equal(sc.get(e).comms, 1);
});

test("set vacío / todo sin datos no explota", () => {
  assert.deepEqual(rankBy([], "comms"), { ranked: [], noData: [] });
  const r = rankBy([{ name: "Z", ok: false }], "mixed");
  assert.deepEqual(names(r.noData), ["Z"]);
  assert.equal(r.ranked.length, 0);
});

test("criterio inválido lanza", () => {
  assert.throws(() => rankBy(E, "nope"), /criterio desconocido/);
});
