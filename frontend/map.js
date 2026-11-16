// Hub del mapa polar (H3). Fondo = raster de luz promedio; ⭐ sitios semilla y
// 📍 chinchetas del usuario ubicados por proyección; click → detalle (modal H2) o
// botón flotante para agregar/ver un sitio libre. El estado global es de H4; acá
// mantenemos solo las chinchetas locales.

import { getSites, getSite, mapUrl, getMapMeta } from "./api.js";
import { createProjection } from "./proj.js";
import { createDetailModal } from "./detailModal.js";
import { createTop3 } from "./top3.js";
import { siteIcon } from "./icons.js";
import { drawGlobe as drawGlobeInto, GLOBE_DARK } from "./globe.js";
import { showWelcome } from "./welcome.js";
import { mountMoonFrame } from "./moonFrame.js";
import { initLayout, getScale } from "./layout.js";
import { createDateRange } from "./dateRange.js";
import { ApiError, getHealth } from "./api.js";
import { errorMessage } from "./errors.js";
import { windowDays, startDate, addSitio, removeSitio, setSitioActivo, getState,
  renameSitio, setRango } from "./state.js";

const $ = (id) => document.getElementById(id);
const T = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);

// El módulo evaluó todos sus imports: la app arrancó. Lo sabe el vigía de map.html, que si no
// llega a verlo muestra un aviso (y si el aviso ya salió por lentitud, lo retira).
window.__appBooted = true;
document.getElementById("boot-fatal")?.remove();
const stage = $("map-stage");
const world = $("map-world");
const zoomSlider = $("zoom-slider");
const zoomLabel = $("zoom-label");
const zoomInBtn = $("zoom-in-btn");
const zoomOutBtn = $("zoom-out-btn");
const zoomResetBtn = $("zoom-reset-btn");

// Capa interactiva: misma caja que el disco (inset 14%) pero sin recorte. De acá salen
// los clicks/hover y la lectura de coordenadas (bounding box idéntico al disco).
const disk = $("map-overlay");
const layer = $("map-markers");
let proj = null;
let activeSite = null;         // {lat, lon} del sitio activo (apoyo de la cuña, §2.3)

// Estado del zoom y arrastre: 1.0 = zoom out máximo (estado inicial por defecto).
let zoom = 1.0;
let panX = 0;
let panY = 0;
const MIN_ZOOM = 1.0;
const MAX_ZOOM = 5.0;
let isPointerDown = false;
let isDragging = false;
let justDragged = false;
let startX = 0, startY = 0;
let origPanX = 0, origPanY = 0;
let pointerId = null;
let lastArrowParams = null;
const modal = createDetailModal({
  windowDays, date: startDate,
  // Sincronización por azimut: la ventana del skyline mueve la cuña del mapa en vivo.
  onAzimuthWindow: (win) => { if (activeSite) drawCone(activeSite.lat, activeSite.lon, win); },
  // El slider mueve las flechas Sol/Tierra al azimut del instante (mismo marco local).
  onInstant: (sunAz, earthAz, tLabel) => {
    if (activeSite) {
      drawDirArrows(sunAz, earthAz, tLabel, localFrame(activeSite.lat, activeSite.lon));
    }
  },
});
// "Ver detalle" desde el Top 3: misma selección que clickear el marcador en el mapa
// (resalta el marcador, ancla cuña/flechas y abre el skyline).
const top3 = createTop3({ onDetail: (lat, lon, name) => selectSite(lat, lon, name) });

function setStatus(msg) { $("map-status").textContent = msg || ""; }

const SVGNS = "http://www.w3.org/2000/svg";
const CONE = "#d946ef", CONE_EDGE = "#f0abfc";   // cuña de azimut (fucsia, §2.3)

