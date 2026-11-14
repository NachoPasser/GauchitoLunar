// Harness de H2: cablea el modal de detalle con el backend y el skyline.
// H3 reutilizará createSkyline + showSite montándolos sobre el mapa.

import { getSites, getMask, getSite } from "./api.js";
import { createSkyline } from "./skyline.js";
import { renderMetrics, renderCartuchos } from "./panel.js";

const $ = (id) => document.getElementById(id);
const sky = createSkyline($("skyline"));
let fullSky = false;
let data = null;   // respuesta /api/site del sitio activo (para el slider)

function setStatus(msg, isError = false) {
  const s = $("status");
  s.textContent = msg;
  s.className = `text-xs ${isError ? "text-red-500" : "text-slate-400"}`;
}

// Mueve el instante actual sobre el skyline y actualiza la etiqueta.
function updateCursor(i) {
  if (!data) return;
  sky.setCursor(i);
  sky.draw();
  const s = data.sun_track[i], e = data.earth_track[i];
  const t = s.t.slice(0, 16).replace("T", " ");
  const tag = (p) => (p.visible ? "visible" : "tapado");
  $("time-label").textContent =
    `${t} UTC  ·  Sol ${s.el.toFixed(1)}° ${tag(s)}  ·  ` +
    `Tierra ${e.el.toFixed(1)}° ${tag(e)}`;
}

// Carga máscara + tracks de un sitio y redibuja el skyline.
async function showSite(lat, lon) {
  setStatus("Cargando…");
  try {
    const [mask, site] = await Promise.all([
      getMask(lat, lon),
      getSite(lat, lon, { windowDays: 30 }),
    ]);
    $("site-name").textContent = site.site.name;
    $("site-coords").textContent = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°E`;
    data = site;
    sky.setMask(mask.horizon_mask);
    sky.setTracks(site.sun_track, site.earth_track);
    sky.setParams({ commsMargin: site.params.comms_margin_deg });
    const slider = $("time-slider");
    slider.max = site.sun_track.length - 1;
    slider.value = 0;
    updateCursor(0);
    renderMetrics($("metrics"), site);
    renderCartuchos($("cartuchos"), site);
    setStatus("");
  } catch (e) {
    setStatus(`No se pudo cargar (¿backend activo?): ${e.message}`, true);
  }
}

// Pobla el selector con los sitios semilla.
async function loadSites() {
  try {
    const { sites } = await getSites();
    const sel = $("site-select");
    sel.innerHTML = "";
    sites.forEach((s, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = s.name;
      o.dataset.lat = s.lat;
      o.dataset.lon = s.lon;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => {
      const o = sel.selectedOptions[0];
      showSite(Number(o.dataset.lat), Number(o.dataset.lon));
    });
    if (sites.length) showSite(sites[0].lat, sites[0].lon);
  } catch (e) {
    setStatus(`No se pudieron listar los sitios: ${e.message}`, true);
  }
}

// --- Modal abrir/cerrar (estructura que hereda H3) ---
function openModal() { $("detail-overlay").classList.remove("hidden"); }
function closeModal() { $("detail-overlay").classList.add("hidden"); }

$("open-btn").addEventListener("click", openModal);
$("close-btn").addEventListener("click", closeModal);
$("detail-overlay").addEventListener("click", (e) => {
  if (e.target === $("detail-overlay")) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

$("fullsky-btn").addEventListener("click", () => {
  fullSky = !fullSky;
  sky.setFullSky(fullSky);
  sky.draw();
  $("fullsky-btn").classList.toggle("bg-slate-100", fullSky);
});

$("time-slider").addEventListener("input", (e) => {
  updateCursor(Number(e.target.value));
});

openModal();
loadSites();
