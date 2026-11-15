// top3.js — comparación Top 3 (H5). Capa de datos (trae las métricas de todos los
// sitios seleccionados: semilla ⭐ + chinchetas 📍, arma el array `entries` que
// consume rank.js) + UI (consola tipo rack, ref. designReferences/top8.html: carrusel
// de 3 pasos con podio + tabla de posiciones desplegable).

import { getSites, getSite } from "./api.js";
import { getState, windowDays, startDate } from "./state.js";
import { rankBy } from "./rank.js";
import { fmtPct, fmtEnergy, fmtHours } from "./format.js";
import { siteIcon } from "./icons.js";

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
      energy: m.energy_kwh_m2.horizontal,   // kWh/m² horizontal (decisión H5)
      lit: m.lit_fraction };                // 0..1, fracción del tiempo con Sol
    cache.set(k, entry);
    return entry;
  } catch (e) {
    return { ...base, ok: false, error: e.message, vis: 0, gap: Infinity, energy: 0 };
  }
}

// Carga en paralelo las métricas de semilla + chinchetas con la ventana/fecha global.
// Tolera fallos por sitio (ok:false). Devuelve el array `entries` para rank.js.
export async function loadEntries(
  { win = windowDays(), date = startDate(), onProgress } = {},
) {
  const { sites } = await getSites();
  const pins = getState().sitios || [];
  const all = [
    ...sites.map((s) => [s, "seed"]),
    ...pins.map((s) => [s, "pin"]),
  ];
  let done = 0;
  onProgress?.(0, all.length);
  return Promise.all(all.map(([s, kind]) => fetchEntry(s, kind, win, date).then((r) => {
    onProgress?.(++done, all.length);       // cada sitio calculado hace avanzar la barra
    return r;
  })));
}


// ── UI: consola rack con carrusel de 3 pasos (comms / energía / mixto). Cada paso:
// podio de 3 tarjetas + tabla de posiciones desplegable; "ver detalle" en ambas.
const STEPS = ["mixed", "energy", "comms"];   // orden del carrusel (01 = mixto)
const W_COMMS = 0.5;   // peso de comms en el mixto (se muestra en la UI: honestidad §8)

// Texto por criterio. `sub` explica cómo se ordena (lenguaje llano).
const COPY = {
  comms: { title: "Top 3 — Comunicación directa con la Tierra",
    table: "ORDENADA POR TIEMPO CON LA TIERRA A LA VISTA",
    sub: "Clasificación según el tiempo total de línea de vista directa con la Tierra durante la ventana de tiempo elegida." },
  energy: { title: "Top 3 — Energía solar captada",
    table: "ORDENADA POR ENERGÍA SOLAR",
    sub: "Clasificación según la energía solar total que recibiría un panel solar apoyado " +
      "en el suelo durante la ventana de tiempo elegida." },
  mixed: { title: "Top 3 — Equilibrio entre comunicación y energía",
    table: "ORDENADA POR ÍNDICE MIXTO",
    sub: "Clasificación según el equilibrio entre energía solar total y tiempo de comunicación con la Tierra." },
};

const enc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/"/g, "&quot;");
const pos = (n) => `#${String(n).padStart(2, "0")}`;
const coords = (e) =>
  `${Math.abs(e.lat).toFixed(2)}°S ${(((e.lon % 360) + 360) % 360).toFixed(2)}°E`;
const kindTag = (k) => `<span class="t3-kind">${siteIcon(k, 13)}${
  k === "pin" ? "TUYO" : "PREDEFINIDO"}</span>`;

// "20 NOV – 20 DIC 2026 (30 DÍAS)" desde rangoFechas (UTC); sin rango → solo días.
function windowLabel(win) {
  const { desde, hasta } = getState().rangoFechas || {};
  if (!desde || !hasta) return `VENTANA: ${win} DÍAS`;
  const f = (d, o) => new Date(`${d}T00:00:00Z`).toLocaleDateString("es",
    { timeZone: "UTC", day: "2-digit", month: "short", ...o })
    .replace(/\./g, "").toUpperCase();
  return `VENTANA: ${f(desde)} – ${f(hasta, { year: "numeric" })} (${win} DÍAS)`;
}

