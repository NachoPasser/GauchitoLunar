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
let proj = null;
let pending = null;            // {lat, lon} del último click en zona libre
let activeSite = null;         // {lat, lon} del sitio activo (apoyo de la cuña, §2.3)
const modal = createDetailModal({
  windowDays: windowDays(), date: startDate(),
  // Sincronización por azimut: la ventana del skyline mueve la cuña del mapa en vivo.
  onAzimuthWindow: (win) => { if (activeSite) drawCone(activeSite.lat, activeSite.lon, win); },
  // El slider mueve las flechas Sol/Tierra al azimut del instante (mismo marco local).
  onInstant: (sunAz, earthAz, tLabel) => {
    if (activeSite) {
      drawDirArrows(sunAz, earthAz, tLabel, localFrame(activeSite.lat, activeSite.lon));
    }
  },
});
const top3 = createTop3({ onDetail: (lat, lon, name) => modal.open(lat, lon, name) });

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
  drawGlobe();
  drawScaleBar();
}

// Globo-localizador (abajo-derecha): esfera ortográfica SVG "esqueleto/transparente"
// con el casquete sur coloreado arriba, inclinada hacia el observador. Comunica que el
// disco grande es la MISMA tapa vista a pico (no todo el hemisferio). Sin 3D real:
// proyectamos puntos de la esfera a mano. La sincronía hover↔mapa es una fase posterior.
const GLOBE = { cx: 894, cy: 882, r: 84, tilt: 28, cap: 18 };

// Proyección ortográfica de (lat,lon) con el eje polar inclinado para que el polo SUR
// quede arriba y de cara al observador. Devuelve coords en la unidad-esfera (x der, y
// abajo como SVG) y profundidad (depth>0 = cara frontal).
function globePt(latDeg, lonDeg) {
  const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
  const t = ((90 + GLOBE.tilt) * Math.PI) / 180;    // >90° ⇒ polo sur arriba y frontal
  const x = Math.cos(la) * Math.sin(lo);
  const y = Math.cos(la) * Math.cos(lo);
  const z = Math.sin(la);
  const y2 = y * Math.cos(t) - z * Math.sin(t);
  const z2 = y * Math.sin(t) + z * Math.cos(t);
  return { x, y: -y2, depth: z2 };
}

function drawGlobe() {
  const g = $("map-chrome-outer"), { cx, cy, r } = GLOBE;
  const sx = (p) => cx + r * p.x, sy = (p) => cy + r * p.y;
  const poly = (pts) =>
    pts.map((p, i) => `${i ? "L" : "M"}${sx(p).toFixed(1)} ${sy(p).toFixed(1)}`).join("");
  // Limbo de la esfera (vidrio): relleno casi nulo + borde tenue ⇒ look esquelético.
  g.appendChild(svg("circle", { cx, cy, r, fill: "rgba(255,255,255,.05)",
    stroke: "rgba(255,255,255,.5)", "stroke-width": 1.5 }));
  // Una curva se parte en tramos frontales (nítidos) y traseros (tenues): transparencia.
  const curve = (pts) => {
    let run = [], front = pts[0].depth > 0;
    const flush = () => { if (run.length > 1) g.appendChild(svg("path", { d: poly(run),
      fill: "none", stroke: "#cfe0ff", "stroke-width": 1,
      "stroke-opacity": front ? 0.38 : 0.12 })); };
    for (const p of pts) {
      const f = p.depth > 0;
      if (f !== front) { flush(); run = run.length ? [run[run.length - 1]] : []; front = f; }
      run.push(p);
    }
    flush();
  };
  const sample = (fn) => { const a = []; for (let k = 0; k <= 36; k++) a.push(fn(k)); return a; };
  for (let lon = 0; lon < 360; lon += 45)                       // meridianos
    curve(sample((k) => globePt(-90 + (k * 180) / 36, lon)));
  for (let lat = -60; lat <= 60; lat += 30)                     // paralelos
    curve(sample((k) => globePt(lat, (k * 360) / 36)));
  // Casquete sur: borde del paralelo a `cap`° del polo, cerrado y relleno (la tapa).
  const capPts = sample((k) => globePt(-(90 - GLOBE.cap), (k * 360) / 36));
  g.appendChild(svg("path", { d: `${poly(capPts)}Z`, fill: "rgba(96,165,250,.4)",
    stroke: "#60a5fa", "stroke-opacity": 0.95, "stroke-width": 1.5 }));
  const pole = globePt(-90, 0);
  g.appendChild(svg("circle", { cx: sx(pole), cy: sy(pole), r: 2.5, fill: "#fff" }));
  // Polos rotulados: S arriba (de cara, casquete) y N abajo (oculto, tenue). Deja claro
  // que la vista está "dada vuelta" respecto de la convención humana (N arriba).
  const lbl = (txt, y, op) => {
    const e = svg("text", { x: cx, y, fill: "#cbd5e1", "fill-opacity": op,
      "font-size": 18, "font-weight": 700, "text-anchor": "middle",
      "font-family": "JetBrains Mono" });
    e.textContent = txt;
    g.appendChild(e);
  };
  lbl("S", cy - r - 9, 0.95);
  lbl("N", cy + r + 22, 0.5);
}