// Geometría del disco de luna en unidades del stage (viewBox 0..1000, centro=500).
// DEBE coincidir con `inset` de #map-disk en map.html. Disco más chico ⇒ más cielo.
const DISK_MARGIN = 140;                          // inset 14%
const DISK_SPAN = 1000 - 2 * DISK_MARGIN;         // ancho del disco (720)
const DISK_R = DISK_SPAN / 2;                      // radio del disco (360)
function svg(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Campo de estrellas determinista (LCG, semilla fija): mismas posiciones siempre.
// Se dibuja en el margen oscuro, detrás del disco de luna (que las tapa en el centro).
const STARS = (() => {
  let s = 0x9e3779b1;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const out = [];
  for (let i = 0; i < 180; i++) {
    out.push({ x: rnd() * 1000, y: rnd() * 1000, r: 0.6 + rnd() * 1.6,
      o: 0.3 + rnd() * 0.6 });
  }
  return out;
})();

function drawStars(go) {
  for (const st of STARS) {
    // Saltamos las que caen dentro del disco: el disco las taparía igual.
    if ((st.x - 500) ** 2 + (st.y - 500) ** 2 < (DISK_R + 5) ** 2) continue;
    go.appendChild(svg("circle", { cx: st.x, cy: st.y, r: st.r,
      fill: "#fff", opacity: st.o }));
  }
}

// Orientación. El chrome se reparte en dos capas:
//  · INTERIOR (#map-chrome, dentro del disco de luna): anillos de latitud + polo.
//  · EXTERIOR (#map-chrome-outer, sobre el margen claro): globo, escala y flechas.
// Ambos SVG en unidades 0..1000 sobre el stage cuadrado (preserveAspectRatio="none").
// El disco ocupa el 80% central (inset 10%): centro=500, radio=400 en estas unidades.
function drawChrome() {
  const g = $("map-chrome");               // interior del disco (sobre textura)
  const go = $("map-chrome-outer");        // margen oscuro estrellado del lienzo
  g.innerHTML = "";
  go.innerHTML = "";
  $("map-chrome-fg").innerHTML = "";
  drawStars(go);                           // estrellas detrás de la luna de fondo
  const C = 500;                           // centro (polo sur) en unidades SVG
  const ring = (lat) => {
    const r = proj.latRingRadius(lat) * 1000;
    g.appendChild(svg("circle", { cx: C, cy: C, r, fill: "none",
      stroke: "white", "stroke-opacity": 0.5, "stroke-dasharray": "5 7",
      "vector-effect": "non-scaling-stroke" }));
    const t = svg("text", { x: C, y: C - r + 14, fill: "white", "fill-opacity": 0.85,
      "font-size": 20, "text-anchor": "middle", "font-family": "JetBrains Mono",
      "data-base-size": 20 });
    t.textContent = `${Math.abs(lat)}°S`;
    g.appendChild(t);
  };
  ring(-85);
  ring(-88);
  // Polo sur (90°S): cruz + etiqueta (interior).
  g.appendChild(svg("path", { d: `M${C - 9} ${C}H${C + 9}M${C} ${C - 9}V${C + 9}`,
    stroke: "white", "stroke-opacity": 0.7, "stroke-width": 2,
    "vector-effect": "non-scaling-stroke" }));
  const pt = svg("text", { x: C + 12, y: C + 6, fill: "white", "fill-opacity": 0.75,
    "font-size": 18, "font-family": "JetBrains Mono", "data-base-size": 18 });
  pt.textContent = T("map.poleS");
  g.appendChild(pt);
  updateChromeTextSizes();
  // Chrome del margen (sobre el lienzo claro): globo + barra de escala.
  drawGlobe();
  drawScaleBar(zoom);
}

function updateChromeTextSizes() {
  const g = $("map-chrome");
  if (!g) return;
  const texts = g.querySelectorAll("text[data-base-size]");
  for (const t of texts) {
    const base = parseFloat(t.getAttribute("data-base-size"));
    t.setAttribute("font-size", (base / zoom).toFixed(1));
  }
}

// Globo-localizador (abajo-izquierda): el dibujo vive en globe.js (compartido con la
// bienvenida); acá solo su posición/tamaño y la paleta para fondo oscuro, con la flecha.
const GLOBE = { cx: 106, cy: 882, r: 84, tilt: 28, cap: 18 };

function drawGlobe() {
  drawGlobeInto($("map-chrome-fg"), GLOBE, GLOBE_DARK, { arrow: true });
}

// Barra de escala en el margen inferior. 100 km = (100/303.48) del ancho del DISCO,
// que mide DISK_SPAN unidades de stage. Colores claros: va sobre oscuro.
function drawScaleBar(z = 1) {
  const go = $("map-chrome-fg");
  const old = $("map-scale-bar");
  if (old) old.remove();
  const grp = svg("g", { id: "map-scale-bar" });
  let km = 100;
  if (z >= 4.0) km = 20;
  else if (z >= 2.8) km = 30;
  else if (z >= 1.7) km = 50;
  const len = ((km * 1000) / 303480) * DISK_SPAN * z;
  const x0 = 500 - len / 2, y = 960;
  grp.appendChild(svg("path", {
    d: `M${x0} ${y}h${len}M${x0} ${y - 7}v14M${x0 + len} ${y - 7}v14`,
    stroke: "#cbd5e1", "stroke-opacity": 0.95, "stroke-width": 2.5 }));
  const st = svg("text", { x: 500, y: y - 12, fill: "#cbd5e1",
    "font-size": 18, "text-anchor": "middle", "font-family": "JetBrains Mono" });
  st.textContent = `${km} km`;
  grp.appendChild(st);
  go.appendChild(grp);
}

// Flechas de DIRECCIÓN (no visibilidad) de Sol y Tierra, EN EL MARGEN claro, fuera
// del disco de luna (radio 400). Una bearing A (azimut 0=N horario) mapea a dirección
// de pantalla (sinA, -cosA) desde el polo. Son la dirección en UN instante (inicio de
// ventana), rotulado para honestidad. Dibuja en la capa exterior (sobre fondo claro).
function drawDirArrows(sunAz, earthAz, tLabel, frame) {
  lastArrowParams = { sunAz, earthAz, tLabel, frame };
  const g = $("map-chrome-fg"), C = 500, R = DISK_R + 50;  // órbita fija en el polo
  const old = $("map-arrows");
  if (old) old.remove();                     // redibujo por tick: reemplaza el grupo
  const grp = svg("g", { id: "map-arrows" });
  const { nx, ny, ex, ey } = frame;
  // Posición del sitio en stage considerando zoom y arrastre:
  const stageW = stage.clientWidth || 680;
  const baseOx = DISK_MARGIN + frame.P[0] * DISK_SPAN;
  const baseOy = DISK_MARGIN + frame.P[1] * DISK_SPAN;
  const ox = baseOx * zoom + (panX / stageW) * 1000;
  const oy = baseOy * zoom + (panY / stageW) * 1000;
  const fx = ox - C, fy = oy - C;            // sitio relativo al centro
  const ASTRO_R = 11, AL = ASTRO_R * 2.8;    // ~50% más grande; AL = flecha corta
  const arrow = (azDeg, color, label) => {
    const a = (azDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = c * nx + s * ex, dy = c * ny + s * ey;
    // Astro = donde el rayo desde el sitio cruza el anillo fijo (o margen si hay zoom)
    const targetR = zoom > 1 ? Math.max(R, Math.hypot(fx, fy) + 90) : R;
    const fd = fx * dx + fy * dy;
    const disc = fd * fd - (fx * fx + fy * fy - targetR * targetR);
    const t = disc >= 0 ? -fd + Math.sqrt(disc) : targetR;
    const tx = ox + dx * t, ty = oy + dy * t;    // posición del astro
    // Flecha corta centrada en el astro: AL unidades antes y después del centro.
    const ax1 = tx - dx * AL, ay1 = ty - dy * AL;
    const ax2 = tx + dx * AL, ay2 = ty + dy * AL;
    grp.appendChild(svg("line", { x1: ax1, y1: ay1, x2: ax2, y2: ay2,
      stroke: "#0b1124", "stroke-width": 10, "stroke-linecap": "round",
      "stroke-opacity": 0.5 }));
    grp.appendChild(svg("line", { x1: ax1, y1: ay1, x2: ax2, y2: ay2,
      stroke: color, "stroke-width": 7, "stroke-linecap": "round" }));
    // Punta (en el extremo que apunta lejos del sitio).
    const px = -dx, py = -dy, qx = -dy, qy = dx, sz = 13;
    grp.appendChild(svg("path", { stroke: color, "stroke-width": 7, fill: "none",
      "stroke-linecap": "round", "stroke-linejoin": "round",
      d: `M${ax2 + (px + qx) * sz} ${ay2 + (py + qy) * sz}L${ax2} ${ay2}` +
         `L${ax2 + (px - qx) * sz} ${ay2 + (py - qy) * sz}` }));
    // Astro: disco de color + rótulo con halo.
    grp.appendChild(svg("circle", { cx: tx, cy: ty, r: ASTRO_R, fill: color,
      stroke: "#0b1124", "stroke-width": 2.5 }));
    const lbl = svg("text", { x: tx, y: ty - 18, fill: "#f3f6fb", "text-anchor": "middle",
      "font-size": 18, "font-family": "Inter", "font-weight": 600,
      stroke: "#0b1124", "stroke-width": 3, "paint-order": "stroke" });
    lbl.textContent = label;
    grp.appendChild(lbl);
  };
  arrow(sunAz, "#f59e0b", T("common.sun"));
  arrow(earthAz, "#60a5fa", T("common.earth"));
  g.appendChild(grp);
}

// Marco local del sitio (Norte/Este como vectores de pantalla) derivado de la
// proyección: lonlatToNorm en lat±ε / lon±ε. La estereográfica es conforme ⇒ N⊥E
// unitarios. Lo comparten la cuña y las flechas para que apunten igual.
function localFrame(lat, lon) {
  const EPS = 0.1;
  const P = proj.lonlatToNorm(lon, lat);
  const unit = (a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], m = Math.hypot(dx, dy);
    return m > 1e-9 ? [dx / m, dy / m] : [0, 0];
  };
  const [nx, ny] = unit(P, proj.lonlatToNorm(lon, lat + EPS));
  const [ex, ey] = unit(P, proj.lonlatToNorm(lon + EPS, lat));
  return { P, nx, ny, ex, ey };
}

// Cuña de visión (§2.3) en el sitio activo: refleja la ventana de azimut del skyline.
// El marco local (Norte/Este en pantalla) se deriva de la proyección (lonlatToNorm en
// lat±ε, lon±ε), así el azimut apunta bien en cualquier longitud. La estereográfica es
// conforme → N⊥E y la cuña sale como un sector circular. Se dibuja en #map-chrome
// (sobre el raster, bajo los marcadores) y reemplaza la cuña anterior.
function drawCone(lat, lon, win) {
  const old = $("map-cone");
  if (old) old.remove();
  if (!proj || !win) return;
  const { P, nx, ny, ex, ey } = localFrame(lat, lon);
  const cx = P[0] * 1000, cy = P[1] * 1000, R = 200;
  const sweep = ((win.hasta - win.desde + 360) % 360) || 360;
  const dir = (azDeg, rad = R) => {
    const a = (azDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    return [cx + rad * (c * nx + s * ex), cy + rad * (c * ny + s * ey)];
  };
  const steps = Math.max(2, Math.round(sweep / 6));
  let d = `M${cx.toFixed(1)} ${cy.toFixed(1)}`;
  for (let i = 0; i <= steps; i++) {
    const [px, py] = dir(win.desde + (sweep * i) / steps);
    d += `L${px.toFixed(1)} ${py.toFixed(1)}`;
  }
  const g = svg("g", { id: "map-cone" });
  const defs = svg("defs", {});
  // Relleno radial desde el vértice: brilla en el sitio y se desvanece hacia el arco
  // (linterna en vista cenital), sin línea dura en la parte redondeada.
  const grad = svg("radialGradient",
    { id: "cone-grad", gradientUnits: "userSpaceOnUse", cx, cy, r: R });
  grad.appendChild(svg("stop", { offset: 0, "stop-color": CONE, "stop-opacity": 0.6 }));
  grad.appendChild(svg("stop", { offset: 0.6, "stop-color": CONE, "stop-opacity": 0.28 }));
  grad.appendChild(svg("stop", { offset: 1, "stop-color": CONE, "stop-opacity": 0 }));
  defs.appendChild(grad);
  // Bordes rectos marcados que MUEREN con el degradado: cada uno un linearGradient
  // del vértice (opaco) al arco (transparente), así no cortan en seco.
  const eA = dir(win.desde), eB = dir(win.desde + sweep);
  const edgeGrad = (id, p) => {
    const lg = svg("linearGradient",
      { id, gradientUnits: "userSpaceOnUse", x1: cx, y1: cy, x2: p[0], y2: p[1] });
    lg.appendChild(svg("stop", { offset: 0, "stop-color": CONE_EDGE, "stop-opacity": 0.95 }));
    lg.appendChild(svg("stop", { offset: 1, "stop-color": CONE_EDGE, "stop-opacity": 0 }));
    defs.appendChild(lg);
  };
  edgeGrad("cone-edge-a", eA);
  edgeGrad("cone-edge-b", eB);
  g.appendChild(defs);
  g.appendChild(svg("path", { d: `${d}Z`, fill: "url(#cone-grad)", stroke: "none" }));
  g.appendChild(svg("line", { x1: cx, y1: cy, x2: eA[0], y2: eA[1],
    stroke: "url(#cone-edge-a)", "stroke-width": 2.5, "stroke-linecap": "round",
    "vector-effect": "non-scaling-stroke" }));
  g.appendChild(svg("line", { x1: cx, y1: cy, x2: eB[0], y2: eB[1],
    stroke: "url(#cone-edge-b)", "stroke-width": 2.5, "stroke-linecap": "round",
    "vector-effect": "non-scaling-stroke" }));
  g.appendChild(svg("circle", { cx, cy, r: 4, fill: CONE_EDGE,
    stroke: "#0b1124", "stroke-width": 1.5,
    "vector-effect": "non-scaling-stroke" }));
  $("map-chrome").appendChild(g);
}

let activeEl = null;
const markers = new Map();     // "lat,lon" → elemento del marcador (lookup desde el Top 3)
const markerKey = (lat, lon) => `${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;

// Selecciona un sitio: marcador activo + sitio activo (cuña/flechas) + abre el detalle.
// Si no se pasa el marcador, se busca por lat/lon (caso Top 3).
function selectSite(lat, lon, name, m = markers.get(markerKey(lat, lon))) {
  const isPin = m?.dataset.kind === "pin";
  // Pins: el nombre vigente sale del estado (puede haber sido renombrado).
  const cur = isPin ? getState().sitios.find(
    (p) => Math.abs(p.lat - lat) < 1e-6 && Math.abs(p.lon - lon) < 1e-6)?.name ?? name : name;
  setActive(m || null);
  activeSite = { lat, lon };
  setSitioActivo({ lat, lon, name: cur });
  modal.open(lat, lon, cur, isPin ? {
    onDelete: () => deletePin(lat, lon, m),
    onRename: makeRenameCallback(lat, lon, m),
  } : {});
}

// Resalta el marcador activo (el nombre del sitio ya lo muestra la card de detalle).
function setActive(el) {
  if (activeEl) activeEl.classList.remove("is-active");
  activeEl = el;
  if (el) el.classList.add("is-active");
}

function addMarker(lon, lat, name, kind) {
  const [u, v] = proj.lonlatToNorm(lon, lat);
  const m = document.createElement("button");
  m.className = "marker";
  m.style.left = `${u * 100}%`;
  m.style.top = `${v * 100}%`;
  m.innerHTML = `<span class="marker__ring"></span>${siteIcon(kind, kind === "pin" ? 28 : 24)}`;
  m.title = `${name} · ${lat.toFixed(2)}°, ${lon.toFixed(2)}°E`;
  m.dataset.kind = kind;
  m.addEventListener("click", (e) => {
    e.stopPropagation();
    if (isDragging || justDragged || modal.isLoading()) return;
    // Toggle: click en el sitio ya seleccionado (con el detalle abierto) lo cierra.
    const open = $("detail-overlay").classList.contains("is-open");
    if (activeEl === m && open) {
      modal.close();
      setActive(null);
      return;
    }
    selectSite(lat, lon, name, m);
  });
  markers.set(markerKey(lat, lon), m);
  layer.appendChild(m);
  return m;
}

// Borra una chincheta propia: del estado, del mapa, la cuña y cierra el detalle.
function deletePin(lat, lon, m) {
  removeSitio(lat, lon);
  markers.delete(markerKey(lat, lon));
  if (m) m.remove();
  if (activeEl === m) setActive(null);
  activeSite = null;
  modal.close();
  const cone = $("map-cone");
  if (cone) cone.remove();
}

// Click en zona libre (dentro del disco): agrega una chincheta 📍 y abre su detalle.
// Sin paso intermedio: el detalle carga en vivo (ver loader en detailModal).
const siteExistsAt = (lat, lon) => markers.has(markerKey(lat, lon));

function onFreeClick(e) {
  if (!proj || isDragging || justDragged || modal.isLoading()) return;
  const [u, v] = screenToNorm(e.clientX, e.clientY);
  if (Math.hypot(u - 0.5, v - 0.5) > 0.5) return;
  const [lon, lat] = proj.normToLonlat(u, v);
  if (siteExistsAt(lat, lon)) return;
  const name = `${Math.abs(lat).toFixed(1)}°S ${Math.round(((lon % 360) + 360) % 360)}°E`;
  addSitio({ name, lat, lon, kind: "pin" });
  selectSite(lat, lon, name, addMarker(lon, lat, name, "pin"));
  setStatus("");
}

// Luna de fondo (hillshade del DEM): rodea el casquete para leerlo como "tapa de una
// esfera". Se centra/escala desde los bounds de ambos rasters (mismo polo, misma
// proyección) para que el terreno del fondo continúe al del casquete. No clickable.
async function placeMoonBg(capMeta) {
  const img = $("map-moon-bg");
  if (!img) return;
  const hs = await getMapMeta("hillshade");
  const capHalf = (capMeta.bounds.right - capMeta.bounds.left) / 2;
  const hsHalf = (hs.bounds.right - hs.bounds.left) / 2;
  const diskHalfFrac = (1000 - 2 * DISK_MARGIN) / 2000;   // 0.36 del stage (inset 14%)
  const frac = diskHalfFrac * (hsHalf / capHalf);
  const off = (0.5 - frac) * 100, size = frac * 2 * 100;
  img.style.left = `${off}%`; img.style.top = `${off}%`;
  img.style.width = `${size}%`; img.style.height = `${size}%`;
  // Cache-buster: /api/map manda Cache-Control de 24 h, y estamos iterando el hillshade.
  // El backend igual cachea el PNG por métrica, así que esto solo refresca el browser.
  img.src = `${mapUrl("hillshade")}&_=${Date.now()}`;
}

// Quita todos los marcadores (semillas y pines) del mapa.
function clearMarkers() {
  layer.replaceChildren();
  markers.clear();
  setActive(null);
}

// Sitio de referencia de las flechas Sol/Tierra cuando no hay un sitio activo.
let refSite = { lat: -89.9, lon: 0 };

// Dibuja las flechas Sol/Tierra de referencia al INICIO del rango vigente.
async function refreshRefArrows() {
  const rs = await getSite(refSite.lat, refSite.lon, { windowDays: 1, date: startDate() });
  const s0 = rs.sun_track[0], e0 = rs.earth_track[0];
  drawDirArrows(s0.az, e0.az, s0.t.slice(0, 16).replace("T", " "),
    localFrame(refSite.lat, refSite.lon));
}

// Selector de fechas: al aplicar un rango nuevo se refresca todo lo que depende de él.
// (El Top 3 lee el rango al abrirse; el detalle y las flechas se recargan acá.)
const dateRange = createDateRange($("date-range"), {
  getRange: () => getState().rangoFechas,
  onApply: async ({ desde, hasta }) => {
    const prev = { ...getState().rangoFechas };
    setRango(desde, hasta);
    dateRange.refresh();
    dateRange.setBusy(true);
    const detailOpen = $("detail-overlay").classList.contains("is-open");
    const cur = getState().sitioActivo;
    try {
      // Con el detalle abierto se recarga (sus flechas siguen al slider; si falla, él mismo
      // muestra su error con "Reintentar"); si no, se redibujan las de referencia.
      if (detailOpen && cur) await modal.show(cur.lat, cur.lon, cur.name);
      else await refreshRefArrows();
      setStatus("");
    } catch (e) {
      // Las flechas no se pudieron actualizar: se vuelve al rango anterior para no dejar el
      // chip (y lo guardado) en desacuerdo con lo que muestra el mapa.
      if (prev.desde && prev.hasta) setRango(prev.desde, prev.hasta);
      dateRange.refresh();
      setStatus(T("dr.statusError", { msg: errorMessage(e) }));
    } finally {
      dateRange.setBusy(false);
    }
  },
});

// ── Carga inicial por pasos ────────────────────────────────────────────────────────────────
// Cada paso se cachea como promesa; si falla se descarta, así un reintento solo repite lo que
// falló. Tres pasos no dependen de las fechas y arrancan al abrir la página (cargan mientras
// el usuario lee el tutorial); "arrows" sí necesita el rango y corre al fijarlo. La bienvenida
// espera a `loadForWelcome` antes de cerrarse: si ya está todo listo, no hay espera.
const BASE_STEPS = ["health", "meta", "image", "sites", "moon"];
const ALL_STEPS = [...BASE_STEPS, "arrows"];
const stepCache = new Map();          // nombre → promesa en curso o resuelta
const stepDone = new Set();
let moonReady = Promise.resolve();    // luna de fondo (hillshade): asigna el src de la imagen
let onLoadProgress = null;

const STEPS_FN = {
  // ¿Tiene el servidor sus datos (DEM, rasters)? Si no, se avisa de entrada en lugar de que
  // falle cada pedido por separado.
  health: async () => {
    const h = await getHealth();
    if (!h.ready) {
      throw new ApiError("data", T("err.dataMissing", { missing: h.missing.join(", ") }));
    }
  },
  meta: async () => {
    const meta = await getMapMeta("illumination");
    proj = createProjection(meta);
    drawChrome();
    moonReady = placeMoonBg(meta).catch(() => {});   // luna de fondo alineada al casquete
  },
  image: async () => {
    const img = $("map-bg");
    img.src = mapUrl("illumination");
    await img.decode();               // rechaza si la imagen no carga
  },
  sites: async () => {
    await runStep("meta");            // los marcadores se ubican con la proyección
    const { sites } = await getSites();
    clearMarkers();                   // un reintento no debe duplicar marcadores
    sites.forEach((s) => addMarker(s.lon, s.lat, s.name, "seed"));
    getState().sitios.forEach((s) => addMarker(s.lon, s.lat, s.name, "pin"));
    refSite = sites[0] || refSite;
  },
  // Luna de fondo (relieve): pesa ~2.7 MB y se baja en cada carga. Se espera completa (y
  // decodificada) para no entrar a un mapa a medias; si falla NO bloquea (es un adorno).
  moon: async () => {
    await runStep("meta");
    await moonReady;                  // placeMoonBg ya asignó el src
    const img = $("map-moon-bg");
    await settled(img);
    try { await img.decode(); } catch { /* sin imagen: se entra igual */ }
  },
  arrows: async () => {
    await runStep("sites");
    await refreshRefArrows();         // depende del rango elegido
  },
};

function runStep(name) {
  if (!stepCache.has(name)) {
    stepCache.set(name, STEPS_FN[name]().then(
      () => { stepDone.add(name); onLoadProgress?.(stepDone.size, ALL_STEPS.length); },
      (e) => { stepCache.delete(name); throw e; }));
  }
  return stepCache.get(name);
}

// Espera a que una imagen termine de cargar o falle; nunca rechaza. La bienvenida no
// pone tope de tiempo: espera con el loader hasta que la imagen cargue.
function settled(img) {
  return new Promise((res) => {
    // complete = ya cargó, ya falló o no tiene src: en esos casos no hay nada que esperar.
    if (img.complete) return res();
    img.addEventListener("load", res, { once: true });
    img.addEventListener("error", res, { once: true });
  });
}

// Lo que la bienvenida espera antes de cerrarse. Rechaza si algún paso falla.
function loadForWelcome(onProgress) {
  onLoadProgress = onProgress;
  onProgress?.(stepDone.size, ALL_STEPS.length);
  return Promise.all(ALL_STEPS.map(runStep));
}

async function init() {
  // Bienvenida frente a la luna: el mapa carga detrás y, al fijar las fechas, se quita.
  const welcome = showWelcome({ ready: loadForWelcome });
  initLayout();                               // alto común mapa/detalle (antes del marco)
  mountMoonFrame($("moon-frame"));            // hardware del borde (no depende del backend)
  // Pasos sin fechas: arrancan ya. Si alguno falla se reintenta al enviar la bienvenida.
  BASE_STEPS.forEach((n) => runStep(n).catch(() => {}));
  await welcome;
  const pw = $("phys-wrap");
  if (pw) pw.style.display = "";          // el botón de física aparece solo tras salir del tuto
  dateRange.refresh();
}

disk.addEventListener("click", onFreeClick);

// Convierte coordenadas de pantalla → normalizadas del disco completo [0,1], corrigiendo
// zoom y pan. `stage` no está transformado, `#map-world` sí → usamos la rect del stage.
function screenToNorm(clientX, clientY) {
  const sr = stage.getBoundingClientRect();
  const k = getScale();                      // la UI está escalada: pantalla → px locales
  const inset = DISK_MARGIN / 1000;          // 0.14
  const relX = ((clientX - sr.left) / k - panX) / zoom;
  const relY = ((clientY - sr.top) / k - panY) / zoom;
  const u = (relX / (sr.width / k) - inset) / (1 - 2 * inset);
  const v = (relY / (sr.height / k) - inset) / (1 - 2 * inset);
  return [u, v];
}

// Lectura lat/lon viva que sigue al cursor. Solo dentro del disco circular.
// Posicionado en coords del stage (no del disco) → no escala con el zoom del mundo.
function onHover(e) {
  const cur = $("map-cursor");
  if (!proj || isDragging) { cur.classList.add("hidden"); return; }
  const [u, v] = screenToNorm(e.clientX, e.clientY);
  if (Math.hypot(u - 0.5, v - 0.5) > 0.5) { cur.classList.add("hidden"); return; }
  const [lon, lat] = proj.normToLonlat(u, v);
  cur.textContent = `${Math.abs(lat).toFixed(1)}°S · ${Math.round(lon) % 360}°E`;
  const sr = stage.getBoundingClientRect();
  cur.style.left = `${((e.clientX - sr.left) / sr.width) * 100}%`;
  cur.style.top = `${((e.clientY - sr.top) / sr.height) * 100}%`;
  cur.classList.remove("hidden");
}
disk.addEventListener("mousemove", onHover);
disk.addEventListener("mouseleave", () => $("map-cursor").classList.add("hidden"));

// Limita el desplazamiento según el zoom para no perder de vista el casquete polar.
function clampPan(px, py, z) {
  if (z <= 1.0) return [0, 0];
  const w = stage.clientWidth || 680;
  const h = stage.clientHeight || 680;
  const centerX = (w / 2) * (1 - z);
  const centerY = (h / 2) * (1 - z);
  const maxSlack = 0.5 * w * (z - 1);
  const cx = Math.max(centerX - maxSlack, Math.min(centerX + maxSlack, px));
  const cy = Math.max(centerY - maxSlack, Math.min(centerY + maxSlack, py));
  return [cx, cy];
}

// will-change dinámico: puesto solo mientras el usuario interactúa (drag/wheel/zoom).
// Al soltar lo quitamos para que el navegador rerasterice la capa a la resolución
// final del zoom (si queda pegado, cachea la textura a 1x y se ve todo borroso).
let interactTimer = null;
function setInteracting(on) {
  if (!world) return;
  if (on) {
    if (interactTimer) { clearTimeout(interactTimer); interactTimer = null; }
    world.style.willChange = "transform";
  } else if (!interactTimer) {
    // Pequeño respiro tras la última transformación antes de soltar la capa.
    interactTimer = setTimeout(() => {
      world.style.willChange = "auto";
      interactTimer = null;
    }, 260);
  }
}

// Aplica el transform CSS al mundo del mapa y sincroniza la UI del zoom.
// smooth=true activa la transición CSS (botones/slider); false la desactiva (drag/wheel RAF).
function applyTransform(smooth = false) {
  if (world) {
    if (smooth) {
      world.classList.remove("no-transition");
    } else {
      world.classList.add("no-transition");
    }
    world.style.transform =
      `translate(${panX.toFixed(2)}px, ${panY.toFixed(2)}px) scale(${zoom})`;
  }
  stage.style.setProperty("--map-zoom", zoom);
  if (zoom > 1.0) {
    stage.classList.add("is-grabbable");
  } else {
    stage.classList.remove("is-grabbable");
  }
  if (zoomSlider) zoomSlider.value = zoom;
  if (zoomLabel) zoomLabel.textContent = `${zoom.toFixed(1)}×`;
  drawScaleBar(zoom);
  updateChromeTextSizes();
  if (lastArrowParams) {
    drawDirArrows(lastArrowParams.sunAz, lastArrowParams.earthAz,
      lastArrowParams.tLabel, lastArrowParams.frame);
  }
}

// Ajusta el zoom pivotando sobre (focalX, focalY) o sobre el centro del stage.
// smooth=true activa la transición CSS (para botones y slider de la barra).
function setZoom(targetZoomVal, focalX, focalY, smooth = true) {
  setInteracting(true);
  setInteracting(false);   // programa la liberación de la capa tras la transición
  const oldZoom = zoom;
  const nextZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoomVal));
  if (focalX === undefined || focalY === undefined) {
    const rect = stage.getBoundingClientRect();
    focalX = rect.width / getScale() / 2;
    focalY = rect.height / getScale() / 2;
  }
  if (nextZoom === MIN_ZOOM) {
    panX = 0;
    panY = 0;
  } else {
    const factor = nextZoom / oldZoom;
    panX = focalX - (focalX - panX) * factor;
    panY = focalY - (focalY - panY) * factor;
    [panX, panY] = clampPan(panX, panY, nextZoom);
  }
  zoom = nextZoom;
  applyTransform(smooth);
}

