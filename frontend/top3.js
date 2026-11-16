// top3.js — comparación Top 3 (H5). Capa de datos (trae las métricas de todos los
// sitios seleccionados: semilla ⭐ + chinchetas 📍, arma el array `entries` que
// consume rank.js) + UI (consola tipo rack, ref. designReferences/top8.html: carrusel
// de 3 pasos con podio + tabla de posiciones desplegable).

import { getSites, getSite } from "./api.js";
import { errorMessage, isAbort } from "./errors.js";
import { getState, windowDays, startDate } from "./state.js";
import { rankBy } from "./rank.js";
import { fmtPct, fmtEnergy, fmtHours } from "./format.js";
import { siteIcon } from "./icons.js";
import { formatReadable } from "./dates.js";

// Acceso corto al motor i18n (window.i18n lo define i18n.js, cargado antes de los módulos).
const T = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);

// Cache de entries OK por (sitio × ventana × fecha). Reabrir el Top 3 no re-pide;
// cambiar la ventana/fecha cambia la clave → refetch automático. Los errores NO se
// cachean (ej. 503 por falta de red): se reintenta la próxima vez.
const cache = new Map();
const keyOf = (lat, lon, win, date) => `${lat},${lon},${win},${date || ""}`;

async function fetchEntry(site, kind, win, date, signal) {
  const k = keyOf(site.lat, site.lon, win, date);
  if (cache.has(k)) return { ...cache.get(k), name: site.name };
  const base = { name: site.name, lat: site.lat, lon: site.lon, kind };
  try {
    const r = await getSite(site.lat, site.lon,
      { windowDays: win, date, signal, timeout: SITE_TIMEOUT_MS });
    const m = r.metrics;
    const entry = { ...base, ok: true,
      vis: m.earth_vis_fraction,            // 0..1, mayor mejor
      gap: m.longest_comms_gap_h,           // horas, menor mejor (desempate comms)
      energy: m.energy_kwh_m2.horizontal,   // kWh/m² horizontal (decisión H5)
      lit: m.lit_fraction };                // 0..1, fracción del tiempo con Sol
    cache.set(k, entry);
    return entry;
  } catch (e) {
    return { ...base, ok: false, err: e, vis: 0, gap: Infinity, energy: 0 };
  }
}

// Carga las métricas de semilla + chinchetas con la ventana/fecha global, de a CONCURRENCY
// sitios a la vez (cada sitio nuevo puede bajar efemérides en vivo: pedirlos todos juntos
// satura al backend y a Horizons). Tolera fallos por sitio (ok:false). Devuelve el array
// `entries` para rank.js, en el orden de los sitios.
const CONCURRENCY = 3;
const SITE_TIMEOUT_MS = 30000;   // tope por sitio (si el backend cuelga, no esperar 60 s por lote)

export async function loadEntries(
  { win = windowDays(), date = startDate(), onProgress, signal } = {},
) {
  const { sites } = await getSites({ signal });
  const pins = getState().sitios || [];
  const all = [
    ...sites.map((s) => [s, "seed"]),
    ...pins.map((s) => [s, "pin"]),
  ];
  const out = new Array(all.length);
  let next = 0, done = 0;
  onProgress?.(0, all.length);
  async function worker() {
    while (next < all.length) {
      const i = next++;
      const [site, kind] = all[i];
      out[i] = await fetchEntry(site, kind, win, date, signal);
      onProgress?.(++done, all.length);     // cada sitio calculado hace avanzar la barra
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, all.length) }, worker));
  return out;
}

// ── UI: consola rack con carrusel de 3 pasos (comms / energía / mixto). Cada paso:
// podio de 3 tarjetas + tabla de posiciones desplegable; "ver detalle" en ambas.
const STEPS = ["mixed", "energy", "comms"];   // orden del carrusel (01 = mixto)
const W_COMMS = 0.5;   // peso de comms en el mixto (se muestra en la UI: honestidad §8)

// Título y bajada por criterio (traducidos): claves t3.<criterio>.title / .sub.
const copy = (step) => ({ title: T(`t3.${step}.title`), sub: T(`t3.${step}.sub`) });

