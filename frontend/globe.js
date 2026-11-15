// globe.js — globo-localizador: esfera ortográfica SVG "esqueleto/transparente" con el
// casquete sur coloreado arriba, inclinada hacia el observador. Comunica que el disco del
// mapa es la tapa del polo sur vista a pico (no todo el hemisferio). Sin 3D real:
// proyectamos puntos de la esfera a mano. Lo usan el mapa (sobre fondo oscuro) y la
// bienvenida (sobre blanco); lo único que cambia entre ambos es la paleta.

const NS = "http://www.w3.org/2000/svg";
function svg(tag, attrs) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

// Paletas: limb/capa/grilla/polo/rótulos. `front`/`back` = opacidad de la grilla.
export const GLOBE_DARK = { limbFill: "rgba(255,255,255,.05)", limbStroke: "rgba(255,255,255,.5)",
  grid: "#cfe0ff", front: 0.38, back: 0.12, capFill: "rgba(96,165,250,.4)", capStroke: "#60a5fa",
  pole: "#fff", label: "#cbd5e1", arrow: "#ff5a64" };
export const GLOBE_LIGHT = { limbFill: "rgba(0,50,160,.04)", limbStroke: "rgba(0,50,160,.55)",
  grid: "#0032A0", front: 0.32, back: 0.1, capFill: "rgba(0,50,160,.16)", capStroke: "#0032A0",
  pole: "#E03C31", label: "#0032A0" };

// Proyección ortográfica de (lat,lon) con el eje polar inclinado para que el polo SUR
// quede arriba y de cara al observador. Devuelve coords en la unidad-esfera (x der, y
// abajo como SVG) y profundidad (depth>0 = cara frontal).
function globePt(latDeg, lonDeg, tilt) {
  const la = (latDeg * Math.PI) / 180, lo = (lonDeg * Math.PI) / 180;
  const t = ((90 + tilt) * Math.PI) / 180;          // >90° ⇒ polo sur arriba y frontal
  const x = Math.cos(la) * Math.sin(lo);
  const y = Math.cos(la) * Math.cos(lo);
  const z = Math.sin(la);
  const y2 = y * Math.cos(t) - z * Math.sin(t);
  const z2 = y * Math.sin(t) + z * Math.cos(t);
  return { x, y: -y2, depth: z2 };
}

// Dibuja el globo dentro del <g>/<svg> `g`. geo = { cx, cy, r, tilt, cap }.
// opts.arrow: flecha trazo-marcador (sharpie), apenas curva, que apunta a la S (solo mapa).
export function drawGlobe(g, { cx, cy, r, tilt = 28, cap = 18 }, pal, { arrow = false } = {}) {
  const P = (la, lo) => globePt(la, lo, tilt);
  const sx = (p) => cx + r * p.x, sy = (p) => cy + r * p.y;
  const poly = (pts) =>
    pts.map((p, i) => `${i ? "L" : "M"}${sx(p).toFixed(1)} ${sy(p).toFixed(1)}`).join("");
  // Limbo de la esfera (vidrio): relleno casi nulo + borde tenue ⇒ look esquelético.
  g.appendChild(svg("circle", { cx, cy, r, fill: pal.limbFill, stroke: pal.limbStroke,
    "stroke-width": 1.5 }));
  // Una curva se parte en tramos frontales (nítidos) y traseros (tenues): transparencia.
  const curve = (pts) => {
    let run = [], front = pts[0].depth > 0;
    const flush = () => { if (run.length > 1) g.appendChild(svg("path", { d: poly(run),
      fill: "none", stroke: pal.grid, "stroke-width": 1,
      "stroke-opacity": front ? pal.front : pal.back })); };
    for (const p of pts) {
      const f = p.depth > 0;
      if (f !== front) { flush(); run = run.length ? [run[run.length - 1]] : []; front = f; }
      run.push(p);
    }
    flush();
  };
  const sample = (fn) => { const a = []; for (let k = 0; k <= 36; k++) a.push(fn(k)); return a; };
  for (let lon = 0; lon < 360; lon += 45)                       // meridianos
    curve(sample((k) => P(-90 + (k * 180) / 36, lon)));
  for (let lat = -60; lat <= 60; lat += 30)                     // paralelos
    curve(sample((k) => P(lat, (k * 360) / 36)));
  // Casquete sur: borde del paralelo a `cap`° del polo, cerrado y relleno (la tapa).
  const capPts = sample((k) => P(-(90 - cap), (k * 360) / 36));
  g.appendChild(svg("path", { d: `${poly(capPts)}Z`, fill: pal.capFill,
    stroke: pal.capStroke, "stroke-opacity": 0.95, "stroke-width": 1.5 }));
  const pole = P(-90, 0);
  g.appendChild(svg("circle", { cx: sx(pole), cy: sy(pole), r: 2.5, fill: pal.pole }));
  // Polos rotulados: S arriba (de cara, casquete) y N abajo (oculto, tenue). Deja claro
  // que la vista está "dada vuelta" respecto de la convención humana (N arriba).
  const lbl = (txt, y, op) => {
    const e = svg("text", { x: cx, y, fill: pal.label, "fill-opacity": op,
      "font-size": 18, "font-weight": 700, "text-anchor": "middle",
      "font-family": "JetBrains Mono" });
    e.textContent = txt;
    g.appendChild(e);
  };
  lbl("S", cy - r - 9, 0.95);
  lbl("N", cy + r + 22, 0.5);
  if (!arrow) return;
  // Flecha a mano alzada: un trazo grueso y redondeado, con una curva suave, que baja hacia
  // la S. La curva llega VERTICAL (el punto de control está justo arriba de la punta), así la
  // cabeza apunta de frente a la S; sus dos trazos tienen leve asimetría (no se ve perfecta).
  const x0 = cx - 25, y0 = cy - r - 72;           // inicio (arriba, a la izquierda)
  const x1 = cx, y1 = cy - r - 28;                // punta, centrada sobre la S
  const qx = cx + 1, qy = cy - r - 58;            // control: tangente final vertical
  const dir = Math.atan2(y1 - qy, x1 - qx);       // = hacia abajo
  const wing = (ang, len) => `M${x1} ${y1} L${(x1 - len * Math.cos(dir + ang)).toFixed(1)} ` +
    `${(y1 - len * Math.sin(dir + ang)).toFixed(1)}`;
  const d = `M${x0} ${y0} Q${qx} ${qy} ${x1} ${y1}` + wing(0.58, 13) + wing(-0.5, 12);
  const ink = pal.arrow || pal.label;
  // Halo oscuro debajo (separa la flecha de la textura de la luna) y el trazo encima.
  g.appendChild(svg("path", { d, fill: "none", stroke: "#0b1124", "stroke-opacity": 0.65,
    "stroke-width": 6.4, "stroke-linecap": "round", "stroke-linejoin": "round" }));
  g.appendChild(svg("path", { d, fill: "none", stroke: ink, "stroke-width": 3.6,
    "stroke-linecap": "round", "stroke-linejoin": "round" }));
}
