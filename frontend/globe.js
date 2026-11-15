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
  pole: "#fff", label: "#cbd5e1" };
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
// opts.eye: ícono de perspectiva (ojo de perfil) sobre la S (solo en el mapa).
export function drawGlobe(g, { cx, cy, r, tilt = 28, cap = 18 }, pal, { eye = false } = {}) {
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
  if (!eye) return;
  // Ícono de perspectiva (ojo de perfil) sobre la S: dos trazos que se cruzan arriba
  // (la mira) + base curva. Sin relleno, solo contorno.
  const yT = cy - r - 60, yB = cy - r - 30, hw = 15, tl = 6;
  const d =
    `M${cx - hw} ${yB} L${cx + tl} ${yT}` +                 // abajo-izq → arriba-der
    `M${cx + hw} ${yB} L${cx - tl} ${yT}` +                 // abajo-der → arriba-izq (cruzan)
    `M${cx - hw} ${yB} Q${cx} ${yB + 5} ${cx + hw} ${yB}`;  // base curva
  g.appendChild(svg("path", { d, fill: "none", stroke: pal.label, "stroke-opacity": 0.95,
    "stroke-width": 1.6, "stroke-linecap": "round", "stroke-linejoin": "round" }));
}
