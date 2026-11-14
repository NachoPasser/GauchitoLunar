// Hub del mapa polar (H3). Fondo = raster de luz promedio; ⭐ sitios semilla y
// 📍 chinchetas del usuario ubicados por proyección; click → detalle (modal H2) o
// botón flotante para agregar/ver un sitio libre. El estado global es de H4; acá
// mantenemos solo las chinchetas locales.

import { getSites, getSite, mapUrl, getMapMeta } from "./api.js";
import { createProjection } from "./proj.js";
import { createDetailModal } from "./detailModal.js";
import { createTop3 } from "./top3.js";
import { windowDays, startDate, addSitio, setSitioActivo, getState } from "./state.js";

const $ = (id) => document.getElementById(id);
const stage = $("map-stage");
const disk = $("map-disk");
const layer = $("map-markers");
const modal = createDetailModal({ windowDays: windowDays(), date: startDate() });
const top3 = createTop3({ onDetail: (lat, lon, name) => modal.open(lat, lon, name) });
let proj = null;
let pending = null;            // {lat, lon} del último click en zona libre

function setStatus(msg) { $("map-status").textContent = msg || ""; }

const SVGNS = "http://www.w3.org/2000/svg";
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
    // Saltamos las que caen dentro del disco (radio 400): el disco las taparía igual.
    if ((st.x - 500) ** 2 + (st.y - 500) ** 2 < 405 ** 2) continue;
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
  drawStars(go);                           // estrellas detrás de todo el margen
  const C = 500;                           // centro (polo sur) en unidades SVG
  const ring = (lat) => {
    const r = proj.latRingRadius(lat) * 1000;
    g.appendChild(svg("circle", { cx: C, cy: C, r, fill: "none",
      stroke: "white", "stroke-opacity": 0.5, "stroke-dasharray": "5 7" }));
    const t = svg("text", { x: C, y: C - r + 14, fill: "white", "fill-opacity": 0.85,
      "font-size": 20, "text-anchor": "middle", "font-family": "JetBrains Mono" });
    t.textContent = `${Math.abs(lat)}°S`;
    g.appendChild(t);
  };
  ring(-85);
  ring(-88);
  // Polo sur (90°S): cruz + etiqueta (interior).
  g.appendChild(svg("path", { d: `M${C - 9} ${C}H${C + 9}M${C} ${C - 9}V${C + 9}`,
    stroke: "white", "stroke-opacity": 0.7, "stroke-width": 2 }));
  const pt = svg("text", { x: C + 12, y: C + 6, fill: "white", "fill-opacity": 0.75,
    "font-size": 18, "font-family": "JetBrains Mono" });
  pt.textContent = "polo S";
  g.appendChild(pt);
  // Chrome del margen (sobre el lienzo claro): globo + barra de escala.
  drawGlobeInset();
  drawScaleBar();
}

// Inset de globo (arriba-izq, sobre el margen oscuro): esquema de la Luna con el
// casquete sur resaltado, para que se lea "vista cenital del polo sur". Decorativo.
function drawGlobeInset() {
  const g = $("map-chrome-outer"), cx = 72, cy = 72, r = 50;
  g.appendChild(svg("circle", { cx, cy, r, fill: "rgba(255,255,255,.06)",
    stroke: "rgba(255,255,255,.5)", "stroke-width": 2 }));
  // Casquete resaltado (~tercio inferior): arco del borde + cuerda.
  const cut = cy + r * 0.45, hw = Math.sqrt(r * r - (cut - cy) ** 2);
  g.appendChild(svg("path", { fill: "rgba(96,165,250,.3)", stroke: "#60a5fa",
    "stroke-opacity": 0.9, "stroke-width": 1.5,
    d: `M${cx - hw} ${cut}A${r} ${r} 0 0 0 ${cx + hw} ${cut}Z` }));
  g.appendChild(svg("circle", { cx, cy: cy + r, r: 3, fill: "#fff" }));
  const t = svg("text", { x: cx, y: cy + r + 18, fill: "#cbd5e1",
    "font-size": 15, "text-anchor": "middle", "font-family": "JetBrains Mono" });
  t.textContent = "vista polo S";
  g.appendChild(t);
}

// Barra de escala en el margen inferior. 100 km = (100/303.48) del ancho del DISCO,
// y el disco mide 800 unidades de stage (80% del lado). Colores claros: va sobre oscuro.
function drawScaleBar() {
  const go = $("map-chrome-outer");
  const len = (100000 / 303480) * 800, x0 = 500 - len / 2, y = 960;
  go.appendChild(svg("path", {
    d: `M${x0} ${y}h${len}M${x0} ${y - 7}v14M${x0 + len} ${y - 7}v14`,
    stroke: "#cbd5e1", "stroke-opacity": 0.95, "stroke-width": 2.5 }));
  const st = svg("text", { x: 500, y: y - 12, fill: "#cbd5e1",
    "font-size": 18, "text-anchor": "middle", "font-family": "JetBrains Mono" });
  st.textContent = "100 km";
  go.appendChild(st);
}

