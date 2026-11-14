// Panel de métricas en lenguaje llano (SPEC §1.1, §6). Sin semáforos: los números
// hablan solos, con jerga como etiqueta secundaria. Acento de color = identidad
// (Sol ámbar / Tierra azul), no un rating bueno/malo. Reusable por H3/H5.

const pct = (x) => `${Math.round((x || 0) * 100)}%`;

// Horas → texto corto: < 2 días en horas, si no en días.
function fmtH(h) {
  if (h == null) return "—";
  return h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1)} días`;
}

// Estilo por estado de los cartuchos (SPEC §3.1).
const STATE = {
  lit: { bg: "bg-amber-400", tx: "text-amber-900", name: "con luz" },
  dark: { bg: "bg-slate-300", tx: "text-slate-600", name: "sin luz" },
  visible: { bg: "bg-blue-500", tx: "text-white", name: "a la vista" },
  hidden: { bg: "bg-slate-300", tx: "text-slate-600", name: "sin enlace" },
};

// Una tira de cartuchos: cada tramo con ancho ∝ duración; "≥" = recortado.
function strip(title, intervals) {
  const segs = intervals.map((iv, i) => {
    const s = STATE[iv.state];
    const first = i === 0, last = i === intervals.length - 1;
    const round = `${first ? "rounded-l-md " : ""}${last ? "rounded-r-md " : ""}`;
    const clipped = iv.clipped_start || iv.clipped_end;
    const label = iv.duration_days >= 0.4 ? `${clipped ? "≥" : ""}${iv.duration_days} d` : "";
    const tip = `${s.name} · ${iv.duration_days} días${clipped ? " (recortado por la ventana)" : ""}`;
    return `<div title="${tip}" style="flex:${iv.duration_h} 0 0"
      class="h-7 flex items-center justify-center text-[10px] font-medium
             overflow-hidden whitespace-nowrap ${s.bg} ${s.tx} ${round}">${label}</div>`;
  }).join("");
  return `<div>
    <p class="text-xs text-slate-500 mb-1">${title}</p>
    <div class="flex gap-px rounded-md overflow-hidden bg-slate-100">${segs}</div>
  </div>`;
}

// Dos tiras de cartuchos (días con/sin luz, días con/sin enlace).
export function renderCartuchos(root, site) {
  root.innerHTML = `
    <div class="space-y-3 pt-3 pb-2">
      ${strip("Días con / sin luz solar", site.sun_intervals)}
      ${strip("Días con / sin enlace a la Tierra", site.earth_intervals)}
      <p class="text-[11px] text-slate-400">
        Cada bloque es un tramo continuo; el ancho es su duración.
        “≥” = recortado por los bordes de la ventana. Pasá el mouse para ver los días.
      </p>
    </div>`;
}

export function renderMetrics(root, site) {
  const m = site.metrics;
  const p = site.params;
  const e = m.energy_kwh_m2;

  root.innerHTML = `
    <div class="space-y-3 pb-2">

      <div class="rounded-xl border border-slate-200 p-4">
        <p class="text-xs text-slate-500 mb-2">
          Energía solar captada
          <span class="text-slate-400">· ventana de ${p.window_days} días · kWh/m²</span>
        </p>
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-2xl font-bold text-amber-500">${e.horizontal}</p>
            <p class="text-xs text-slate-500">panel horizontal</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-slate-800">${e.vertical_sun_tracking}</p>
            <p class="text-xs text-slate-500">panel vertical (sigue al Sol)</p>
          </div>
        </div>
        <p class="text-[11px] text-slate-400 mt-2">
          El panel vertical capta mucho más con el Sol rasante del polo.
        </p>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-xl border-l-4 border-amber-400 bg-amber-50/50 p-3">
          <p class="text-sm font-semibold text-slate-700">Sol (potencia)</p>
          <p class="text-sm text-slate-600 mt-1">Con luz <b>${pct(m.lit_fraction)}</b> del tiempo</p>
          <p class="text-xs text-slate-500 mt-1">Próximo ocaso: <b>${fmtH(m.next_sunset_h)}</b></p>
        </div>
        <div class="rounded-xl border-l-4 border-blue-500 bg-blue-50/50 p-3">
          <p class="text-sm font-semibold text-slate-700">Tierra (enlace directo)</p>
          <p class="text-sm text-slate-600 mt-1">A la vista <b>${pct(m.earth_vis_fraction)}</b> del tiempo</p>
          <p class="text-xs text-slate-500 mt-1">
            Próximo corte: <b>${fmtH(m.next_earthset_h)}</b>
            <span class="text-slate-400">· margen ${p.comms_margin_deg}°</span>
          </p>
        </div>
      </div>

    </div>`;
}
