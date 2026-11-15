// Modal de detalle puntual compartido (H2 y H3). Encapsula máscara + tracks +
// skyline + slider + métricas + cartuchos. Requiere en el DOM el markup del overlay
// (ver detail.html / map.html, mismos ids). H3 lo abre al clickear un marcador.

import { getMask, getSite } from "./api.js";
import { createSkyline } from "./skyline.js";
import { renderMetrics, renderCartuchos, instantLine } from "./panel.js";

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

  // Loader minimalista del detalle: esqueleto del layout + barra que avanza por los
  // PASOS reales del cálculo (honesto y pedagógico). Oculta el contenido real (no salta).
  const LOAD_STEPS = [
    "Trazando el horizonte desde el DEM",
    "Bajando efemérides del Sol y la Tierra (JPL Horizons)",
    "Integrando energía y visibilidad",
  ];
  let loadingEl = null, stepTimer = null;
  const contentEls = () => [$("skyline").parentElement, $("metrics"), $("cartuchos")];

  function showLoading() {
    if (!loadingEl) {
      const wrap = $("skyline").parentElement;
      loadingEl = document.createElement("div");
      loadingEl.className = "detail-loading";
      loadingEl.innerHTML =
        '<div class="sk sk--sky"></div>' +
        '<div class="load-bar"><span></span></div>' +
        '<p class="load-step mono"></p>' +
        '<div class="sk-metrics"><div class="sk sk--card"></div>' +
        '<div class="sk sk--card"></div><div class="sk sk--card"></div></div>';
      wrap.parentElement.insertBefore(loadingEl, wrap);
    }
    loadingEl.style.display = "";
    for (const el of contentEls()) el.style.display = "none";
    const stepEl = loadingEl.querySelector(".load-step");
    const bar = loadingEl.querySelector(".load-bar > span");
    let i = 0;
    const tick = () => {
      stepEl.textContent = LOAD_STEPS[i];
      bar.style.width = `${Math.round(((i + 1) / LOAD_STEPS.length) * 100)}%`;
      if (i < LOAD_STEPS.length - 1) i++;
    };
    tick();
    stepTimer = setInterval(tick, 1100);
  }
  function hideLoading() {
    if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
    if (loadingEl) loadingEl.style.display = "none";
    for (const el of contentEls()) el.style.display = "";
  }

  function updateCursor(i) {
    if (!data) return;
    sky.setCursor(i);
    sky.draw();
    if (updateMetrics) updateMetrics(i);
    $("time-label").innerHTML = instantLine(data, i);
    if (onInstant) {
      const s = data.sun_track[i], e = data.earth_track[i];
      onInstant(s.az, e.az, s.t.slice(0, 16).replace("T", " "));
    }
    const needle = $("cartucho-needle");
    if (needle) {
      const max = Number($("time-slider").max) || 1;
      needle.style.left = `${(i / max) * 100}%`;
    }
  }

  async function showSite(lat, lon, name) {
    // El nombre/coords del sitio se muestran YA (pedagógico), y el loader corre mientras
    // un sitio nuevo baja efemérides de Horizons en vivo (~unos segundos la 1ª vez).
    $("site-name").textContent = name || "Sitio nuevo";
    $("site-coords").textContent = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°E`;
    setStatus("");
    showLoading();
    try {
      const [mask, site] = await Promise.all([
        getMask(lat, lon),
        getSite(lat, lon, { windowDays, date }),
      ]);
      $("site-name").textContent = name || site.site.name;
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
      hideLoading();                           // revelar antes del cursor (necesita layout)
      updateCursor(0);
    } catch (e) {
      hideLoading();
      setStatus(`No se pudo cargar (¿backend activo?): ${e.message}`, true);
    }
  }

  const overlay = () => $("detail-overlay");
  function close() { overlay().classList.remove("is-open"); }
  function openEmpty() { overlay().classList.add("is-open"); }

  // Botón 🗑: visible solo si el sitio es borrable (chincheta propia). onclick se
  // reemplaza en cada apertura (no acumula listeners).
  function setupDelete(onDelete) {
    const btn = $("delete-btn");
    if (!btn) return;
    btn.onclick = onDelete || null;
    btn.classList.toggle("hidden", !onDelete);
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
    $("fullsky-btn").classList.toggle("bg-slate-100", fullSky);
  });
  $("time-slider").addEventListener("input", (e) => {
    updateCursor(Number(e.target.value));
  });

  return {
    open(lat, lon, name, opts = {}) {
      openEmpty();
      setupDelete(opts.onDelete);
      showSite(lat, lon, name);
    },
    show: showSite,
    openEmpty,
    close,
  };
}