// Flechas de DIRECCIÓN (no visibilidad) de Sol y Tierra, EN EL MARGEN claro, fuera
// del disco de luna (radio 400). Una bearing A (azimut 0=N horario) mapea a dirección
// de pantalla (sinA, -cosA) desde el polo. Son la dirección en UN instante (inicio de
// ventana), rotulado para honestidad. Dibuja en la capa exterior (sobre fondo claro).
function drawDirArrows(sunAz, earthAz, tLabel) {
  const g = $("map-chrome-outer"), C = 500, rIn = 414, rOut = 464;
  const arrow = (azDeg, color, label) => {
    const a = azDeg * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
    const x1 = C + dx * rIn, y1 = C + dy * rIn;
    const x2 = C + dx * rOut, y2 = C + dy * rOut;
    g.appendChild(svg("line", { x1, y1, x2, y2, stroke: color,
      "stroke-width": 7, "stroke-linecap": "round" }));
    // Punta: dos trazos hacia atrás.
    const px = -dx, py = -dy, qx = -dy, qy = dx, s = 13;
    g.appendChild(svg("path", { stroke: color, "stroke-width": 7, fill: "none",
      "stroke-linecap": "round",
      d: `M${x2 + (px + qx) * s} ${y2 + (py + qy) * s}L${x2} ${y2}` +
         `L${x2 + (px - qx) * s} ${y2 + (py - qy) * s}` }));
    // Etiqueta: disco de color (borde blanco) en la base + texto en tinta oscura.
    const lx = C + dx * (rIn + 10), ly = C + dy * (rIn + 10);
    g.appendChild(svg("circle", { cx: lx, cy: ly, r: 8, fill: color,
      stroke: "#0d1426", "stroke-width": 2 }));
    const t = svg("text", { x: lx, y: ly - 14, fill: "#f3f6fb", "fill-opacity": 0.96,
      "font-size": 19, "text-anchor": "middle", "font-family": "Inter", "font-weight": 600 });
    t.textContent = label;
    g.appendChild(t);
  };
  arrow(sunAz, "#f59e0b", "Sol");
  arrow(earthAz, "#60a5fa", "Tierra");
  const t = svg("text", { x: 20, y: 986, fill: "#8a97b2", "fill-opacity": 0.95,
    "font-size": 16, "font-family": "JetBrains Mono" });
  t.textContent = `dirección al ${tLabel} UTC`;
  g.appendChild(t);
}

// Marcadores SVG (no emoji): estrella = predefinido, chincheta = del usuario.
function markerSVG(kind) {
  if (kind === "pin") {
    return `<svg width="22" height="28" viewBox="0 0 22 28">` +
      `<path d="M11 27C11 27 20 16 20 10a9 9 0 10-18 0c0 6 9 17 9 17z" ` +
      `fill="#fc3d21" stroke="#fff" stroke-width="2"/>` +
      `<circle cx="11" cy="10" r="3.2" fill="#fff"/></svg>`;
  }
  return `<svg width="24" height="24" viewBox="0 0 24 24">` +
    `<path d="M12 2l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 16.9 6.1 20.3l1.7-6.6L2.6 9.3l6.8-.5z" ` +
    `fill="#0032a0" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}

let activeEl = null;

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
  m.innerHTML = `<span class="marker__ring"></span>${markerSVG(kind)}`;
  m.title = `${name} · ${lat.toFixed(2)}°, ${lon.toFixed(2)}°E`;
  m.addEventListener("click", (e) => {
    e.stopPropagation();
    setActive(m);
    setSitioActivo({ lat, lon, name });
    modal.open(lat, lon, name);
  });
  layer.appendChild(m);
  return m;
}

// Click en zona libre: ubicar el popup flotante y recordar las coords.
function onFreeClick(e) {
  const r = disk.getBoundingClientRect();
  const u = (e.clientX - r.left) / r.width;
  const v = (e.clientY - r.top) / r.height;
  if (u < 0 || u > 1 || v < 0 || v > 1) return;
  const [lon, lat] = proj.normToLonlat(u, v);
  pending = { lat, lon };
  const pop = $("free-popup");
  pop.style.left = `${u * 100}%`;
  pop.style.top = `${v * 100}%`;
  pop.classList.remove("hidden");
  setStatus(`Sitio libre: ${lat.toFixed(2)}°, ${lon.toFixed(2)}°E`);
}

function hidePopup() { $("free-popup").classList.add("hidden"); }

async function init() {
  try {
    const meta = await getMapMeta("illumination");
    proj = createProjection(meta);
    $("map-bg").src = mapUrl("illumination");
    drawChrome();
    const { sites } = await getSites();
    sites.forEach((s) => addMarker(s.lon, s.lat, s.name, "seed"));
    // Chinchetas 📍 del usuario persistidas en el estado compartido.
    const pins = getState().sitios;
    pins.forEach((s) => addMarker(s.lon, s.lat, s.name, "pin"));
    setStatus(`${sites.length} sitios · ${pins.length} propios`);
    // Flechas de dirección: sitio de referencia cerca del polo, al inicio del rango.
    const ref = sites[0] || { lat: -89.9, lon: 0 };
    const rs = await getSite(ref.lat, ref.lon, { windowDays: 1, date: startDate() });
    const s0 = rs.sun_track[0], e0 = rs.earth_track[0];
    drawDirArrows(s0.az, e0.az, s0.t.slice(0, 16).replace("T", " "));
  } catch (e) {
    setStatus(`No se pudo cargar el mapa (¿backend activo?): ${e.message}`);
  }
}

disk.addEventListener("click", (e) => {
  if (e.target.closest("#free-popup")) return;      // clicks del popup se manejan aparte
  onFreeClick(e);
});

function freeName(p) {
  return `Sitio ${p.lat.toFixed(1)}°, ${p.lon.toFixed(1)}°E`;
}

$("free-add").addEventListener("click", () => {
  if (!pending) return;
  const name = freeName(pending);
  addSitio({ name, lat: pending.lat, lon: pending.lon, kind: "pin" });
  addMarker(pending.lon, pending.lat, name, "pin");
  hidePopup();
});

$("top3-btn").addEventListener("click", top3.open);

$("free-detail").addEventListener("click", () => {
  if (!pending) return;
  const name = freeName(pending);
  setActive(null);
  setSitioActivo({ lat: pending.lat, lon: pending.lon, name });
  modal.open(pending.lat, pending.lon, name);
  hidePopup();
});

init();