// Arrastre con clic izquierdo: inicia captura y seguimiento de coordenadas.
function onPointerDown(e) {
  if (e.button !== 0) return;
  if (e.target.closest("#map-zoom-bar")) return;
  isPointerDown = true;
  isDragging = false;
  startX = e.clientX;
  startY = e.clientY;
  origPanX = panX;
  origPanY = panY;
  pointerId = e.pointerId;
  // Captura diferida: capturar acá se traga el `click` de los marcadores hijos
  // (el evento se redirige al stage). Capturamos recién al iniciar el drag real.
}

function onPointerMove(e) {
  if (!isPointerDown) return;
  const dx = (e.clientX - startX) / getScale();   // px locales (la UI está escalada)
  const dy = (e.clientY - startY) / getScale();
  if (!isDragging) {
    if (Math.hypot(dx, dy) > 4 && zoom > 1.0) {
      isDragging = true;
      setInteracting(true);
      stage.classList.add("is-dragging");
      $("map-cursor").classList.add("hidden");
      try { stage.setPointerCapture(pointerId); } catch (_) {}
    }
  }
  if (isDragging) {
    const [nx, ny] = clampPan(origPanX + dx, origPanY + dy, zoom);
    panX = nx;
    panY = ny;
    applyTransform(false);    // sin transición durante drag: sigue al dedo sin lag
  }
}

