// moonFrame.js — hardware exterior del marco del mapa (ref. designReferences/lunaMap.html):
// "visor de placa orbital". El chasis grafito es CSS (.moon-frame en theme.css); acá se dibuja
// la capa SVG de piezas que asoman por fuera del borde: solapa de ficha, lente sobre riel,
// dial lateral, selector lateral, clips inferiores, luz piloto y puntitos estelares.
// Se dibuja en px reales del marco (no se deforma al cambiar de tamaño) y va DETRÁS de la
// tarjeta del mapa (z-index menor): nada tapa el mapa.

const NS = "http://www.w3.org/2000/svg";
const RED = "#e63946", GRAFITO = "#161a23";

function node(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}

function draw(svg, w, h) {
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.replaceChildren();
  const line = (p, x1, y1, x2, y2, stroke, sw, extra = {}) =>
    node("line", { x1, y1, x2, y2, stroke, "stroke-width": sw, "stroke-linecap": "round",
      ...extra }, p);

  // Puntitos estelares sutiles sobre el fondo, fuera del chasis.
  const dots = node("g", { fill: "#ffffff", opacity: 0.35 }, svg);
  [[w * 0.3, -20], [w + 20, h * 0.24], [-20, h * 0.62], [w * 0.7, h + 20]].forEach(
    ([x, y]) => node("circle", { cx: x, cy: y, r: 1.4 }, dots));

  // Rayitas rojas de estado, en la banda del chasis (esquinas superiores).
  line(svg, 24, 6, 36, 6, RED, 2);
  line(svg, w - 36, 6, w - 24, 6, RED, 2);

  // 1. Solapa de ficha (arriba izquierda) con indicador rojo y etiqueta.
  const tab = node("g", { transform: "translate(54, 0)" }, svg);
  node("path", { d: "M 0,0 L 8,-14 L 112,-14 L 120,0 Z", fill: GRAFITO, stroke: "#64748b",
    "stroke-width": 1.3, "stroke-linejoin": "round" }, tab);
  node("circle", { cx: 20, cy: -7, r: 2, fill: RED }, tab);
  const t = node("text", { x: 28, y: -4, fill: "#cbd5e1", "font-size": 8.5,
    "font-family": "JetBrains Mono, monospace", "font-weight": 700, "letter-spacing": 1 }, tab);
  t.textContent = "POLO SUR LUNAR";

  // 2. Lente de inspección sobre riel (arriba derecha).
  const rail = node("g", { transform: `translate(${w - 99}, 0)` }, svg);
  line(rail, -35, -5, 35, -5, "#475569", 1.4);
  node("circle", { cx: -35, cy: -5, r: 1.8, fill: "#64748b" }, rail);
  node("circle", { cx: 35, cy: -5, r: 1.8, fill: "#64748b" }, rail);
  const lens = node("g", { transform: "translate(8, -12)" }, rail);
  node("circle", { cx: 0, cy: 0, r: 11, fill: "#0b0e17", stroke: "#cbd5e1",
    "stroke-width": 1.4 }, lens);
  node("circle", { cx: 0, cy: 0, r: 7.5, fill: "none", stroke: "#475569",
    "stroke-width": 1 }, lens);
  node("path", { d: "M -4,-3 A 5,5 0 0,1 2,-5", fill: "none", stroke: "#ffffff",
    "stroke-width": 1.2, "stroke-linecap": "round", opacity: 0.7 }, lens);
  line(lens, 0, 11, 0, 14, RED, 2, { "stroke-linecap": "butt" });

  // 3. Dial moleteado (flanco derecho, centrado).
  const dial = node("g", { transform: `translate(${w}, ${h / 2})` }, svg);
  node("rect", { x: 0, y: -26, width: 11, height: 52, rx: 3, fill: "#1e2433",
    stroke: "#94a3b8", "stroke-width": 1.3 }, dial);
  [-18, -12, -6, 0, 6, 12, 18].forEach((y) =>
    line(dial, 2, y, 9, y, y === 0 ? RED : "#64748b", y === 0 ? 1.6 : 1.2));

  // 4. Selector lateral (flanco izquierdo, centrado).
  const sw = node("g", { transform: `translate(0, ${h / 2})` }, svg);
  node("rect", { x: -8, y: -16, width: 8, height: 32, rx: 2.5, fill: GRAFITO,
    stroke: "#64748b", "stroke-width": 1.2 }, sw);
  node("circle", { cx: -4, cy: -7, r: 2, fill: RED }, sw);
  node("circle", { cx: -4, cy: 7, r: 2, fill: "#475569" }, sw);

  // 5. Base: clips de sujeción (izq/der) y luz piloto central.
  [81, w - 81].forEach((x) => {
    const c = node("g", { transform: `translate(${x}, ${h})` }, svg);
    node("path", { d: "M -18,0 L -14,9 L 14,9 L 18,0", fill: GRAFITO, stroke: "#64748b",
      "stroke-width": 1.3, "stroke-linejoin": "round" }, c);
    line(c, -8, 4.5, 8, 4.5, "#94a3b8", 1.2, { "stroke-linecap": "butt" });
  });
  const pilot = node("g", { transform: `translate(${w / 2}, ${h})` }, svg);
  node("rect", { x: -16, y: 0, width: 32, height: 7, rx: 2, fill: GRAFITO, stroke: "#475569",
    "stroke-width": 1.2 }, pilot);
  line(pilot, -8, 3.5, 8, 3.5, RED, 1.8);
}

// Monta el hardware dentro de `frame` (el contenedor .moon-frame) y lo mantiene al tamaño.
export function mountMoonFrame(frame) {
  if (!frame) return;
  const svg = node("svg", { class: "moon-frame__hw", "aria-hidden": "true" });
  frame.prepend(svg);
  const redraw = () => {
    const w = Math.round(frame.offsetWidth), h = Math.round(frame.offsetHeight);
    if (w && h) draw(svg, w, h);
  };
  redraw();
  if ("ResizeObserver" in window) new ResizeObserver(redraw).observe(frame);
  else window.addEventListener("resize", redraw);
}