// Barra de escala en el margen inferior. 100 km = (100/303.48) del ancho del DISCO,
// que mide DISK_SPAN unidades de stage. Colores claros: va sobre oscuro.
function drawScaleBar() {
  const go = $("map-chrome-outer");
  const len = (100000 / 303480) * DISK_SPAN, x0 = 500 - len / 2, y = 960;
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
function drawDirArrows(sunAz, earthAz, tLabel, frame) {
  const g = $("map-chrome-outer"), C = 500, R = DISK_R + 50;  // órbita fija en el polo
  const old = $("map-arrows");
  if (old) old.remove();                     // redibujo por tick: reemplaza el grupo
  const grp = svg("g", { id: "map-arrows" });
  const { nx, ny, ex, ey } = frame;
  // Sitio activo en coordenadas de stage (el disco ocupa el centro, ver DISK_*).
  const ox = DISK_MARGIN + frame.P[0] * DISK_SPAN, oy = DISK_MARGIN + frame.P[1] * DISK_SPAN;
  const fx = ox - C, fy = oy - C;            // sitio relativo al polo
  const START = 26;
  const arrow = (azDeg, color, label) => {
    const a = (azDeg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
    const dx = c * nx + s * ex, dy = c * ny + s * ey;   // azimut DESDE EL SITIO → dir unitaria
    // Astro = donde el rayo desde el sitio cruza el anillo fijo (raíz hacia adelante).
    const fd = fx * dx + fy * dy, disc = fd * fd - (fx * fx + fy * fy - R * R);
    const t = disc >= 0 ? -fd + Math.sqrt(disc) : R;
    const bx = ox + dx * START, by = oy + dy * START;   // arranca despegado del marcador
    const tx = ox + dx * t, ty = oy + dy * t;           // punta = astro sobre la órbita
    const line = (w, col, op) => svg("line", { x1: bx, y1: by, x2: tx, y2: ty,
      stroke: col, "stroke-width": w, "stroke-linecap": "round", "stroke-opacity": op });
    grp.appendChild(line(9, "#0b1124", 0.5));           // halo oscuro (legible sobre terreno)
    grp.appendChild(line(6, color, 1));
    // Punta: dos trazos hacia atrás.
    const px = -dx, py = -dy, qx = -dy, qy = dx, sz = 12;
    grp.appendChild(svg("path", { stroke: color, "stroke-width": 6, fill: "none",
      "stroke-linecap": "round", "stroke-linejoin": "round",
      d: `M${tx + (px + qx) * sz} ${ty + (py + qy) * sz}L${tx} ${ty}` +
         `L${tx + (px - qx) * sz} ${ty + (py - qy) * sz}` }));
    // Astro: disco de color + rótulo con halo (se lee sobre margen o terreno).
    grp.appendChild(svg("circle", { cx: tx, cy: ty, r: 7, fill: color,
      stroke: "#0b1124", "stroke-width": 2 }));
    const lbl = svg("text", { x: tx, y: ty - 13, fill: "#f3f6fb", "text-anchor": "middle",
      "font-size": 18, "font-family": "Inter", "font-weight": 600,
      stroke: "#0b1124", "stroke-width": 3, "paint-order": "stroke" });
    lbl.textContent = label;
    grp.appendChild(lbl);
  };
  arrow(sunAz, "#f59e0b", "Sol");
  arrow(earthAz, "#60a5fa", "Tierra");
  const cap = svg("text", { x: 20, y: 986, fill: "#8a97b2", "fill-opacity": 0.95,
    "font-size": 16, "font-family": "JetBrains Mono" });
  cap.textContent = `dirección al ${tLabel} UTC`;
  grp.appendChild(cap);
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
    stroke: "url(#cone-edge-a)", "stroke-width": 2.5, "stroke-linecap": "round" }));
  g.appendChild(svg("line", { x1: cx, y1: cy, x2: eB[0], y2: eB[1],
    stroke: "url(#cone-edge-b)", "stroke-width": 2.5, "stroke-linecap": "round" }));
  g.appendChild(svg("circle", { cx, cy, r: 4, fill: CONE_EDGE,
    stroke: "#0b1124", "stroke-width": 1.5 }));
  $("map-chrome").appendChild(g);
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
    // Toggle: click en el sitio ya seleccionado (con el detalle abierto) lo cierra.
    const open = $("detail-overlay").classList.contains("is-open");
    if (activeEl === m && open) {
      modal.close();
      setActive(null);
      return;
    }
    setActive(m);
    activeSite = { lat, lon };
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
    drawDirArrows(s0.az, e0.az, s0.t.slice(0, 16).replace("T", " "),
      localFrame(ref.lat, ref.lon));
  } catch (e) {
    setStatus(`No se pudo cargar el mapa (¿backend activo?): ${e.message}`);
  }
}

disk.addEventListener("click", (e) => {
  if (e.target.closest("#free-popup")) return;      // clicks del popup se manejan aparte
  onFreeClick(e);
});

// Lectura lat/lon viva que sigue al cursor (Opción A). Solo dentro del disco circular:
// afuera la proyección no mapea terreno real. Latitud siempre sur (Math.abs + "°S").
function onHover(e) {
  const cur = $("map-cursor");
  if (!proj) return;
  const r = disk.getBoundingClientRect();
  const u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
  if (Math.hypot(u - 0.5, v - 0.5) > 0.5) { cur.classList.add("hidden"); return; }
  const [lon, lat] = proj.normToLonlat(u, v);
  cur.textContent = `${Math.abs(lat).toFixed(1)}°S · ${Math.round(lon) % 360}°E`;
  cur.style.left = `${u * 100}%`;
  cur.style.top = `${v * 100}%`;
  cur.classList.remove("hidden");
}
disk.addEventListener("mousemove", onHover);
disk.addEventListener("mouseleave", () => $("map-cursor").classList.add("hidden"));

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
  activeSite = { lat: pending.lat, lon: pending.lon };
  setSitioActivo({ lat: pending.lat, lon: pending.lon, name });
  modal.open(pending.lat, pending.lon, name);
  hidePopup();
});

init();