function onPointerUp(e) {
  if (!isPointerDown) return;
  isPointerDown = false;
  if (isDragging) {
    try { stage.releasePointerCapture(e.pointerId); } catch (_) {}
    isDragging = false;
    setInteracting(false);
    stage.classList.remove("is-dragging");
    justDragged = true;
    setTimeout(() => { justDragged = false; }, 50);
  }
}

// Zoom con ruedita: acumula el delta en targetZoom/targetPan y hace un loop RAF
// que interpola suavemente hacia el target. Sin CSS transition (ningún delay) pero
// con lerp visible para que se vea fluido.
let wheelRafId = null;
let wTargetZoom = zoom;
let wTargetPanX = panX;
let wTargetPanY = panY;
let wFocalX = null;
let wFocalY = null;

function wheelStep() {
  const EPS = 0.0005;
  const LERP = 0.18;    // fracción que avanza por frame (~60 fps → 0.18 ≈ 160 ms efectivo)
  zoom   += (wTargetZoom - zoom)   * LERP;
  panX   += (wTargetPanX - panX)   * LERP;
  panY   += (wTargetPanY - panY)   * LERP;
  applyTransform(false);
  const doneZ = Math.abs(wTargetZoom - zoom)   < EPS;
  const doneP = Math.hypot(wTargetPanX - panX, wTargetPanY - panY) < 0.5;
  if (doneZ && doneP) {
    zoom = wTargetZoom;
    panX = wTargetPanX;
    panY = wTargetPanY;
    applyTransform(false);
    wheelRafId = null;
    setInteracting(false);   // libera la capa ⇒ rerasteriza nítido al nivel final
  } else {
    wheelRafId = requestAnimationFrame(wheelStep);
  }
}

