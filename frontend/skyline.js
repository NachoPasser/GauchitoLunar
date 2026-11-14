// Skyline: x = azimut 0–360° (0=N horario), y = elevación. Dibuja la silueta del
// terreno h(az) y (en H2.3) los tracks de Sol/Tierra. Convención de azimut idéntica
// al backend. Módulo reusable: H3 lo monta como modal sobre el mapa.

const SVGNS = "http://www.w3.org/2000/svg";
const PAD = { t: 14, r: 14, b: 26, l: 34 };
const W = 760, H = 340;
const SUN = "#f59e0b", EARTH = "#2563eb";   // ámbar / azul

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
  const st = {
    mask: [], sun: [], earth: [], fullSky: false, commsMargin: 0, azWindow: null,
  };

  function setMask(mask) { st.mask = mask || []; }
  function setTracks(sun, earth) { st.sun = sun || []; st.earth = earth || []; }
  function setFullSky(b) { st.fullSky = !!b; }
  function setParams({ commsMargin } = {}) {
    if (commsMargin != null) st.commsMargin = commsMargin;
  }
  function setAzimuthWindow(win) { st.azWindow = win || null; }

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

  // Banda translúcida de la ventana de azimut (secundaria, §2.3).
  function drawAzWindow(y) {
    if (!st.azWindow) return;
    const [a0, a1] = st.azWindow;
    svg.appendChild(el("rect", {
      x: x(a0), y: PAD.t, width: x(a1) - x(a0), height: H - PAD.b - PAD.t,
      fill: "#3b82f6", opacity: 0.08,
    }));
  }

  // Umbral de comms (h(az) + margen) punteado; solo visible si el margen > 0.
  function drawCommsMargin(y) {
    const m = st.commsMargin || 0;
    if (!st.mask.length || m <= 0) return;
    const pts = st.mask.map((s) => `${x(s.az)},${y(s.h_deg + m)}`);
    pts.push(`${x(360)},${y(st.mask[0].h_deg + m)}`);
    svg.appendChild(el("polyline", {
      points: pts.join(" "), fill: "none", stroke: "#1d4ed8",
      "stroke-width": 1, "stroke-dasharray": "2 3", opacity: 0.6,
    }));
  }

  // Parte un track en subtramos por wrap de azimut y por cambio de visibilidad.
  function segments(track) {
    const segs = [];
    let cur = null;
    for (let i = 0; i < track.length; i++) {
      const p = track[i], prev = track[i - 1];
      const wrap = prev && Math.abs(p.az - prev.az) > 180;
      if (!cur || wrap || p.visible !== cur.visible) {
        cur = { visible: p.visible, pts: [] };
        if (prev && !wrap) cur.pts.push(prev);   // puente para no dejar huecos
        segs.push(cur);
      }
      cur.pts.push(p);
    }
    return segs;
  }

  // Track: brillante = visible, punteado apagado = tapado por el terreno.
  function drawTrack(y, track, color) {
    for (const seg of segments(track)) {
      if (seg.pts.length < 2) {
        const p = seg.pts[0];
        svg.appendChild(el("circle", {
          cx: x(p.az), cy: y(p.el), r: 1.6, stroke: color, "stroke-width": 1,
          fill: seg.visible ? color : "none", opacity: seg.visible ? 1 : 0.4,
        }));
        continue;
      }
      const attrs = {
        points: seg.pts.map((p) => `${x(p.az)},${y(p.el)}`).join(" "),
        fill: "none", stroke: color,
        "stroke-width": seg.visible ? 2.2 : 1.4, opacity: seg.visible ? 1 : 0.4,
      };
      if (!seg.visible) attrs["stroke-dasharray"] = "3 4";
      svg.appendChild(el("polyline", attrs));
    }
  }

  // Etiqueta "tapado por el terreno" sobre el primer tramo bloqueado.
  function drawBlockedLabel(y) {
    for (const track of [st.earth, st.sun]) {
      const seg = segments(track).find((s) => !s.visible && s.pts.length > 2);
      if (!seg) continue;
      const mid = seg.pts[Math.floor(seg.pts.length / 2)];
      const t = el("text", {
        x: x(mid.az), y: y(mid.el) - 6, "text-anchor": "middle",
        "font-size": 9, fill: "#64748b",
      });
      t.textContent = "tapado por el terreno";
      svg.appendChild(t);
      return;
    }
  }

  function drawLegend() {
    [["Sol", SUN], ["Tierra", EARTH]].forEach(([lbl, c], i) => {
      const gx = W - PAD.r - 118 + i * 62, gy = PAD.t + 8;
      svg.appendChild(el("line", {
        x1: gx, y1: gy, x2: gx + 14, y2: gy, stroke: c, "stroke-width": 2.5,
      }));
      const t = el("text", { x: gx + 18, y: gy + 3, "font-size": 10, fill: "#475569" });
      t.textContent = lbl;
      svg.appendChild(t);
    });
  }

  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const r = range();
    const y = yFn(r);
    drawAzWindow(y);
    drawGrid(y, r);
    drawTerrain(y, r);
    drawCommsMargin(y);
    drawTrack(y, st.earth, EARTH);
    drawTrack(y, st.sun, SUN);
    drawBlockedLabel(y);
    drawLegend();
  }

  return { setMask, setTracks, setFullSky, setParams, setAzimuthWindow, draw };
}
