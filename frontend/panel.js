// Panel de métricas en lenguaje llano (SPEC §1.1, §6). Sin semáforos: los números
// hablan solos, con jerga como etiqueta secundaria. Acento = identidad (Sol ámbar /
// Tierra cobalto), no un rating. Reusable por H3/H5. Formateo vía format.js.

import { fmtEnergy, fmtPct, fmtHours, fmtDays } from "./format.js";

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
  root.innerHTML = `
    <div class="space-y-3 pt-1 pb-2">
      ${strip("Días con / sin luz solar", site.sun_intervals)}
      ${strip("Días con / sin enlace a la Tierra", site.earth_intervals)}
      <p class="text-[11px]" style="color:var(--ink-3)">
        Cada bloque es un tramo continuo; el ancho es su duración.
        “≥” = recortado por los bordes de la ventana. Pasá el mouse para ver los días.
      </p>
    </div>`;
}

export function renderMetrics(root, site) {
  const m = site.metrics, p = site.params, e = m.energy_kwh_m2;

  root.innerHTML = `
    <div class="space-y-3 pb-1">

      <div class="card">
        <p class="metric__label mb-2">Energía solar captada
          <span style="color:var(--ink-3)">· ventana de ${p.window_days} días · kWh/m²</span>
        </p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="metric__value metric__value--sun">${fmtEnergy(e.horizontal)}</p>
            <p class="metric__sub">panel horizontal</p>
          </div>
          <div>
            <p class="metric__value">${fmtEnergy(e.vertical_sun_tracking)}</p>
            <p class="metric__sub">panel que sigue al Sol</p>
          </div>
        </div>
        <p class="text-[11px] mt-2" style="color:var(--ink-3)">
          El panel que sigue al Sol capta mucho más con el Sol rasante del polo.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="card" style="border-left:4px solid var(--sun)">
          <p class="text-sm font-semibold" style="color:var(--ink)">Sol · potencia</p>
          <p class="text-sm mt-1" style="color:var(--ink-2)">
            Con luz <b style="color:var(--ink)">${fmtPct(m.lit_fraction)}</b> del tiempo</p>
          <p class="text-xs mt-1" style="color:var(--ink-3)">
            Próximo ocaso: <b style="color:var(--ink-2)">${fmtHours(m.next_sunset_h)}</b></p>
        </div>
        <div class="card" style="border-left:4px solid var(--earth)">
          <p class="text-sm font-semibold" style="color:var(--ink)">Tierra · enlace directo</p>
          <p class="text-sm mt-1" style="color:var(--ink-2)">
            A la vista <b style="color:var(--ink)">${fmtPct(m.earth_vis_fraction)}</b> del tiempo</p>
          <p class="text-xs mt-1" style="color:var(--ink-3)">
            Próximo corte: <b style="color:var(--ink-2)">${fmtHours(m.next_earthset_h)}</b>
            <span style="color:var(--ink-3)">· margen ${p.comms_margin_deg}°</span>
          </p>
        </div>
      </div>

    </div>`;
}
