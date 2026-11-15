// Panel de métricas en lenguaje llano (SPEC §1.1, §6). Sin semáforos: los números
// hablan solos, con jerga como etiqueta secundaria. Acento = identidad (Sol ámbar /
// Tierra cobalto), no un rating. Reusable por H3/H5. Formateo vía format.js.

import { fmtEnergy, fmtPct, fmtHours, fmtDays, fmtDeg } from "./format.js";
import { initTooltips } from "./tooltip.js";

// Acceso al motor i18n (window.i18n lo define i18n.js, cargado antes del módulo).
const T = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);

// Atributos de tooltip (tooltip.js): texto + enfocable para teclado/tap.
const tip = (text) => `data-tip="${text}" tabindex="0"`;

const earthPillTip = (margin) => T("panel.tip.earthPillBase") +
  (margin > 0 ? T("panel.tip.earthPillMargin", { margin }) : "");

// Estilo por estado de los cartuchos (SPEC §3.1), alineado a los tokens de marca.
// `name` es la clave i18n del estado (se traduce al renderizar el tooltip).
const STATE = {
  lit: { bg: "#f59e0b", tx: "#3a2500", name: "panel.state.lit" },
  dark: { bg: "#dfe3ea", tx: "#5b6575", name: "panel.state.dark" },
  visible: { bg: "#0032a0", tx: "#ffffff", name: "panel.state.visible" },
  hidden: { bg: "#dfe3ea", tx: "#5b6575", name: "panel.state.hidden" },
};

// Una tira de cartuchos (z14): cada tramo con ancho ∝ duración; "≥" = recortado.
// El label se muestra solo si el tramo es lo bastante ancho (evita texto cortado).
function strip(title, intervals, help) {
  const total = intervals.reduce((a, iv) => a + iv.duration_h, 0) || 1;
  const segs = intervals.map((iv) => {
    const s = STATE[iv.state];
    const clipped = iv.clipped_start || iv.clipped_end;
    const wide = iv.duration_h / total > 0.08;        // ~espacio para el texto
    const label = wide ? `${clipped ? "≥" : ""}${fmtDays(iv.duration_days)} d` : "";
    const tipText = T("panel.strip.segTip", {
      n: fmtDays(iv.duration_days), state: T(s.name),
      more: clipped ? T("panel.strip.more") : "",
    });
    return `<div class="cartucho__seg" data-tip="${tipText}"
      style="flex:${iv.duration_h} 0 0;background:${s.bg};color:${s.tx}">${label}</div>`;
  }).join("");
  return `<div>
    <p class="cartucho__title"><span class="has-tip" ${tip(help)}>${title}</span></p>
    <div class="cartucho__bar mono">${segs}</div>
  </div>`;
}