// Bloque de telemetría de la tarjeta según el criterio: KPI principal + medidor + 2
// secundarios. Medidores: comms = % visible; energía/mixto = score normalizado 0–1.
function telemetry(step, e, win) {
  const visH = Math.round(e.vis * win * 24);
  const energy = `${fmtEnergy(e.energy)} kWh/m²`;
  const comms = `${fmtPct(e.vis)} (${visH} h)`;
  const sec = (a, av, ac, b, bv, bc) => `<div class="t3-sec">
      <div><span class="t3-sec__label">${a}</span><span class="t3-sec__val ${ac}">${av}</span></div>
      <div><span class="t3-sec__label">${b}</span><span class="t3-sec__val ${bc}">${bv}</span></div>
    </div>`;
  const kpi = (eyebrow, val, cls, pill, pillCls, pct, meterCls = "") => `<div>
      <span class="t3-eyebrow-sm">${eyebrow}</span>
      <div class="t3-kpi"><span class="t3-kpi__val ${cls}">${val}</span>
        ${pill ? `<span class="t3-pillbox ${pillCls}">${pill}</span>` : ""}</div>
      <div class="t3-meter ${meterCls}"><div style="width:${Math.round(pct * 100)}%"></div></div>
    </div>`;
  if (step === "comms") {
    return kpi(`Tiempo con la Tierra a la vista (de ${win * 24} h)`,
      `${fmtPct(e.vis)} <small>(${visH} h)</small>`, "t3-earth",
      "LÍNEA DE VISTA", "t3-pillbox--earth", e.vis) +
      sec("Corte más largo", fmtHours(e.gap), "", "Energía solar", energy, "t3-sun");
  }
  if (step === "energy") {
    return kpi("Energía captada (panel horizontal)",
      `${fmtEnergy(e.energy)} <small>kWh/m²</small>`, "t3-sun",
      `${fmtPct(e.lit)} CON SOL`, "t3-pillbox--sun", e.score.energy, "t3-meter--sun") +
      sec("Promedio diario", `${(e.energy / win).toFixed(2)} kWh/m²`, "",
        "Tierra a la vista", comms, "t3-earth");
  }
  return kpi("Índice mixto (comunicación + energía)",
    `${Math.round(e.score.mixed * 100)} <small>/ 100</small>`, "t3-earth",
    "", "", e.score.mixed) +
    sec("Energía solar", energy, "t3-sun", "Tierra a la vista", comms, "t3-earth");
}

// Carga: 3 tarjetas "esqueleto" con la forma real del podio + una barra de progreso que
// avanza con cada sitio calculado (efemérides de Sol y Tierra + horizonte, por sitio).
const skCard = (i) => `<article class="t3-rank t3-sk-card" style="--d:${i * 0.18}s"
    aria-hidden="true">
  <div>
    <div class="t3-sk t3-sk--badge"></div>
    <div class="t3-sk t3-sk--title"></div>
    <div class="t3-sk t3-sk--sub"></div>
  </div>
  <div class="t3-tele">
    <div class="t3-sk t3-sk--label"></div>
    <div class="t3-sk t3-sk--kpi"></div>
    <div class="t3-sk t3-sk--meter"></div>
    <div class="t3-sec">
      <div class="t3-sk t3-sk--sec"></div><div class="t3-sk t3-sk--sec"></div>
    </div>
    <div class="t3-sk t3-sk--btn"></div>
  </div>
</article>`;

const loadingHTML = () => `<div class="t3-load" role="status" aria-live="polite">
  <div class="t3-load__row"><span class="t3-load__dot" aria-hidden="true"></span>
    <span class="t3-load__txt"></span><span class="t3-load__n"></span></div>
  <div class="t3-load__bar"><span></span></div>
</div>${[0, 1, 2].map(skCard).join("")}`;

