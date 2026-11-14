// Hub del mapa polar (H3). Fondo = raster de luz promedio; ⭐ sitios semilla y
// 📍 chinchetas del usuario ubicados por proyección; click → detalle (modal H2) o
// botón flotante para agregar/ver un sitio libre. El estado global es de H4; acá
// mantenemos solo las chinchetas locales.

import { getSites, mapUrl, getMapMeta } from "./api.js";
import { createProjection } from "./proj.js";
import { createDetailModal } from "./detailModal.js";

const $ = (id) => document.getElementById(id);
const stage = $("map-stage");
const layer = $("map-markers");
const modal = createDetailModal();
let proj = null;
let pending = null;            // {lat, lon} del último click en zona libre

function setStatus(msg) { $("map-status").textContent = msg || ""; }

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
    const { sites } = await getSites();
    sites.forEach((s) => addMarker(s.lon, s.lat, s.name, "seed"));
    setStatus(`${sites.length} sitios`);
  } catch (e) {
    setStatus(`No se pudo cargar el mapa (¿backend activo?): ${e.message}`);
  }
}

stage.addEventListener("click", (e) => {
  if (e.target.closest("#free-popup")) return;      // clicks del popup se manejan aparte
  onFreeClick(e);
});

$("free-add").addEventListener("click", () => {
  if (!pending) return;
  const name = `Sitio ${pending.lat.toFixed(1)}°, ${pending.lon.toFixed(1)}°E`;
  addMarker(pending.lon, pending.lat, name, "pin");
  hidePopup();
});

$("free-detail").addEventListener("click", () => {
  if (!pending) return;
  modal.open(pending.lat, pending.lon,
    `Sitio ${pending.lat.toFixed(1)}°, ${pending.lon.toFixed(1)}°E`);
  hidePopup();
});

init();
