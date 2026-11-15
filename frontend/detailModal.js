// Modal de detalle puntual compartido (H2 y H3). Encapsula máscara + tracks +
// skyline + slider + métricas + cartuchos. Requiere en el DOM el markup del overlay
// (ver detail.html / map.html, mismos ids). H3 lo abre al clickear un marcador.

import { getMask, getSite } from "./api.js";
import { createSkyline } from "./skyline.js";
import { renderMetrics, renderCartuchos, instantStamp } from "./panel.js";
import { renderLanderFrame } from "./landerFrame.js";

export function createDetailModal({ windowDays = 30, date = null,
                                    onAzimuthWindow = null, onInstant = null } = {}) {
  // windowDays / date pueden ser valores fijos o funciones () → valor.
  // Usar resolve() para leer siempre el estado actual en el momento de abrir.
  const resolve = (v) => (typeof v === "function" ? v() : v);
  const $ = (id) => document.getElementById(id);
  const sky = createSkyline($("skyline"), { onWindowChange: onAzimuthWindow });
  let fullSky = false;
  let playTimer = null;     // interval de reproducción automática del slider (play/pause)
  let loading = false;       // true mientras showSite espera la respuesta del backend
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
    const { stamp, day } = instantStamp(data, i);
    $("time-label").textContent = stamp;
    const dayBadge = $("day-badge");
    if (dayBadge) dayBadge.textContent = day;
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
    // El nombre/coords del sitio se muestran YA (pedagógico), y el loader corre mientras
    // un sitio nuevo baja efemérides de Horizons en vivo (~unos segundos la 1ª vez).
    stopPlay();                   // cada sitio nuevo arranca pausado
    $("site-name").textContent = name || "Sitio nuevo";
    $("site-coords").textContent = `${lat.toFixed(2)}°, ${lon.toFixed(2)}°E`;
    setStatus("");
    const panel = $("detail-panel");
    if (panel) {
      panel.classList.remove("lander-touchdown-anim");
      void panel.offsetWidth;
      panel.classList.add("lander-touchdown-anim");
    }
    loading = true;
    showLoading();
    try {
      const [mask, site] = await Promise.all([
        getMask(lat, lon),
        getSite(lat, lon, { windowDays: resolve(windowDays), date: resolve(date) }),
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
      const msg = e.status === 503
        ? "Sin efemérides para este sitio. Probá uno predefinido o conectate a internet."
        : `No se pudo cargar (¿backend activo?): ${e.message}`;
      setStatus(msg, true);
    } finally {
      loading = false;
    }
  }

  const overlay = () => $("detail-overlay");
  function close() { stopPlay(); overlay().classList.remove("is-open"); }
  function openEmpty() {
    overlay().classList.add("is-open");
    // Un frame después el panel ya tiene layout; cambios de tamaño posteriores
    // (animación de apertura, contenido que carga) los toma el ResizeObserver.
    requestAnimationFrame(() => updateFrame());
  }

  // Botón 🗑: visible solo si el sitio es borrable (chincheta propia).
  function setupDelete(onDelete) {
    const btn = $("delete-btn");
    if (!btn) return;
    btn.onclick = onDelete || null;
    btn.classList.toggle("hidden", !onDelete);
  }

  // Botón ✏: visible solo para chinchetas propias. Abre un input inline sobre el h2.
  // onRename(newName) debe devolver true si acepta, false si rechaza (duplicado).
  function setupRename(onRename) {
    const btn = $("rename-btn");
    if (!btn) return;
    btn.onclick = null;
    btn.classList.toggle("hidden", !onRename);
    if (!onRename) return;
    btn.onclick = () => {
      const nameEl = $("site-name");
      if (!nameEl) return;
      const original = nameEl.textContent.trim();
      const inp = document.createElement("input");
      inp.type = "text";
      inp.value = original;
      inp.maxLength = 40;
      inp.className = nameEl.className;
      inp.style.cssText =
        "font:inherit;color:inherit;background:transparent;" +
        "border:none;border-bottom:1.5px solid #60a5fa;outline:none;" +
        "width:100%;min-width:0;";
      nameEl.style.display = "none";
      nameEl.insertAdjacentElement("afterend", inp);
      inp.focus(); inp.select();
      const finish = (save) => {
        inp.remove();
        nameEl.style.display = "";
        if (save) {
          const v = inp.value.trim() || original;
          if (v !== original) {
            const accepted = onRename(v);
            if (accepted !== false) {
              nameEl.textContent = v;
            } else {
              nameEl.textContent = original;
              setStatus("Ya existe un sitio con ese nombre", true);
              setTimeout(() => setStatus(""), 2500);
            }
          }
        }
      };
      inp.addEventListener("blur", () => finish(true));
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); inp.blur(); }
        if (e.key === "Escape") { finish(false); }
      });
    };
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
    $("fullsky-btn").setAttribute("aria-pressed", String(fullSky));
  });

  // Play/pause: reproduce la ventana de tiempo avanzando el slider solo y loopeando.
  const PLAY_MS = 60;             // ms por paso de la animación
  function setPlayIcon(playing) {
    const btn = $("play-btn");
    if (!btn) return;
    const p = btn.querySelector("path");
    if (p) p.setAttribute("d", playing ? "M6 5h4v14H6zM14 5h4v14h-4z" : "M8 5v14l11-7z");
    btn.setAttribute("aria-pressed", String(playing));
    btn.setAttribute("aria-label", playing ? "Pausar" : "Reproducir la animación del tiempo");
  }
  function stopPlay() {
    if (playTimer) { clearInterval(playTimer); playTimer = null; }
    setPlayIcon(false);
  }
  function startPlay() {
    if (playTimer || !data) return;
    const slider = $("time-slider");
    setPlayIcon(true);
    playTimer = setInterval(() => {
      let i = Number(slider.value) + 1;
      if (i > (Number(slider.max) || 0)) i = 0;   // loopea al llegar al final
      slider.value = i;
      updateCursor(i);
    }, PLAY_MS);
  }
  const playBtn = $("play-btn");
  if (playBtn) playBtn.addEventListener("click", () => (playTimer ? stopPlay() : startPlay()));

  $("time-slider").addEventListener("input", (e) => {
    stopPlay();                    // arrastrar manualmente pausa la reproducción
    updateCursor(Number(e.target.value));
  });

  // Redibujar el marco si el panel cambia de tamaño (solo con el modal abierto).
  const refit = () => { if (overlay().classList.contains("is-open")) updateFrame(); };
  const panel = $("detail-panel");
  if (panel && window.ResizeObserver) new ResizeObserver(refit).observe(panel);
  else window.addEventListener("resize", refit);

  return {
    open(lat, lon, name, opts = {}) {
      openEmpty();
      setupDelete(opts.onDelete);
      setupRename(opts.onRename);
      showSite(lat, lon, name);
    },
    show: showSite,
    openEmpty,
    close,
    isLoading: () => loading,
  };
}
