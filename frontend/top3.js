// top3.js — comparación Top 3 (H5). Capa de datos (trae las métricas de todos los
// sitios seleccionados: semilla ⭐ + chinchetas 📍, arma el array `entries` que
// consume rank.js) + UI (modal con carrusel de 3 pasos: podio + tabla de ranking).

import { getSites, getSite } from "./api.js";
import { getState, windowDays, startDate } from "./state.js";
import { rankBy } from "./rank.js";
import { fmtPct, fmtEnergy, fmtHours } from "./format.js";

// Cache de entries OK por (sitio × ventana × fecha). Reabrir el Top 3 no re-pide;
// cambiar la ventana/fecha cambia la clave → refetch automático. Los errores NO se
// cachean (ej. 503 por falta de red): se reintenta la próxima vez.
const cache = new Map();
const keyOf = (lat, lon, win, date) => `${lat},${lon},${win},${date || ""}`;

async function fetchEntry(site, kind, win, date) {
  const k = keyOf(site.lat, site.lon, win, date);
  if (cache.has(k)) return cache.get(k);
  const base = { name: site.name, lat: site.lat, lon: site.lon, kind };
  try {
    const r = await getSite(site.lat, site.lon, { windowDays: win, date });
    const m = r.metrics;
    const entry = { ...base, ok: true,
      vis: m.earth_vis_fraction,            // 0..1, mayor mejor
      gap: m.longest_comms_gap_h,           // horas, menor mejor (desempate comms)
      energy: m.energy_kwh_m2.horizontal }; // kWh/m² horizontal (decisión H5)
    cache.set(k, entry);
    return entry;
  } catch (e) {
    return { ...base, ok: false, error: e.message, vis: 0, gap: Infinity, energy: 0 };
  }
}

// Carga en paralelo las métricas de semilla + chinchetas con la ventana/fecha global.
// Tolera fallos por sitio (ok:false). Devuelve el array `entries` para rank.js.
export async function loadEntries({ win = windowDays(), date = startDate() } = {}) {
  const { sites } = await getSites();
  const pins = getState().sitios || [];
  const all = [
    ...sites.map((s) => [s, "seed"]),
    ...pins.map((s) => [s, "pin"]),
  ];
  return Promise.all(all.map(([s, kind]) => fetchEntry(s, kind, win, date)));
}

// ── UI: modal + carrusel de 3 pasos (comms / energía / mixto). Cada paso: podio de
// 3 tarjetas + tabla de ranking de todos los sitios; tarjetas y filas con "ver detalle".
const STEPS = ["comms", "energy", "mixed"];

