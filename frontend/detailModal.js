// Modal de detalle puntual compartido (H2 y H3). Encapsula máscara + tracks +
// skyline + slider + métricas + cartuchos. Requiere en el DOM el markup del overlay
// (ver detail.html / map.html, mismos ids). H3 lo abre al clickear un marcador.

import { getMask, getSite } from "./api.js";
import { createSkyline } from "./skyline.js";
import { renderMetrics, renderCartuchos } from "./panel.js";

export function createDetailModal({ windowDays = 30, date = null } = {}) {
  const $ = (id) => document.getElementById(id);
  const sky = createSkyline($("skyline"));
  let fullSky = false;
  let data = null;          // respuesta /api/site del sitio activo (para el slider)

  function setStatus(msg, isError = false) {
    const s = $("status");
    if (!s) return;
    s.textContent = msg;
    s.className = `text-xs ${isError ? "text-red-500" : "text-slate-400"}`;
  }

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

  async function showSite(lat, lon, name) {
    // Un sitio nuevo (libre) baja efemérides de Horizons en vivo la 1ª vez (~unos
    // segundos); luego queda cacheado. Avisamos para que la espera no confunda.
    setStatus("Cargando… (un sitio nuevo puede tardar unos segundos la 1ª vez)");
    try {
      const [mask, site] = await Promise.all([
        getMask(lat, lon),
        getSite(lat, lon, { windowDays, date }),
      ]);
      $("site-name").textContent = name || site.site.name;
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

  const overlay = () => $("detail-overlay");
  function close() { overlay().classList.add("hidden"); }
  function openEmpty() { overlay().classList.remove("hidden"); }

  // Wiring de controles (una sola vez).
  $("close-btn").addEventListener("click", close);
  overlay().addEventListener("click", (e) => {
    if (e.target === overlay()) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
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

  return {
    open(lat, lon, name) { openEmpty(); showSite(lat, lon, name); },
    show: showSite,
    openEmpty,
    close,
  };
}