const enc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/"/g, "&quot;");
const pos = (n) => `#${String(n).padStart(2, "0")}`;
const coords = (e) =>
  `${Math.abs(e.lat).toFixed(2)}°S ${(((e.lon % 360) + 360) % 360).toFixed(2)}°E`;
const kindTag = (k) => `<span class="t3-kind">${siteIcon(k, 13)}${
  T(k === "pin" ? "t3.kind.pin" : "t3.kind.seed")}</span>`;

// "VENTANA: 20 NOV – 20 DIC 2026 (30 DÍAS)" / "WINDOW: …" desde rangoFechas (UTC); sin rango,
// solo los días. Las fechas siguen el idioma activo (dates.js).
function windowLabel(win) {
  const { desde, hasta } = getState().rangoFechas || {};
  if (!desde || !hasta) return T("t3.windowDays", { n: win });
  return T("t3.window", { n: win,
    from: formatReadable(desde, { year: false }).toUpperCase(),
    to: formatReadable(hasta).toUpperCase() });
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
    return kpi(T("t3.k.commsEyebrow", { h: win * 24 }),
      `${fmtPct(e.vis)} <small>(${visH} h)</small>`, "t3-earth",
      T("t3.k.lineOfSight"), "t3-pillbox--earth", e.vis) +
      sec(T("t3.k.longestGap"), fmtHours(e.gap), "", T("t3.k.solar"), energy, "t3-sun");
  }
  if (step === "energy") {
    return kpi(T("t3.k.energyEyebrow"),
      `${fmtEnergy(e.energy)} <small>kWh/m²</small>`, "t3-sun",
      T("t3.k.lit", { pct: fmtPct(e.lit) }), "t3-pillbox--sun", e.score.energy,
      "t3-meter--sun") +
      sec(T("t3.k.daily"), `${(e.energy / win).toFixed(2)} kWh/m²`, "",
        T("t3.k.earthView"), comms, "t3-earth");
  }
  return kpi(T("t3.k.mixedEyebrow"),
    `${Math.round(e.score.mixed * 100)} <small>/ 100</small>`, "t3-earth",
    "", "", e.score.mixed) +
    sec(T("t3.k.solar"), energy, "t3-sun", T("t3.k.earthView"), comms, "t3-earth");
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
        <span class="t3-badge ${first ? "t3-badge--1" : ""}">${
          T("t3.rank", { n: pos(e.rank) })}</span>
        ${kindTag(e.kind)}
      </div>
      <h3 class="t3-name">${enc(e.name)}</h3>
      <p class="t3-coords">${coords(e)}</p>
    </div>
    <div class="t3-tele">
      ${telemetry(step, e, win)}
      <button type="button" class="t3-inspect ${first ? "t3-inspect--primary" : ""}"
        ${detailAttrs(e)}><span>${T("t3.detail")}</span><span>→</span></button>
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
      ${detailAttrs(e)}>${T("t3.rowDetail")}</button></td>
  </tr>`;
}

const noDataRow = (e) => `<tr><td class="t3-td-pos">—</td>
  <td><div class="t3-td-site">${siteIcon(e.kind, 16)}<div>
    <strong>${enc(e.name)}</strong><small>${coords(e)}</small></div></div></td>
  <td class="t3-td-muted" colspan="4">${T("t3.noData")}</td></tr>`;

export function createTop3({ onDetail } = {}) {
  const $ = (id) => document.getElementById(id);
  const overlay = $("top3-overlay");
  const cards = $("top3-content");
  const table = $("top3-table");
  let step = STEPS[0], entries = null, loading = false, error = null, win = windowDays();
  let prog = { done: 0, total: 0 };
  let ctrl = null, loadSeq = 0;      // carga en curso: se cancela/descarta al cerrar o reabrir

  const retryBtn = (cls = "") =>
    `<button type="button" class="t3-retry ${cls}" data-act="retry">${
      T("common.retry")}</button>`;
  const msg = (text, isErr = false, retry = false) =>
    `<div class="t3-msg ${isErr ? "t3-msg--err" : ""}"><p>${text}</p>${
      retry ? retryBtn() : ""}</div>`;

  // Encabezado, pills, barra de progreso y columna activa del paso actual.
  function renderChrome(slide) {
    const c = copy(step), i = STEPS.indexOf(step);
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
    if (error) return empty(msg(enc(errorMessage(error)), true, true));
    if (!entries) return empty("");
    const { ranked, noData } = rankBy(entries, step, { wComms: W_COMMS });
    if (!entries.length) return empty(msg(T("t3.empty")));
    if (!ranked.length) {                    // fallaron TODOS: se dice por qué + reintentar
      const why = enc(errorMessage(noData[0]?.err));
      return empty(msg(`${T("t3.allFailed")} ${why}`, true, true));
    }
    // Si fallaron ALGUNOS, el podio es de los que sí respondieron: se avisa que es parcial
    // (antes parecía un ranking completo) y se ofrece reintentar solo esos sitios.
    const warn = noData.length ? `<div class="t3-warn" role="status"><span>${
      T("t3.partial", { bad: noData.length, total: entries.length })}</span>${
      retryBtn("t3-retry--sm")}</div>` : "";
    cards.innerHTML = warn + ranked.slice(0, 3).map((e) => card(step, e, win, slide)).join("");
    tbody.innerHTML = ranked.map((e) => row(step, e, win)).join("") +
      noData.map(noDataRow).join("");
    $("top3-count").textContent = T("t3.count", { n: entries.length });
    showToggle(true);
  }

  // Actualiza solo la barra y el texto (sin rehacer los esqueletos: el shimmer no se corta).
  function setProgress(done, total) {
    prog = { done, total };
    const box = cards.querySelector(".t3-load");
    if (!loading || !box) return;
    const txt = box.querySelector(".t3-load__txt"), n = box.querySelector(".t3-load__n");
    txt.textContent = T(total ? "t3.load.calc" : "t3.load.prep");
    n.textContent = total ? T("t3.load.n", { done, total }) : "";
    box.querySelector(".t3-load__bar > span").style.width =
      `${total ? Math.max(6, Math.round((done / total) * 100)) : 6}%`;
  }

  // Reintentar vuelve a llamar a load(): lo ya calculado sale del caché, solo se re-piden
  // los sitios que habían fallado (los errores no se cachean).
  async function load() {
    ctrl?.abort();                            // una carga nueva cancela la anterior
    ctrl = new AbortController();
    const my = ++loadSeq, signal = ctrl.signal;
    win = windowDays();
    prog = { done: 0, total: 0 };
    loading = true; error = null; render();
    try {
      const res = await loadEntries({
        win, signal, onProgress: (d, t) => { if (my === loadSeq) setProgress(d, t); } });
      if (my !== loadSeq) return;             // cerrado o reabierto mientras cargaba
      entries = res;
    } catch (e) {
      if (my !== loadSeq || isAbort(e)) return;
      error = e; entries = null;
    }
    loading = false; render();
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

  // Texto del botón de la tabla según esté abierta o no (se re-aplica al cambiar de idioma).
  const syncToggleText = () => {
    $("top3-toggle-text").textContent =
      T(table.classList.contains("is-open") ? "t3.toggleHide" : "t3.toggleShow");
  };

  function setTable(open) {
    table.classList.toggle("is-open", open);
    $("top3-toggle").setAttribute("aria-expanded", String(open));
    syncToggleText();
    $("top3-toggle-arrow").textContent = open ? "↑" : "↓";
    if (open) table.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  const isOpen = () => overlay.classList.contains("is-open");
  function open() { overlay.classList.add("is-open"); load(); }
  function close() {
    ctrl?.abort(); loadSeq++; loading = false;   // lo que esté en vuelo ya no se muestra
    overlay.classList.remove("is-open"); setTable(false);
  }

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
    if (e.target.closest("[data-act='retry']")) return load();
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

  // Al cambiar de idioma: el texto estático lo re-aplica i18n.apply; acá se regenera lo que
  // se arma por JS (encabezado, tarjetas, tabla, carga) y el texto del botón de la tabla.
  document.addEventListener("i18n:change", () => {
    if (!isOpen()) return;
    render();
    syncToggleText();
  });

  return { open, close };
}