function onWheel(e) {
  e.preventDefault();
  setInteracting(true);
  // Si no hay RAF en curso, el usuario acaba de empezar a hacer zoom (puede venir
  // de un arrastre): sincronizamos los targets con el estado real antes de acumular.
  if (!wheelRafId) {
    wTargetZoom = zoom;
    wTargetPanX = panX;
    wTargetPanY = panY;
  }
  const rect = stage.getBoundingClientRect();
  wFocalX = (e.clientX - rect.left) / getScale();
  wFocalY = (e.clientY - rect.top) / getScale();
  // Acumula el factor sobre el TARGET (no sobre zoom actual) para que scrolls
  // seguidos no "reseteen" la velocidad a cero.
  const factor = Math.exp(-e.deltaY * 0.0022);
  const oldTarget = wTargetZoom;
  wTargetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, oldTarget * factor));
  if (wTargetZoom === MIN_ZOOM) {
    wTargetPanX = 0;
    wTargetPanY = 0;
  } else {
    const f2 = wTargetZoom / oldTarget;
    wTargetPanX = wFocalX - (wFocalX - wTargetPanX) * f2;
    wTargetPanY = wFocalY - (wFocalY - wTargetPanY) * f2;
    [wTargetPanX, wTargetPanY] = clampPan(wTargetPanX, wTargetPanY, wTargetZoom);
  }
  if (!wheelRafId) wheelRafId = requestAnimationFrame(wheelStep);
}

