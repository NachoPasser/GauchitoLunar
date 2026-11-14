// Harness de H2: cablea el modal de detalle con el backend y el skyline.
// H3 reutilizará createSkyline + showSite montándolos sobre el mapa.

import { getSites, getMask, getSite } from "./api.js";
import { createSkyline } from "./skyline.js";

const $ = (id) => document.getElementById(id);
const sky = createSkyline($("skyline"));
let fullSky = false;

function setStatus(msg, isError = false) {
  const s = $("status");
  s.textContent = msg;
  s.className = `text-xs ${isError ? "text-red-500" : "text-slate-400"}`;
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
    sky.setMask(mask.horizon_mask);
    sky.setTracks(site.sun_track, site.earth_track);
    sky.setParams({ commsMargin: site.params.comms_margin_deg });
    sky.draw();
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

openModal();
loadSites();
