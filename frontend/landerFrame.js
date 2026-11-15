// Hardware SVG del lander alrededor del marco azul del detalle (diseño z14):
// antena (con ondas si hay enlace a la Tierra), ala solar (LED encendido si hay
// Sol), toberas RCS, motor y patas. Liviano: colores planos, sin degradados.
// Se adapta al ancho/alto de #detail-panel.
//
// Memoizado: solo re-renderiza si cambia el tamaño del panel o el estado
// (enlace Tierra / luz solar). El slider lo llama en cada tick y casi siempre
// es un no-op.

const ACCENT = "#E03C31", HULL = "#1E293B", STEEL = "#334155", STRUT = "#475569";

// Geometría fija (z14): apertura de patas delanteras/traseras, alto de patas, y
// distancias de la antena (desde la derecha) y del ala solar (desde la izquierda).
const LEG_OUTER = 30, LEG_INNER = 78, LEG_H = 40, ANT_FROM_RIGHT = 66, PANEL_X = 44;

const DEFS = `
  <defs>
    <pattern id="solar-cells" width="7" height="7" patternUnits="userSpaceOnUse">
      <path d="M 7 0 L 0 0 0 7" fill="none" stroke="#94A3B8"
            stroke-width="0.6" stroke-opacity="0.4"/>
    </pattern>
  </defs>`;

// Pernos de las 4 esquinas + franjas de acento superiores.
function fuselage(w, h) {
  const bolt = (x, y) => `<circle cx="${x}" cy="${y}" r="1.7" />`;
  return `
    <g fill="#FFFFFF" fill-opacity="0.7">
      ${bolt(9, 9)}${bolt(w - 9, 9)}${bolt(9, h - 9)}${bolt(w - 9, h - 9)}
    </g>
    <rect x="20" y="5" width="13" height="3" rx="1.5" fill="${ACCENT}" />
    <rect x="${w - 33}" y="5" width="13" height="3" rx="1.5" fill="${ACCENT}" />`;
}

// Ala fotovoltaica (arriba izquierda): más clara + LED de acento si hay Sol.
function solarArray(px, lit) {
  const ax = px + 24;
  return `
    <g id="lander-solar-array">
      <line x1="${ax}" y1="2" x2="${ax}" y2="-13" stroke="${HULL}" stroke-width="3.5" />
      <circle cx="${ax}" cy="-7" r="2.6" fill="${ACCENT}" stroke="#FFFFFF" stroke-width="1" />
      <rect x="${px - 16}" y="-26" width="80" height="14" rx="2.5"
            fill="${lit ? HULL : "#090D16"}" stroke="#FFFFFF" stroke-width="1.2" />
      <rect x="${px - 16}" y="-26" width="80" height="14" rx="2.5" fill="url(#solar-cells)" />
      <circle cx="${px + 56}" cy="-19" r="2.2" fill="${lit ? ACCENT : "#64748B"}" />
    </g>`;
}

// Ondas de radio animadas (solo con enlace a la Tierra).
function radioWaves(x) {
  const wave = (d, cls, sw) =>
    `<path class="lander-radio-wave${cls}" d="${d}" fill="none" stroke="${ACCENT}"
           stroke-width="${sw}" stroke-linecap="round" />`;
  return `
    <g transform="translate(${x}, -31)">
      ${wave("M 2 -5 A 7 7 0 0 1 7 2", "", 1.6)}
      ${wave("M 4 -10 A 13 13 0 0 1 13 4", " delay-1", 1.3)}
      ${wave("M 5 -15 A 19 19 0 0 1 19 5", " delay-2", 1)}
    </g>`;
}

// Antena parabólica (arriba derecha).
function dish(ax, link) {
  return `
    <g id="lander-dish">
      <rect x="${ax - 7}" y="-5" width="14" height="7" rx="1.5" fill="${HULL}" />
      <line x1="${ax}" y1="-5" x2="${ax + 5}" y2="-18" stroke="${STEEL}"
            stroke-width="2.2" stroke-linecap="round" />
      <path d="M ${ax - 12} -27 Q ${ax + 5} -9 ${ax + 22} -18" fill="none"
            stroke="${HULL}" stroke-width="2.5" stroke-linecap="round" />
      <line x1="${ax + 5}" y1="-18" x2="${ax + 12}" y2="-27" stroke="${ACCENT}"
            stroke-width="1.8" />
      <circle cx="${ax + 13}" cy="-28" r="2.5" fill="${ACCENT}" />
      ${link ? radioWaves(ax + 16) : ""}
    </g>`;
}