stage.addEventListener("pointerdown", onPointerDown);
stage.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);
stage.addEventListener("wheel", onWheel, { passive: false });
stage.addEventListener("click", (e) => {
  if (justDragged) {
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

// Controles de la barra de zoom: smooth=true activa la transición CSS.
if (zoomInBtn) {
  zoomInBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    // Sincroniza target con estado actual para no pelear con un RAF en curso.
    if (wheelRafId) { cancelAnimationFrame(wheelRafId); wheelRafId = null; }
    wTargetZoom = Math.min(MAX_ZOOM, zoom + 0.5);
    wTargetPanX = panX;
    wTargetPanY = panY;
    setZoom(wTargetZoom, undefined, undefined, true);
  });
}
if (zoomOutBtn) {
  zoomOutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (wheelRafId) { cancelAnimationFrame(wheelRafId); wheelRafId = null; }
    wTargetZoom = Math.max(MIN_ZOOM, zoom - 0.5);
    wTargetPanX = panX;
    wTargetPanY = panY;
    setZoom(wTargetZoom, undefined, undefined, true);
  });
}
if (zoomResetBtn) {
  zoomResetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (wheelRafId) { cancelAnimationFrame(wheelRafId); wheelRafId = null; }
    wTargetZoom = MIN_ZOOM;
    wTargetPanX = 0;
    wTargetPanY = 0;
    setZoom(MIN_ZOOM, undefined, undefined, true);
  });
}
if (zoomSlider) {
  zoomSlider.addEventListener("input", (e) => {
    e.stopPropagation();
    if (wheelRafId) { cancelAnimationFrame(wheelRafId); wheelRafId = null; }
    const v = parseFloat(e.target.value);
    wTargetZoom = v;
    setZoom(v, undefined, undefined, false); // slider ya es continuo, sin transition extra
  });
}
if (zoomOutBtn) {
  zoomOutBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setZoom(zoom - 0.5);
  });
}
if (zoomResetBtn) {
  zoomResetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    setZoom(MIN_ZOOM);
  });
}
if (zoomSlider) {
  zoomSlider.addEventListener("input", (e) => {
    e.stopPropagation();
    setZoom(parseFloat(e.target.value));
  });
}