const detailAttrs = (e) =>
  `data-lat="${e.lat}" data-lon="${e.lon}" data-name="${enc(e.name)}"`;

function card(step, e, win, slide) {
  const first = e.rank === 1;
  return `<article class="t3-rank t3-rank--${e.rank} ${slide}">
    <div>
      <div class="t3-rank__top">
        <span class="t3-badge ${first ? "t3-badge--1" : ""}">PUESTO ${pos(e.rank)}</span>
        ${kindTag(e.kind)}
      </div>
      <h3 class="t3-name">${enc(e.name)}</h3>
      <p class="t3-coords">${coords(e)}</p>
    </div>
    <div class="t3-tele">
      ${telemetry(step, e, win)}
      <button type="button" class="t3-inspect ${first ? "t3-inspect--primary" : ""}"
        ${detailAttrs(e)}><span>Ver detalle</span><span>→</span></button>
    </div>
  </article>`;
}

function row(step, e, win) {
  const td = (col, v) => `<td class="${step === col ? "t3-td-sorted" : "t3-td-mono"}">${v}</td>`;
  return `<tr>
    <td class="t3-td-pos ${e.rank <= 3 ? "is-top" : ""}">${pos(e.rank)}</td>
    <td><div class="t3-td-site">${siteIcon(e.kind, 16)}<div>
      <strong>${enc(e.name)}</strong><small>${coords(e)}</small></div></div></td>
    ${td("mixed", `${Math.round(e.score.mixed * 100)} pts`)}
    ${td("energy", fmtEnergy(e.energy))}
    ${td("comms", `${fmtPct(e.vis)} (${Math.round(e.vis * win * 24)} h)`)}
    <td style="text-align:right"><button type="button" class="t3-row-btn"
      ${detailAttrs(e)}>DETALLE →</button></td>
  </tr>`;
}

const noDataRow = (e) => `<tr><td class="t3-td-pos">—</td>
  <td><div class="t3-td-site">${siteIcon(e.kind, 16)}<div>
    <strong>${enc(e.name)}</strong><small>${coords(e)}</small></div></div></td>
  <td class="t3-td-muted" colspan="4">sin datos (no se pudieron cargar sus efemérides)</td></tr>`;

