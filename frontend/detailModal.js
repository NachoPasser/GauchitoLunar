// Modal de detalle puntual compartido (H2 y H3). Encapsula máscara + tracks +
// skyline + slider + métricas + cartuchos. Requiere en el DOM el markup del overlay
// (ver detail.html / map.html, mismos ids). H3 lo abre al clickear un marcador.

import { getMask, getSite } from "./api.js";
import { createSkyline } from "./skyline.js";
import { renderMetrics, renderCartuchos, instantStamp } from "./panel.js";
import { renderLanderFrame } from "./landerFrame.js";

export function createDetailModal({ windowDays = 30, date = null,
                                    onAzimuthWindow = null, onInstant = null } = {}) {
  const $ = (id) => document.getElementById(id);
  const sky = createSkyline($("skyline"), { onWindowChange: onAzimuthWindow });
  let fullSky = false;
  let data = null;          // respuesta /api/site del sitio activo (para el slider)
  let updateMetrics = null; // updater(i) de las métricas por instante (ver panel.js)

  function setStatus(msg, isError = false) {
    const s = $("status");
    if (!s) return;
    s.textContent = msg;
    s.className = `text-xs ${isError ? "text-red-500" : "text-slate-400"}`;
  }

  // Marco del lander según la visibilidad en el instante i (default: slider actual).
  // Sin datos aún → todo "encendido". renderLanderFrame memoiza: llamarlo de más es
  // barato.
  function updateFrame(i = Number($("time-slider")?.value) || 0) {
    const hasSolar = Boolean(data?.sun_track?.[i]?.visible ?? true);
    const hasEarth = Boolean(data?.earth_track?.[i]?.visible ?? true);
    renderLanderFrame(hasEarth, hasSolar);
  }

  function updateCursor(i) {
    if (!data) return;
    sky.setCursor(i);
    sky.draw();
    if (updateMetrics) updateMetrics(i);
    const { stamp, day } = instantStamp(data, i);
    $("time-label").textContent = stamp;
    $("day-badge").textContent = day;
    if (onInstant) {
      const s = data.sun_track[i], e = data.earth_track[i];
      onInstant(s.az, e.az, s.t.slice(0, 16).replace("T", " "));
    }
    const needle = $("cartucho-needle");
    if (needle) {
      const max = Number($("time-slider").max) || 1;
      needle.style.left = `${(i / max) * 100}%`;
    }
    updateFrame(i);
  }

  async function showSite(lat, lon, name) {
    // Un sitio nuevo (libre) baja efemérides de Horizons en vivo la 1ª vez (~unos
    // segundos); luego queda cacheado. Avisamos para que la espera no confunda.
    setStatus("Cargando… (un sitio nuevo puede tardar unos segundos la 1ª vez)");
    const panel = $("detail-panel");
    if (panel) {
      panel.classList.remove("lander-touchdown-anim");
      void panel.offsetWidth;
      panel.classList.add("lander-touchdown-anim");
    }
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
      // Ventana de azimut inicial centrada en la Tierra (dirección de comms, §2.3).
      sky.centerWindow(site.earth_track[0].az);
      const slider = $("time-slider");
      slider.max = site.sun_track.length - 1;
      slider.value = 0;
      updateMetrics = renderMetrics($("metrics"), site, mask.horizon_mask);
      renderCartuchos($("cartuchos"), site);   // crea #cartucho-needle antes del cursor
      updateCursor(0);
      setStatus("");
    } catch (e) {
      setStatus(`No se pudo cargar (¿backend activo?): ${e.message}`, true);
    }
  }

  const overlay = () => $("detail-overlay");
  function close() { overlay().classList.remove("is-open"); }
  function openEmpty() {
    overlay().classList.add("is-open");
    // Un frame después el panel ya tiene layout; cambios de tamaño posteriores
    // (animación de apertura, contenido que carga) los toma el ResizeObserver.
    requestAnimationFrame(() => updateFrame());
  }

  // Wiring de controles (una sola vez).
  $("close-btn").addEventListener("click", close);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });
  $("fullsky-btn").addEventListener("click", () => {
    fullSky = !fullSky;
    sky.setFullSky(fullSky);
    sky.draw();
    // aria-pressed = estado on/off (el CSS de .toggle-pill lo dibuja).
    $("fullsky-btn").setAttribute("aria-pressed", String(fullSky));
  });
  $("time-slider").addEventListener("input", (e) => {
    updateCursor(Number(e.target.value));
  });

  // Redibujar el marco si el panel cambia de tamaño (solo con el modal abierto).
  const refit = () => { if (overlay().classList.contains("is-open")) updateFrame(); };
  const panel = $("detail-panel");
  if (panel && window.ResizeObserver) new ResizeObserver(refit).observe(panel);
  else window.addEventListener("resize", refit);

  return {
    open(lat, lon, name) { openEmpty(); showSite(lat, lon, name); },
    show: showSite,
    openEmpty,
    close,
  };
}