// Botón Comparar: abre el modal de ranking.
const top3Btn = $("top3-btn");
if (top3Btn) top3Btn.addEventListener("click", (e) => { e.stopPropagation(); top3.open(); });

// Callback de renombre: valida que el nuevo nombre no duplique otra chincheta del usuario.
// Devuelve true si se guardó, false si se rechazó (detailModal.js revierte el nombre en UI).
function makeRenameCallback(lat, lon, m) {
  return (newName) => {
    const dup = getState().sitios.some(
      (s) => s.name === newName &&
             (Math.abs(s.lat - lat) > 1e-6 || Math.abs(s.lon - lon) > 1e-6));
    if (dup) return false;
    renameSitio(lat, lon, newName);
    if (m) m.title = `${newName} · ${lat.toFixed(2)}°, ${lon.toFixed(2)}°E`;
    return true;
  };
}

// Actualiza los valores mostrados junto a los sliders de coordenadas.
function updateCoordsDisplay() {
  const lat = parseFloat($("coords-lat")?.value);
  const lon = parseFloat($("coords-lon")?.value);
  const ld = $("lat-display"), lotd = $("lon-display");
  if (ld && isFinite(lat)) ld.textContent = `${Math.abs(lat).toFixed(1)}°S`;
  if (lotd && isFinite(lon)) lotd.textContent = `${Math.round(lon)}°E`;
}