export function createTop3({ onDetail } = {}) {
  const $ = (id) => document.getElementById(id);
  const overlay = $("top3-overlay");
  const content = $("top3-content");
  let step = "comms", entries = null, loading = false, error = null;

  // Explica el criterio actual (honestidad §8: mostrar cómo se ordena / el peso).
  const CAPTION = {
    comms: "Ordenado por % de tiempo con la Tierra a la vista · desempate: menor corte continuo.",
    energy: "Ordenado por energía solar captada (panel horizontal, kWh/m²).",
    mixed: "Mitad comunicación, mitad energía (50/50), normalizado entre los sitios.",
  };
  const MEDAL = ["🥇", "🥈", "🥉"];
  const enc = (s) => String(s).replace(/"/g, "&quot;");
  const kindChip = (k) => (k === "pin"
    ? `<span title="sitio tuyo">📍</span>` : `<span title="predefinido">⭐</span>`);

  // Valor destacado de la tarjeta de podio según el criterio.
  function headline(e) {
    if (step === "comms") return [fmtPct(e.vis), `a la vista · corte ${fmtHours(e.gap)}`];
    if (step === "energy") return [fmtEnergy(e.energy), "kWh/m² · panel horizontal"];
    return [`${(e.score.mixed * 100).toFixed(0)}`, "score mixto / 100"];
  }

  const detailBtn = (e, cls) => `<button class="${cls}" data-lat="${e.lat}" ` +
    `data-lon="${e.lon}" data-name="${enc(e.name)}">ver detalle</button>`;

  function card(e) {
    const [big, sub] = headline(e);
    const brand = e.rank === 1 ? "border-color:var(--brand)" : "";
    const sun = step === "energy" ? " metric__value--sun" : "";
    return `<div class="card" style="${brand};text-align:center">
      <div class="text-2xl leading-none">${MEDAL[e.rank - 1]}</div>
      <p class="font-semibold mt-1.5" style="color:var(--ink)">${kindChip(e.kind)} ${e.name}</p>
      <p class="metric__value mt-2${sun}">${big}</p>
      <p class="metric__sub">${sub}</p>
      ${detailBtn(e, "btn btn--sm mt-3")}
    </div>`;
  }

  function row(e) {
    const top = e.rank <= 3;
    const strong = (c) => (step === c ? "font-weight:600;color:var(--ink)" : "color:var(--ink-2)");
    return `<tr style="${top ? "background:var(--surface-2)" : ""}">
      <td class="px-2 py-1.5 mono" style="color:var(--ink-3)">${e.rank}</td>
      <td class="px-2 py-1.5">${kindChip(e.kind)} ${e.name}</td>
      <td class="px-2 py-1.5 mono text-right" style="${strong("comms")}">${fmtPct(e.vis)}</td>
      <td class="px-2 py-1.5 mono text-right" style="${strong("energy")}">${fmtEnergy(e.energy)}</td>
      <td class="px-2 py-1.5 mono text-right" style="${strong("mixed")}">${
        (e.score.mixed * 100).toFixed(0)}</td>
      <td class="px-2 py-1.5 text-right">${detailBtn(e, "btn btn--ghost btn--sm")}</td>
    </tr>`;
  }

  function render() {
    if (loading) { content.innerHTML = msg("Cargando métricas de los sitios…"); return; }
    if (error) { content.innerHTML = msg(`No se pudo cargar: ${error}`, true); return; }
    if (!entries) { content.innerHTML = ""; return; }
    const { ranked, noData } = rankBy(entries, step);
    if (!ranked.length) { content.innerHTML = msg("Ningún sitio con datos para rankear."); return; }
    const podium = ranked.slice(0, 3).map(card).join("");
    const ndRows = noData.map((e) =>
      `<tr style="color:var(--ink-3)"><td class="px-2 py-1.5">–</td>
        <td class="px-2 py-1.5">${kindChip(e.kind)} ${e.name}</td>
        <td class="px-2 py-1.5 text-xs" colspan="4">sin datos</td></tr>`).join("");
    content.innerHTML = `
      <p class="text-xs" style="color:var(--ink-3)">${CAPTION[step]}</p>
      <div class="grid grid-cols-3 gap-3 mt-3">${podium}</div>
      <table class="w-full text-sm mt-5" style="border-collapse:collapse">
        <thead><tr class="text-xs" style="color:var(--ink-3)">
          <th class="px-2 py-1 font-medium text-left">#</th>
          <th class="px-2 py-1 font-medium text-left">Sitio</th>
          <th class="px-2 py-1 font-medium text-right">Visible</th>
          <th class="px-2 py-1 font-medium text-right">kWh/m²</th>
          <th class="px-2 py-1 font-medium text-right">Mixto</th>
          <th class="px-2 py-1"></th>
        </tr></thead>
        <tbody>${ranked.map(row).join("")}${ndRows}</tbody>
      </table>`;
  }

  function msg(text, isErr = false) {
    return `<p class="text-sm py-6 text-center" style="color:${
      isErr ? "var(--accent-red)" : "var(--ink-3)"}">${text}</p>`;
  }

  async function load() {
    loading = true; error = null; render();
    try { entries = await loadEntries(); }
    catch (e) { error = e.message; }
    finally { loading = false; render(); }
  }

  function setStep(s) {
    step = s;
    document.querySelectorAll("#top3-tabs .seg__btn").forEach((b) =>
      b.classList.toggle("is-active", b.dataset.step === s));
    render();
  }

  function open() { overlay.classList.add("is-open"); load(); }
  function close() { overlay.classList.remove("is-open"); }

  $("top3-tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".seg__btn");
    if (b) setStep(b.dataset.step);
  });
  $("top3-close").addEventListener("click", close);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  // "ver detalle" (tarjeta o fila): cierra el Top 3 y abre la card de detalle del sitio.
  content.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lat]");
    if (!b) return;
    close();
    onDetail?.(Number(b.dataset.lat), Number(b.dataset.lon), b.dataset.name);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("is-open")) close();
  });

  return { open, close, onDetail };   // onDetail se usa en el paso 4 (tarjetas/filas)
}
