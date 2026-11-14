// Hub del mapa polar (H3). Fondo = raster de luz promedio; ⭐ sitios semilla y
// 📍 chinchetas del usuario ubicados por proyección; click → detalle (modal H2) o
// botón flotante para agregar/ver un sitio libre. El estado global es de H4; acá
// mantenemos solo las chinchetas locales.

import { getSites, getSite, mapUrl, getMapMeta } from "./api.js";
import { createProjection } from "./proj.js";
import { createDetailModal } from "./detailModal.js";
import { windowDays, startDate, addSitio, setSitioActivo, getState } from "./state.js";

const $ = (id) => document.getElementById(id);
const stage = $("map-stage");
const layer = $("map-markers");
const modal = createDetailModal({ windowDays: windowDays(), date: startDate() });
let proj = null;
let pending = null;            // {lat, lon} del último click en zona libre

function setStatus(msg) { $("map-status").textContent = msg || ""; }

const SVGNS = "http://www.w3.org/2000/svg";
function svg(tag, attrs) {
  const el = document.createElementNS(SVGNS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

// Orientación: anillos de latitud + polo + barra de escala (SVG en unidades 0..1000,
// que mapean al lienzo cuadrado por preserveAspectRatio="none"). El polo queda al
// centro; el norte apunta radialmente hacia afuera (azimut 0=N, invariante).
function drawChrome() {
  const g = $("map-chrome");
  g.innerHTML = "";
  const C = 500;                          // centro (polo sur) en unidades SVG
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
  drawGlobeInset();
  // Polo sur (90°S): cruz + etiqueta.
  g.appendChild(svg("path", { d: `M${C - 9} ${C}H${C + 9}M${C} ${C - 9}V${C + 9}`,
    stroke: "white", "stroke-opacity": 0.7, "stroke-width": 2 }));
  const pt = svg("text", { x: C + 12, y: C + 6, fill: "white", "fill-opacity": 0.75,
    "font-size": 18, "font-family": "JetBrains Mono" });
  pt.textContent = "polo S";
  g.appendChild(pt);
  // Barra de escala: 100 km = 0.33 del ancho (escala ~fiel cerca del polo).
  const len = (100000 / 303480) * 1000, x0 = 1000 - len - 40, y = 955;
  g.appendChild(svg("path", {
    d: `M${x0} ${y}h${len}M${x0} ${y - 7}v14M${x0 + len} ${y - 7}v14`,
    stroke: "white", "stroke-opacity": 0.85, "stroke-width": 2.5 }));
  const st = svg("text", { x: x0 + len / 2, y: y - 12, fill: "white", "fill-opacity": 0.9,
    "font-size": 18, "text-anchor": "middle", "font-family": "JetBrains Mono" });
  st.textContent = "100 km";
  g.appendChild(st);
}

// Inset de globo (arriba-izq): esquema de la Luna con el casquete sur resaltado,
// para que se lea "vista cenital del polo sur". Decorativo, no a escala.
function drawGlobeInset() {
  const g = $("map-chrome"), cx = 78, cy = 78, r = 52;
  g.appendChild(svg("circle", { cx, cy, r, fill: "rgba(255,255,255,.07)",
    stroke: "white", "stroke-opacity": 0.55, "stroke-width": 2 }));
  // Casquete resaltado (~tercio inferior): arco del borde + cuerda.
  const cut = cy + r * 0.45, hw = Math.sqrt(r * r - (cut - cy) ** 2);
  g.appendChild(svg("path", { fill: "rgba(96,165,250,.35)", stroke: "#60a5fa",
    "stroke-opacity": 0.8, "stroke-width": 1.5,
    d: `M${cx - hw} ${cut}A${r} ${r} 0 0 0 ${cx + hw} ${cut}Z` }));
  g.appendChild(svg("circle", { cx, cy: cy + r, r: 3, fill: "white" }));
  const t = svg("text", { x: cx, y: cy + r + 18, fill: "white", "fill-opacity": 0.8,
    "font-size": 15, "text-anchor": "middle", "font-family": "JetBrains Mono" });
  t.textContent = "vista polo S";
  g.appendChild(t);
}

// Flechas de DIRECCIÓN (no visibilidad) de Sol y Tierra en el margen. Una bearing A
// (azimut 0=N horario) mapea a dirección de pantalla (sinA, -cosA) desde el polo.
// Son la dirección en UN instante (inicio de ventana), rotulado para honestidad.
function drawDirArrows(sunAz, earthAz, tLabel) {
  const g = $("map-chrome"), C = 500, rIn = 430, rOut = 478;
  const arrow = (azDeg, color, emoji) => {
    const a = azDeg * Math.PI / 180, dx = Math.sin(a), dy = -Math.cos(a);
    const x1 = C + dx * rIn, y1 = C + dy * rIn;
    const x2 = C + dx * rOut, y2 = C + dy * rOut;
    g.appendChild(svg("line", { x1, y1, x2, y2, stroke: color,
      "stroke-width": 7, "stroke-linecap": "round" }));
    // Punta: dos trazos hacia atrás.
    const px = -dx, py = -dy, qx = -dy, qy = dx, s = 16;
    g.appendChild(svg("path", { stroke: color, "stroke-width": 7, fill: "none",
      "stroke-linecap": "round",
      d: `M${x2 + (px + qx) * s} ${y2 + (py + qy) * s}L${x2} ${y2}` +
         `L${x2 + (px - qx) * s} ${y2 + (py - qy) * s}` }));
    const t = svg("text", { x: C + dx * (rIn - 24), y: C + dy * (rIn - 24) + 7,
      "font-size": 30, "text-anchor": "middle" });
    t.textContent = emoji;
    g.appendChild(t);
  };
  arrow(sunAz, "#f59e0b", "☀️");
  arrow(earthAz, "#2563eb", "🌍");
  const t = svg("text", { x: 40, y: 955, fill: "white", "fill-opacity": 0.7,
    "font-size": 17, "font-family": "JetBrains Mono" });
  t.textContent = `dirección al ${tLabel} UTC`;
  g.appendChild(t);
}

// Crea un marcador absoluto en (lon,lat). `kind`: "seed" (⭐) o "pin" (📍).
function addMarker(lon, lat, name, kind) {
  const [u, v] = proj.lonlatToNorm(lon, lat);
  const m = document.createElement("button");
  m.className =
    "absolute -translate-x-1/2 -translate-y-1/2 text-lg leading-none drop-shadow " +
    "hover:scale-125 transition-transform focus:outline-none";
  m.style.left = `${u * 100}%`;
  m.style.top = `${v * 100}%`;
  m.textContent = kind === "pin" ? "📍" : "⭐";
  m.title = `${name} · ${lat.toFixed(2)}°, ${lon.toFixed(2)}°E`;
  m.addEventListener("click", (e) => {
    e.stopPropagation();
    setSitioActivo({ lat, lon, name });
    modal.open(lat, lon, name);
  });
  layer.appendChild(m);
  return m;
}

// Click en zona libre: ubicar el popup flotante y recordar las coords.
function onFreeClick(e) {
  const r = stage.getBoundingClientRect();
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

stage.addEventListener("click", (e) => {
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

$("free-detail").addEventListener("click", () => {
  if (!pending) return;
  setSitioActivo({ lat: pending.lat, lon: pending.lon, name: freeName(pending) });
  modal.open(pending.lat, pending.lon, freeName(pending));
  hidePopup();
});

init();
