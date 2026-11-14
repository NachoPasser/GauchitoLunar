// rank.js — ranking puro de sitios por criterio (comms / energía / mixto). Sin DOM
// ni red: recibe las métricas ya cargadas y devuelve el orden. Es el núcleo de la
// comparación del Top 3 (H5), así que va con test.
//
// Entrada: entries = [{ name, lat, lon, kind, vis, gap, energy, ok }]
//   vis    = earth_vis_fraction  (0..1, mayor mejor)
//   gap    = longest_comms_gap_h (horas, menor mejor) — desempate de comms
//   energy = energy_kwh_m2.horizontal (kWh/m², mayor mejor)  [decisión H5: horizontal]
//   ok     = hubo datos (los sin datos quedan fuera del ranking, van en `noData`)

export const CRITERIA = ["comms", "energy", "mixed"];

// Normalizador min–max sobre un set de valores. Si todos son iguales (span 0), todo
// vale 1 (no hay con qué discriminar; no penalizamos arbitrariamente).
function normalizer(vals) {
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = max - min;
  return (x) => (span > 0 ? (x - min) / span : 1);
}

// Scores 0..1 por sitio para cada sub-criterio + el mixto. wComms = peso de comms
// en el mixto (0..1); energía pesa (1 - wComms). Devuelve Map(entry → {comms,energy,mixed}).
export function scores(entries, wComms = 0.5) {
  const ok = entries.filter((e) => e.ok);
  const m = new Map();
  if (!ok.length) return m;
  const nVis = normalizer(ok.map((e) => e.vis));
  const nEne = normalizer(ok.map((e) => e.energy));
  for (const e of ok) {
    const sv = nVis(e.vis), se = nEne(e.energy);
    m.set(e, { comms: sv, energy: se, mixed: wComms * sv + (1 - wComms) * se });
  }
  return m;
}

// Ordena por criterio (mejor primero). Devuelve { ranked, noData }, donde cada item
// de `ranked` es el entry original + { rank (1..n), score:{comms,energy,mixed} }.
export function rankBy(entries, criterion, { wComms = 0.5 } = {}) {
  const sc = scores(entries, wComms);
  const ok = entries.filter((e) => e.ok);
  const noData = entries.filter((e) => !e.ok);
  const cmp = {
    comms: (a, b) => b.vis - a.vis || a.gap - b.gap,
    energy: (a, b) => b.energy - a.energy,
    mixed: (a, b) => sc.get(b).mixed - sc.get(a).mixed,
  }[criterion];
  if (!cmp) throw new Error(`criterio desconocido: ${criterion}`);
  const ranked = ok.slice().sort(cmp)
    .map((e, i) => ({ ...e, rank: i + 1, score: sc.get(e) }));
  return { ranked, noData };
}