// Agrega una chincheta desde los sliders de coordenadas.
function addCoordsPin() {
  if (!proj || modal.isLoading()) return;
  const lat = parseFloat($("coords-lat")?.value);
  const lon = parseFloat($("coords-lon")?.value);
  if (!isFinite(lat) || !isFinite(lon)) return;
  const [u, v] = proj.lonlatToNorm(lon, lat);
  if (Math.hypot(u - 0.5, v - 0.5) > 0.5) return;
  if (siteExistsAt(lat, lon)) return;
  const name = `${Math.abs(lat).toFixed(1)}°S ${Math.round(lon)}°E`;
  addSitio({ name, lat, lon, kind: "pin" });
  selectSite(lat, lon, name, addMarker(lon, lat, name, "pin"));
  setStatus("");
}

const coordsAdd = $("coords-add");
if (coordsAdd) coordsAdd.addEventListener("click", (e) => { e.stopPropagation(); addCoordsPin(); });
["coords-lat", "coords-lon"].forEach((id) => {
  const inp = $(id);
  if (!inp) return;
  ["click", "pointerdown", "pointermove", "pointerup"].forEach(ev =>
    inp.addEventListener(ev, (e) => e.stopPropagation()));
  inp.addEventListener("input", (e) => { e.stopPropagation(); updateCoordsDisplay(); });
});
updateCoordsDisplay();   // muestra los valores iniciales

// Al cambiar de idioma: el texto estático lo re-aplica i18n.apply; acá regeneramos
// lo que dibuja el SVG por JS (etiqueta "polo S", flechas Sol/Tierra).
document.addEventListener("i18n:change", () => {
  if (!proj) return;
  drawChrome();
  if (lastArrowParams) {
    drawDirArrows(lastArrowParams.sunAz, lastArrowParams.earthAz,
      lastArrowParams.tLabel, lastArrowParams.frame);
  }
});

// Card de fundamento físico: toggle bottom-left
const physBtn = $("phys-btn");
const physCard = $("phys-card");
const physClose = $("phys-close");
if (physBtn && physCard) {
  physBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    physCard.classList.toggle("phys-open");
  });
  if (physClose) {
    physClose.addEventListener("click", (e) => {
      e.stopPropagation();
      physCard.classList.remove("phys-open");
    });
  }
  document.addEventListener("click", () => physCard.classList.remove("phys-open"));
  physCard.addEventListener("click", (e) => e.stopPropagation());
}

init();