export function createTop3({ onDetail } = {}) {
  const $ = (id) => document.getElementById(id);
  const overlay = $("top3-overlay");
  const cards = $("top3-content");
  const table = $("top3-table");
  let step = STEPS[0], entries = null, loading = false, error = null, win = windowDays();
  let prog = { done: 0, total: 0 };

  const msg = (text, isErr = false) =>
    `<p class="t3-msg ${isErr ? "t3-msg--err" : ""}">${text}</p>`;

  // Encabezado, pills, barra de progreso y columna activa del paso actual.
  function renderChrome(slide) {
    const c = COPY[step], i = STEPS.indexOf(step);
    $("top3-window").textContent = windowLabel(win);
    $("top3-title").textContent = c.title;
    $("top3-sub").textContent = c.sub;
    overlay.querySelectorAll(".t3-pill").forEach((b) => {
      const on = b.dataset.step === step;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-selected", String(on));
    });
    overlay.querySelectorAll(".t3-progress span").forEach((b, n) =>
      b.classList.toggle("is-filled", n <= i));
    overlay.querySelectorAll("th[data-col]").forEach((th) =>
      th.classList.toggle("is-active", th.dataset.col === step));
    const head = $("top3-head");
    head.classList.remove("t3-slide-next", "t3-slide-prev");
    if (slide) { void head.offsetWidth; head.classList.add(slide); }
  }

  function render(slide = "") {
    renderChrome(slide);
    const tbody = $("top3-tbody");
    // Sin datos (cargando / error / vacío): sin tabla ni botón para desplegarla.
    const showToggle = (on) => { $("top3-toggle").parentElement.style.display = on ? "" : "none"; };
    const empty = (html) => {
      cards.innerHTML = html; tbody.innerHTML = ""; $("top3-count").textContent = "";
      showToggle(false); setTable(false);
    };
    if (loading) { empty(loadingHTML()); return setProgress(prog.done, prog.total); }
    if (error) return empty(msg(`No se pudo cargar: ${enc(error)}`, true));
    if (!entries) return empty("");
    const { ranked, noData } = rankBy(entries, step, { wComms: W_COMMS });
    if (!ranked.length) return empty(msg("Ningún sitio con datos para rankear."));
    cards.innerHTML = ranked.slice(0, 3).map((e) => card(step, e, win, slide)).join("");
    tbody.innerHTML = ranked.map((e) => row(step, e, win)).join("") +
      noData.map(noDataRow).join("");
    $("top3-count").textContent = `${entries.length} SITIOS EVALUADOS`;
    showToggle(true);
  }

  // Actualiza solo la barra y el texto (sin rehacer los esqueletos: el shimmer no se corta).
  function setProgress(done, total) {
    prog = { done, total };
    const box = cards.querySelector(".t3-load");
    if (!loading || !box) return;
    box.querySelector(".t3-load__txt").textContent = total
      ? "Calculando energía y visibilidad de la Tierra" : "Preparando el cálculo";
    box.querySelector(".t3-load__n").textContent = total ? `${done} / ${total} sitios` : "";
    box.querySelector(".t3-load__bar > span").style.width =
      `${total ? Math.max(6, Math.round((done / total) * 100)) : 6}%`;
  }

  async function load() {
    win = windowDays();
    prog = { done: 0, total: 0 };
    loading = true; error = null; render();
    try { entries = await loadEntries({ win, onProgress: setProgress }); }
    catch (e) { error = e.message; }
    finally { loading = false; render(); }
  }

  function goTo(next) {
    if (next === step) return;
    const slide = STEPS.indexOf(next) < STEPS.indexOf(step) ? "t3-slide-prev" : "t3-slide-next";
    step = next;
    render(slide);
  }
  // Carrusel circular (‹ › y flechas del teclado).
  const shift = (d) => {
    const n = STEPS.length, i = STEPS.indexOf(step);
    const next = STEPS[(i + d + n) % n];
    step = next;
    render(d < 0 ? "t3-slide-prev" : "t3-slide-next");
  };

  function setTable(open) {
    table.classList.toggle("is-open", open);
    $("top3-toggle").setAttribute("aria-expanded", String(open));
    $("top3-toggle-text").textContent = open
      ? "OCULTAR TABLA DE POSICIONES" : "VER TABLA DE POSICIONES COMPLETA";
    $("top3-toggle-arrow").textContent = open ? "↑" : "↓";
    if (open) table.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const isOpen = () => overlay.classList.contains("is-open");
  function open() { overlay.classList.add("is-open"); load(); }
  function close() { overlay.classList.remove("is-open"); setTable(false); }

  $("top3-tabs").addEventListener("click", (e) => {
    const b = e.target.closest(".t3-pill");
    if (b) goTo(b.dataset.step);
  });
  $("top3-prev").addEventListener("click", () => shift(-1));
  $("top3-next").addEventListener("click", () => shift(1));
  $("top3-toggle").addEventListener("click", () =>
    setTable(!table.classList.contains("is-open")));
  $("top3-close").addEventListener("click", close);
  // Click en el scrim (fuera de la consola) cierra; "ver detalle" (tarjeta o fila)
  // cierra el Top 3 y abre el skyline del sitio sobre el mapa.
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) return close();
    const b = e.target.closest("[data-lat]");
    if (!b) return;
    close();
    onDetail?.(Number(b.dataset.lat), Number(b.dataset.lon), b.dataset.name);
  });
  document.addEventListener("keydown", (e) => {
    if (!isOpen()) return;
    if (e.key === "Escape") close();
    else if (e.key === "ArrowLeft") shift(-1);
    else if (e.key === "ArrowRight") shift(1);
  });

  return { open, close };
}
