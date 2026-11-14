// Panel de métricas en lenguaje llano (SPEC §1.1, §6). Sin semáforos: los números
// hablan solos, con jerga como etiqueta secundaria. Acento = identidad (Sol ámbar /
// Tierra cobalto), no un rating. Reusable por H3/H5. Formateo vía format.js.

import { fmtEnergy, fmtPct, fmtHours, fmtDays, fmtDeg } from "./format.js";

// Estilo por estado de los cartuchos (SPEC §3.1), alineado a los tokens de marca.
const STATE = {
  lit: { bg: "#f59e0b", tx: "#3a2500", name: "con luz" },
  dark: { bg: "#dfe3ea", tx: "#5b6575", name: "sin luz" },
  visible: { bg: "#0032a0", tx: "#ffffff", name: "a la vista" },
  hidden: { bg: "#dfe3ea", tx: "#5b6575", name: "sin enlace" },
};

// Una tira de cartuchos: cada tramo con ancho ∝ duración; "≥" = recortado. El label
// se muestra solo si el tramo es lo bastante ancho (evita texto cortado).
function strip(title, intervals) {
  const total = intervals.reduce((a, iv) => a + iv.duration_h, 0) || 1;
  const segs = intervals.map((iv, i) => {
    const s = STATE[iv.state];
    const first = i === 0, last = i === intervals.length - 1;
    const radius = `${first ? "border-top-left-radius:6px;border-bottom-left-radius:6px;" : ""}` +
      `${last ? "border-top-right-radius:6px;border-bottom-right-radius:6px;" : ""}`;
    const clipped = iv.clipped_start || iv.clipped_end;
    const wide = iv.duration_h / total > 0.08;        // ~espacio para el texto
    const label = wide ? `${clipped ? "≥" : ""}${fmtDays(iv.duration_days)} d` : "";
    const tip = `${s.name} · ${fmtDays(iv.duration_days)} días` +
      `${clipped ? " (recortado por la ventana)" : ""}`;
    return `<div title="${tip}" style="flex:${iv.duration_h} 0 0;background:${s.bg};` +
      `color:${s.tx};${radius}" class="h-7 flex items-center justify-center text-[10px] ` +
      `font-semibold overflow-hidden whitespace-nowrap mono">${label}</div>`;
  }).join("");
  return `<div>
    <p class="text-xs mb-1.5" style="color:var(--ink-2)">${title}</p>
    <div class="flex gap-px rounded-md overflow-hidden" style="background:var(--border)">${segs}</div>
  </div>`;
}

export function renderCartuchos(root, site) {
  // `relative` para posicionar la aguja; #cartucho-needle = indicador del instante
  // del slider, alineado por fracción de tiempo sobre ambas tiras (ver detailModal).
  root.innerHTML = `
    <div class="relative space-y-3 pt-1 pb-2">
      ${strip("Días con / sin luz solar", site.sun_intervals)}
      ${strip("Días con / sin enlace a la Tierra", site.earth_intervals)}
      <div id="cartucho-needle" class="absolute top-0 bottom-0 w-0 pointer-events-none"
           style="left:0;border-left:2px dashed var(--ink);opacity:.5;transform:translateX(-50%)"></div>
    </div>`;
}

// Horas desde el índice i hasta el próximo cambio de visibilidad del track, o null
// si el astro no cambia de estado antes del fin de la ventana. Deriva Δt de los
// propios timestamps (no asume el paso del backend).
function hoursToChange(track, i) {
  const now = track[i].visible;
  for (let j = i + 1; j < track.length; j++) {
    if (track[j].visible !== now)
      return (new Date(track[j].t) - new Date(track[i].t)) / 3.6e6;
  }
  return null;
}

// Estado + cuenta regresiva adaptativa: si está visible, cuánto falta para el ocaso;
// si está oculto, cuánto para la próxima salida. v = {on,off,set,rise,noSet,noRise}.
function countdown(track, i, visible, v) {
  const h = hoursToChange(track, i);
  const state = visible ? v.on : v.off;
  const tail = h == null
    ? `sin ${visible ? v.noSet : v.noRise} en la ventana`
    : `${visible ? v.set : v.rise} en ${fmtHours(h)}`;
  return `${state}, ${tail}`;
}

