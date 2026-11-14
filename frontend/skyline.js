// Skyline: x = azimut 0–360° (0=N horario), y = elevación. Dibuja la silueta del
// terreno h(az) y (en H2.3) los tracks de Sol/Tierra. Convención de azimut idéntica
// al backend. Módulo reusable: H3 lo monta como modal sobre el mapa.

const SVGNS = "http://www.w3.org/2000/svg";
const PAD = { t: 14, r: 14, b: 26, l: 34 };
const W = 760, H = 340;

function el(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

function niceStep(rough) {
  for (const s of [1, 2, 5, 10, 15, 30, 45]) if (rough <= s) return s;
  return 90;
}

export function createSkyline(svg) {
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const st = { mask: [], sun: [], earth: [], fullSky: false };

  function setMask(mask) { st.mask = mask || []; }
  function setTracks(sun, earth) { st.sun = sun || []; st.earth = earth || []; }
  function setFullSky(b) { st.fullSky = !!b; }

  // Rango vertical dinámico (piso ~5°) o cielo completo (0–90°).
  function range() {
    if (st.fullSky) return [0, 90];
    const hs = st.mask.map((m) => m.h_deg);
    const els = [...st.sun, ...st.earth].map((p) => p.el);
    const hi = Math.max(5, Math.ceil(Math.max(0, ...hs, ...els) + 1));
    const lo = Math.min(-2, Math.floor(Math.min(0, ...hs)));
    return [lo, hi];
  }

  const x = (az) => PAD.l + (az / 360) * (W - PAD.l - PAD.r);
  function yFn([lo, hi]) {
    return (e) => PAD.t + (hi - e) / (hi - lo) * (H - PAD.t - PAD.b);
  }

  function drawGrid(y, [lo, hi]) {
    // verticales N/E/S/O + etiquetas
    const dirs = [[0, "N"], [90, "E"], [180, "S"], [270, "O"], [360, "N"]];
    for (const [az, lbl] of dirs) {
      svg.appendChild(el("line", {
        x1: x(az), y1: PAD.t, x2: x(az), y2: H - PAD.b,
        stroke: "#e2e8f0", "stroke-width": 1,
      }));
      const t = el("text", {
        x: x(az), y: H - PAD.b + 16, "text-anchor": "middle",
        "font-size": 11, fill: "#64748b", "font-family": "JetBrains Mono, monospace",
      });
      t.textContent = lbl;
      svg.appendChild(t);
    }
    // horizontales de elevación
    const step = niceStep((hi - lo) / 5);
    for (let e = Math.ceil(lo / step) * step; e <= hi; e += step) {
      const horizon = e === 0;
      svg.appendChild(el("line", {
        x1: PAD.l, y1: y(e), x2: W - PAD.r, y2: y(e),
        stroke: horizon ? "#94a3b8" : "#f1f5f9",
        "stroke-width": horizon ? 1.5 : 1,
      }));
      const t = el("text", {
        x: PAD.l - 5, y: y(e) + 3, "text-anchor": "end",
        "font-size": 10, fill: "#94a3b8", "font-family": "JetBrains Mono, monospace",
      });
      t.textContent = `${e}°`;
      svg.appendChild(t);
    }
  }

  function drawTerrain(y, [lo]) {
    if (!st.mask.length) return;
    const pts = st.mask.map((m) => `${x(m.az)},${y(m.h_deg)}`);
    pts.push(`${x(360)},${y(st.mask[0].h_deg)}`); // cierre al wrap 360→0
    const base = y(lo);
    const d = `M ${PAD.l},${base} L ${pts.join(" L ")} L ${W - PAD.r},${base} Z`;
    svg.appendChild(el("path", { d, fill: "#cbd5e1", stroke: "none" }));
    // borde superior del terreno (línea nítida)
    svg.appendChild(el("polyline", {
      points: pts.join(" "), fill: "none", stroke: "#475569", "stroke-width": 1.5,
    }));
  }

  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const r = range();
    const y = yFn(r);
    drawGrid(y, r);
    drawTerrain(y, r);
    // H2.3: tracks de Sol/Tierra, margen de comms, ventana de azimut.
  }

  return { setMask, setTracks, setFullSky, draw };
}