export function renderCartuchos(root, site) {
  // Las tiras van metidas el radio del thumb del slider (.cartuchos) para que la
  // fracción de tiempo de la barra caiga justo bajo el centro del thumb. Así la
  // aguja (#cartucho-needle, left = i/max en detailModal) coincide con ambos.
  initTooltips();
  root.innerHTML = `
    <section class="cartuchos">
      <div class="cartuchos__track">
        ${strip(T("panel.strip.sunTitle"), site.sun_intervals, T("panel.tip.sunStrip"))}
        ${strip(T("panel.strip.earthTitle"), site.earth_intervals, T("panel.tip.earthStrip"))}
        <div id="cartucho-needle" class="cartucho__needle" style="left:0"></div>
      </div>
    </section>`;
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

// Íconos de la fila de eventos (trazos estilo lucide, 24×24).
const ICON = {
  sunset: `<path d="M12 10V2"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/>
    <path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/>
    <path d="m16 14-4 4-4-4"/><path d="M16 18a4 4 0 0 0-8 0"/>`,
  sunrise: `<path d="M12 2v8"/><path d="m4.93 10.93 1.41 1.41"/><path d="M2 18h2"/>
    <path d="M20 18h2"/><path d="m19.07 10.93-1.41 1.41"/><path d="M22 22H2"/>
    <path d="m8 6 4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>`,
  linkOn: `<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/>
    <circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/>
    <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>`,
  linkOff: `<circle cx="12" cy="12" r="7"/><path d="M2 15h20"/><path d="m15 18-3 3-3-3"/>`,
};

// Próximo evento de un track en el instante i. Visible → evento "malo" (ocaso /
// corte, caja neutra); oculto → evento "bueno" (amanecer / enlace, caja de color).
// v = {set, rise, iconSet, iconRise}. Sin cambio en la ventana → "—".
function nextEvent(track, i, v) {
  const visible = track[i].visible;
  const h = hoursToChange(track, i);
  const what = visible ? v.set : v.rise;
  return {
    label: h == null ? T("panel.ev.noEvent", { what: what.toLowerCase() })
      : T("panel.ev.inPrefix", { what }),
    value: h == null ? "—" : fmtHours(h),
    icon: visible ? v.iconSet : v.iconRise,
    good: !visible,
  };
}

// Fecha UTC del instante del cursor + día de la ventana ("DÍA 03 / 30"). El día
// es 1-based (las primeras 24 h son el día 1) y nunca supera window_days.
export function instantStamp(site, i) {
  const track = site.sun_track;
  const stamp = `${track[i].t.slice(0, 16).replace("T", " ")} UTC`;
  const total = site.params.window_days;
  const elapsed = (new Date(track[i].t) - new Date(track[0].t)) / 8.64e7;
  const day = Math.min(total, Math.floor(elapsed) + 1);
  const pad = (n) => String(n).padStart(2, "0");
  return { stamp, day: T("panel.dayBadge", { day: pad(day), total: pad(total) }) };
}

// Integral de energía acumulada (kWh/m²) muestra a muestra: mismo modelo que el
// backend para el panel horizontal (S·max(0,sin e), solo si visible). Devuelve
// h[i] = energía acumulada hasta el instante i inclusive.
function energyPrefix(track) {
  if (!track || track.length < 2) return track ? track.map(() => 0) : [];
  const S = 1361.0;   // W/m² — constants.SOLAR_CONSTANT_W_M2
  const dtH = (new Date(track[1].t) - new Date(track[0].t)) / 3.6e6;
  const h = [];
  let acc = 0;
  for (const p of track) {
    if (p.visible) acc += (S * Math.max(0, Math.sin((p.el * Math.PI) / 180)) * dtH) / 1000;
    h.push(acc);
  }
  return h;
}

// h(az) de la máscara por vecino más cercano (robusto a 360 o 720 muestras).
function horizonAt(mask, az) {
  if (!mask || !mask.length) return 0;
  const n = mask.length;
  const idx = ((Math.round((az / 360) * n) % n) + n) % n;
  return mask[idx].h_deg;
}

// Tarjeta de un astro (z14): cabecera con píldora de estado, valor principal que
// cambia con el slider y una fila fija con el % de la ventana. kind = sun | earth.
// tips = {pill, value, foot}: ayuda de cada métrica (tooltip.js).
function teleCard(kind, title, valueLabel, footLabel, footValue, tips) {
  return `
    <section class="tele-card tele-card--${kind}">
      <div class="tele-card__head">
        <span class="tele-card__title">${title}</span>
        <span class="tele-pill has-tip" data-role="pill" ${tip(tips.pill)}>—</span>
      </div>
      <div class="has-tip" ${tip(tips.value)}>
        <span class="tele-card__label">${valueLabel}</span>
        <span class="tele-card__value" data-role="value">—</span>
      </div>
      <div class="tele-card__foot has-tip" ${tip(tips.foot)}>
        <span class="tele-card__label">${footLabel}</span>
        <span class="tele-card__pct">${footValue}</span>
      </div>
    </section>`;
}

// Un evento de la fila (ícono + "Ocaso en" + valor); se completa en el update.
function eventSlot(kind, help) {
  return `
    <div class="tele-event tele-event--${kind} has-tip" ${tip(help)}>
      <div class="tele-event__icon" data-role="box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" data-role="icon"></svg>
      </div>
      <div class="min-w-0">
        <span class="tele-card__label truncate" data-role="label">—</span>
        <span class="tele-event__value mono" data-role="value">—</span>
      </div>
    </div>`;
}

// Renderiza tarjetas Sol/Tierra + fila de eventos y devuelve un updater(i) para lo
// que depende del instante: estado, energía ACUMULADA al cursor, despeje de la
// Tierra sobre el horizonte y cuenta regresiva. Los % son fijos de la ventana.
export function renderMetrics(root, site, mask) {
  const m = site.metrics, p = site.params;
  const energy = energyPrefix(site.sun_track);
  initTooltips();

  root.innerHTML = `
    <div class="space-y-3 pb-1">
      <div class="tele-grid">
        ${teleCard("sun", T("panel.sun.title"), T("panel.sun.value"), T("panel.sun.foot"),
          fmtPct(m.lit_fraction),
          { pill: T("panel.tip.sunPill"), value: T("panel.tip.energy"),
            foot: T("panel.tip.litPct") })}
        ${teleCard("earth", T("panel.earth.title"), T("panel.earth.value"),
          T("panel.earth.foot"), fmtPct(m.earth_vis_fraction),
          { pill: earthPillTip(p.comms_margin_deg), value: T("panel.tip.earthClear"),
            foot: T("panel.tip.earthPct") })}
      </div>
      <div class="tele-events">
        ${eventSlot("sun", T("panel.tip.sunEvent"))}${eventSlot("earth", T("panel.tip.earthEvent"))}
      </div>
    </div>`;

  const q = (sel, role) => root.querySelector(`${sel} [data-role="${role}"]`);
  const sunPill = q(".tele-card--sun", "pill"), sunVal = q(".tele-card--sun", "value");
  const earPill = q(".tele-card--earth", "pill"), earVal = q(".tele-card--earth", "value");

  function setEvent(kind, ev) {
    const sel = `.tele-event--${kind}`;
    q(sel, "box").classList.toggle("is-good", ev.good);
    q(sel, "icon").innerHTML = ev.icon;
    q(sel, "label").textContent = ev.label;
    q(sel, "value").textContent = ev.value;
  }

  return function updateInstant(i) {
    const s = site.sun_track[i], e = site.earth_track[i];
    // Igual que la Tierra: despeje sobre las MONTAÑAS (el − h(az)), no sobre el 0°.
    // Positivo = cuánto falta para que lo tape el relieve; negativo = cuánto para salir.
    const sc = s.el - horizonAt(mask, s.az);
    const scTxt = `${sc >= 0 ? "+" : ""}${fmtDeg(sc, 1)}`;
    sunPill.textContent = `${s.visible ? T("panel.sun.on") : T("panel.sun.off")} · ${scTxt}`;
    sunPill.classList.toggle("is-on", s.visible);
    sunVal.innerHTML = `${fmtEnergy(energy[i])} <small>kWh/m²</small>`;

    const cl = e.el - horizonAt(mask, e.az);
    earPill.textContent = e.visible ? T("panel.earth.on") : T("panel.earth.off");
    earPill.classList.toggle("is-on", e.visible);
    earVal.textContent = `${cl >= 0 ? "+" : ""}${cl.toFixed(1)}°`;
    earVal.classList.toggle("is-on", cl >= 0);

    setEvent("sun", nextEvent(site.sun_track, i, { set: T("panel.ev.sunset"),
      rise: T("panel.ev.sunrise"), iconSet: ICON.sunset, iconRise: ICON.sunrise }));
    setEvent("earth", nextEvent(site.earth_track, i, { set: T("panel.ev.linkOff"),
      rise: T("panel.ev.linkOn"), iconSet: ICON.linkOff, iconRise: ICON.linkOn }));
  };
}