// Línea de estado del instante del cursor (reemplaza al time-label fijo): fecha UTC +
// elevación, estado y cuenta regresiva de Sol y Tierra. Todo derivado del track.
export function instantLine(site, i) {
  const s = site.sun_track[i], e = site.earth_track[i];
  const t = s.t.slice(0, 16).replace("T", " ");
  const sun = countdown(site.sun_track, i, s.visible,
    { on: "con luz", off: "sin luz", set: "ocaso", rise: "amanece",
      noSet: "ocaso", noRise: "salida" });
  const ear = countdown(site.earth_track, i, e.visible,
    { on: "a la vista", off: "sin enlace", set: "corte", rise: "enlace",
      noSet: "corte", noRise: "enlace" });
  // La elevación de la Tierra se movió al panel (despeje sobre el horizonte); acá
  // queda solo estado + cuenta regresiva para no duplicar el número.
  return `${t} UTC` +
    ` · <b style="color:var(--sun)">Sol</b> ${fmtDeg(s.el, 1)} ${sun}` +
    ` · <b style="color:var(--earth)">Tierra</b> ${ear}`;
}

// Integral de energía acumulada (kWh/m²) muestra a muestra: mismo modelo que el
// backend (S·max(0,sin e) horizontal, S·max(0,cos e) sun-tracking; solo si visible).
// Devuelve prefijos h[i]/v[i] = energía acumulada hasta el instante i inclusive.
function energyPrefix(track) {
  const S = 1361.0;   // W/m² — constants.SOLAR_CONSTANT_W_M2
  const dtH = (new Date(track[1].t) - new Date(track[0].t)) / 3.6e6;
  const h = [], v = [];
  let ah = 0, av = 0;
  for (const p of track) {
    if (p.visible) {
      const e = (p.el * Math.PI) / 180;
      ah += (S * Math.max(0, Math.sin(e)) * dtH) / 1000;
      av += (S * Math.max(0, Math.cos(e)) * dtH) / 1000;
    }
    h.push(ah); v.push(av);
  }
  return { h, v };
}

// h(az) de la máscara por vecino más cercano (robusto a 360 o 720 muestras).
function horizonAt(mask, az) {
  if (!mask || !mask.length) return 0;
  const n = mask.length;
  const idx = ((Math.round((az / 360) * n) % n) + n) % n;
  return mask[idx].h_deg;
}

// Renderiza el scaffold de métricas y devuelve un updater(i) que refresca las partes
// que dependen del instante: energía ACUMULADA al cursor (Sol) y despeje sobre el
// horizonte (Tierra). Los % son fijos de la ventana. Necesita la máscara para el despeje.
export function renderMetrics(root, site, mask) {
  const m = site.metrics, p = site.params;
  const { h: prefixH, v: prefixV } = energyPrefix(site.sun_track);
  const t0 = new Date(site.sun_track[0].t);

  root.innerHTML = `
    <div class="space-y-3 pb-1">

      <div class="card">
        <p class="metric__label mb-2">Energía solar acumulada
          <span style="color:var(--ink-3)">· kWh/m² · <span id="energy-elapsed">—</span></span>
        </p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="metric__value metric__value--sun" id="energy-h">—</p>
            <p class="metric__sub">panel horizontal</p>
          </div>
          <div>
            <p class="metric__value" id="energy-v">—</p>
            <p class="metric__sub">panel que sigue al Sol</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="card" style="border-left:4px solid var(--sun)">
          <p class="text-sm font-semibold" style="color:var(--ink)">Sol · potencia</p>
          <p class="text-sm mt-1" style="color:var(--ink-2)">
            <b style="color:var(--ink)">${fmtPct(m.lit_fraction)}</b> del tiempo con luz</p>
        </div>
        <div class="card" style="border-left:4px solid var(--earth)">
          <p class="text-sm font-semibold" style="color:var(--ink)">Tierra · enlace directo</p>
          <p class="text-sm mt-1" style="color:var(--ink-2)">
            <b style="color:var(--ink)" id="earth-clear">—</b> sobre el horizonte</p>
          <p class="text-xs mt-1" style="color:var(--ink-3)">
            <b style="color:var(--ink-2)">${fmtPct(m.earth_vis_fraction)}</b> del tiempo a la vista
            · margen ${p.comms_margin_deg}°</p>
        </div>
      </div>

    </div>`;

  const elH = root.querySelector("#energy-h");
  const elV = root.querySelector("#energy-v");
  const elapsed = root.querySelector("#energy-elapsed");
  const clear = root.querySelector("#earth-clear");

  return function updateInstant(i) {
    elH.textContent = fmtEnergy(prefixH[i]);
    elV.textContent = fmtEnergy(prefixV[i]);
    const days = (new Date(site.sun_track[i].t) - t0) / 8.64e7;
    elapsed.textContent = `${fmtDays(days)} de ${p.window_days} d`;
    const e = site.earth_track[i];
    const cl = e.el - horizonAt(mask, e.az);
    clear.textContent = `${cl >= 0 ? "+" : ""}${cl.toFixed(1)}°`;
    clear.style.color = cl >= 0 ? "var(--earth)" : "var(--ink-3)";
  };
}