// Tobera RCS lateral; la derecha es el espejo exacto de la izquierda.
function thruster(x, y, mirror) {
  const t = `translate(${x}, ${y})${mirror ? " scale(-1 1)" : ""}`;
  return `
    <g transform="${t}">
      <rect x="-7" y="-10" width="9" height="20" rx="1.5" fill="#FFFFFF"
            stroke="${HULL}" stroke-width="1.2" />
      <polygon points="-4,-10 -8,-18 0,-18" fill="${ACCENT}" />
      <polygon points="-4,10 -8,18 0,18" fill="${ACCENT}" />
      <polygon points="-7,-3 -13,-5.5 -13,5.5 -7,3" fill="${STEEL}" />
    </g>`;
}

// Motor principal de descenso.
function engine(w, h) {
  return `
    <g transform="translate(${w / 2}, ${h})">
      <polygon points="-13,0 13,0 20,14 -20,14" fill="${HULL}"
               stroke="#FFFFFF" stroke-width="1.2" />
      <line x1="-16" y1="5" x2="16" y2="5" stroke="${ACCENT}" stroke-width="1.8" />
    </g>`;
}

// Par de patas (trasera tenue + delantera) de un lado; mx() espeja x para el
// lado derecho.
function legs(w, h, right) {
  const mx = (x) => (right ? w - x : x);
  const padY = h + LEG_H;
  const sx = -LEG_OUTER * 0.45, sy = h + LEG_H * 0.55;   // amortiguador
  return `
    <g opacity="0.6">
      <line x1="${mx(LEG_INNER)}" y1="${h - 2}" x2="${mx(LEG_INNER - 13)}" y2="${padY - 3}"
            stroke="${STRUT}" stroke-width="2.8" />
      <ellipse cx="${mx(LEG_INNER - 13)}" cy="${padY - 2}" rx="8.5" ry="2.2"
               fill="${STEEL}" />
    </g>
    <g>
      <line x1="${mx(20)}" y1="${h - 4}" x2="${mx(-LEG_OUTER)}" y2="${padY}"
            stroke="${STRUT}" stroke-width="3.2" stroke-linecap="round" />
      <line x1="${mx(46)}" y1="${h - 2}" x2="${mx(sx)}" y2="${sy}"
            stroke="#94A3B8" stroke-width="1.8" />
      <circle cx="${mx(sx)}" cy="${sy}" r="2.8" fill="${ACCENT}" />
      <ellipse cx="${mx(-LEG_OUTER)}" cy="${padY}" rx="10.5" ry="2.6" fill="${STEEL}" />
    </g>`;
}

export function renderLanderFrame(
  hasEarthLink = true,
  hasSolarLight = true,
  containerId = "detail-panel",
  svgId = "nasa-lander-frame"
) {
  const container = document.getElementById(containerId);
  const svg = document.getElementById(svgId);
  if (!container || !svg) return;

  const w = container.offsetWidth;
  const h = container.offsetHeight;
  if (!w || !h) return;

  const key = `${w}x${h}|${hasEarthLink ? 1 : 0}${hasSolarLight ? 1 : 0}`;
  if (svg.dataset.frameKey === key) return;            // nada cambió → no-op
  svg.dataset.frameKey = key;

  const midY = Math.round(h * 0.48);
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.innerHTML = DEFS
    + fuselage(w, h)
    + solarArray(PANEL_X, hasSolarLight)
    + dish(w - ANT_FROM_RIGHT, hasEarthLink)
    + thruster(0, midY, false)
    + thruster(w, midY, true)
    + engine(w, h)
    + legs(w, h, false)
    + legs(w, h, true);
}
