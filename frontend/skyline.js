// Skyline: x = azimut 0–360° (0=N horario), y = elevación. Dibuja la silueta del
// terreno h(az) y (en H2.3) los tracks de Sol/Tierra. Convención de azimut idéntica
// al backend. Módulo reusable: H3 lo monta como modal sobre el mapa.

const SVGNS = "http://www.w3.org/2000/svg";
const PAD = { t: 14, r: 14, b: 26, l: 34 };
const W = 760, H = 340;
const AZ_WIN_WIDTH = 120;   // ancho fijo de la ventana de azimut (§2.3), en grados
// Modo oscuro (cielo real): fondo navy, estrellas blancas, terreno negro silueteado.
// Tracks en variantes brillantes para que resalten sobre el cielo oscuro.
const SUN = "#fbbf24", EARTH = "#60a5fa";   // Sol ámbar / Tierra celeste (sobre oscuro)
const AZWIN = "#d946ef", AZWIN_EDGE = "#f0abfc";   // ventana de azimut (fucsia, §2.3)
const SKY_TOP = "#070b1c", SKY_HORIZON = "#141d3a";
const GROUND = "#05070f", RIM = "#5b6a86";
const GRID = "rgba(255,255,255,.07)", GRID_HORIZON = "rgba(148,163,184,.45)";
const AXIS_INK = "#8a97b2";

function el(tag, attrs = {}) {
  const n = document.createElementNS(SVGNS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  return n;
}

// Estrellas deterministas (LCG con semilla fija): mismas posiciones en cada draw,
// no bailan al mover el slider. Se generan una vez por instancia.
function makeStars(n) {
  let s = 0x2545f491;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const stars = [];
  for (let i = 0; i < n; i++) {
    stars.push({
      x: PAD.l + rnd() * (W - PAD.l - PAD.r),
      y: PAD.t + rnd() * (H - PAD.t - PAD.b),
      r: 0.4 + rnd() * 1.0,
      o: 0.35 + rnd() * 0.6,
    });
  }
  return stars;
}

function niceStep(rough) {
  for (const s of [1, 2, 5, 10, 15, 30, 45]) if (rough <= s) return s;
  return 90;
}

export function createSkyline(svg, { onWindowChange } = {}) {
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.style.cursor = "ew-resize";   // afforda "arrastrable en horizontal"
  svg.style.touchAction = "none";   // el drag no scrollea en touch
  const stars = makeStars(90);
  const st = {
    mask: [], sun: [], earth: [], fullSky: false, commsMargin: 0, azWindow: null,
    cursor: null,
  };

  // Cielo oscuro + estrellas de fondo. El terreno (opaco) se dibuja después y tapa
  // las estrellas que caen "bajo el horizonte", así solo brillan en el cielo.
  function drawSky(y, [lo, hi]) {
    const defs = el("defs");
    const grad = el("linearGradient", { id: "sky-grad", x1: 0, y1: 0, x2: 0, y2: 1 });
    grad.appendChild(el("stop", { offset: 0, "stop-color": SKY_TOP }));
    grad.appendChild(el("stop", { offset: 1, "stop-color": SKY_HORIZON }));
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(el("rect", { x: 0, y: 0, width: W, height: H, rx: 10,
      fill: "url(#sky-grad)" }));
    for (const s of stars) {
      svg.appendChild(el("circle", { cx: s.x, cy: s.y, r: s.r,
        fill: "#fff", opacity: s.o }));
    }
  }

  function setMask(mask) { st.mask = mask || []; }
  function setTracks(sun, earth) { st.sun = sun || []; st.earth = earth || []; }
  function setFullSky(b) { st.fullSky = !!b; }
  function setCursor(i) { st.cursor = i; }   // índice del instante actual (slider)
  function setParams({ commsMargin } = {}) {
    if (commsMargin != null) st.commsMargin = commsMargin;
  }
  function setAzimuthWindow(win) { st.azWindow = win || null; }

  // Ventana de azimut arrastrable (el "recuadro" del skyline, §2.3): ancho fijo,
  // el centro sigue al puntero. Emite onWindowChange para sincronizar el cono del mapa.
  const normAz = (a) => ((a % 360) + 360) % 360;
  function azAtClientX(clientX) {
    const r = svg.getBoundingClientRect();
    const xs = ((clientX - r.left) / r.width) * W;           // px → unidades viewBox
    const az = ((xs - PAD.l) / (W - PAD.l - PAD.r)) * 360;
    return Math.max(0, Math.min(360, az));
  }
  function centerWindow(c) {
    const half = AZ_WIN_WIDTH / 2;
    st.azWindow = { desde: normAz(c - half), hasta: normAz(c + half) };
    draw();
    if (onWindowChange) onWindowChange(st.azWindow);
  }
  let dragging = false;
  svg.addEventListener("pointerdown", (e) => {
    dragging = true;
    svg.setPointerCapture(e.pointerId);
    centerWindow(azAtClientX(e.clientX));
  });
  svg.addEventListener("pointermove", (e) => {
    if (dragging) centerWindow(azAtClientX(e.clientX));
  });
  const endDrag = () => { dragging = false; };
  svg.addEventListener("pointerup", endDrag);
  svg.addEventListener("pointercancel", endDrag);

  // Rango vertical dinámico (piso ~5°) o cielo completo (0–90°).
  function range() {
    if (st.fullSky) return [0, 90];
    const hs = st.mask.map((m) => m.h_deg);
    const els = [...st.sun, ...st.earth].map((p) => p.el);
    const hi = Math.max(5, Math.ceil(Math.max(0, ...hs, ...els) + 1));
    const lo = Math.min(-2, Math.floor(Math.min(0, ...hs, ...els)));
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
        stroke: GRID, "stroke-width": 1,
      }));
      const t = el("text", {
        x: x(az), y: H - PAD.b + 16, "text-anchor": "middle",
        "font-size": 11, fill: AXIS_INK, "font-family": "JetBrains Mono, monospace",
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
        stroke: horizon ? GRID_HORIZON : GRID,
        "stroke-width": horizon ? 1.5 : 1,
      }));
      const t = el("text", {
        x: PAD.l - 5, y: y(e) + 3, "text-anchor": "end",
        "font-size": 10, fill: AXIS_INK, "font-family": "JetBrains Mono, monospace",
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
    svg.appendChild(el("path", { d, fill: GROUND, stroke: "none" }));
    // borde superior del terreno: fina línea "iluminada" (rim) para silueta nítida
    svg.appendChild(el("polyline", {
      points: pts.join(" "), fill: "none", stroke: RIM, "stroke-width": 1.5,
    }));
  }

  // Recuadro translúcido de la ventana de azimut (§2.3). Si envuelve el Norte
  // (desde > hasta) se dibuja en dos tramos. Bordes marcados = agarradera visual.
  function drawAzWindow() {
    if (!st.azWindow) return;
    const { desde, hasta } = st.azWindow;
    const bands = desde <= hasta ? [[desde, hasta]] : [[desde, 360], [0, hasta]];
    for (const [a0, a1] of bands) {
      svg.appendChild(el("rect", {
        x: x(a0), y: PAD.t, width: x(a1) - x(a0), height: H - PAD.b - PAD.t,
        fill: AZWIN, opacity: 0.13,
      }));
    }
    for (const a of [desde, hasta]) {
      svg.appendChild(el("line", {
        x1: x(a), y1: PAD.t, x2: x(a), y2: H - PAD.b,
        stroke: AZWIN_EDGE, "stroke-width": 1.5, opacity: 0.85,
      }));
    }
    drawAzHandle(normAz(desde + AZ_WIN_WIDTH / 2));   // agarradera en el centro
  }

  // Agarradera de la ventana: ojo (= dirección de visión) + dos flechitas que invitan
  // a deslizar. Pegada al borde superior, centrada en la ventana; se redibuja al mover.
  function drawAzHandle(center) {
    const hx = x(center), hy = PAD.t + 1;
    svg.appendChild(el("circle", { cx: hx, cy: hy, r: 10,
      fill: "#1a1030", stroke: AZWIN_EDGE, "stroke-width": 1.5 }));
    svg.appendChild(el("path", {    // almendra del ojo
      d: `M${hx - 6} ${hy} Q${hx} ${hy - 4} ${hx + 6} ${hy} Q${hx} ${hy + 4} ${hx - 6} ${hy} Z`,
      fill: "none", stroke: AZWIN_EDGE, "stroke-width": 1.3 }));
    svg.appendChild(el("circle", { cx: hx, cy: hy, r: 1.9, fill: AZWIN_EDGE }));  // pupila
    const chev = (dx, dir) => el("path", {   // flechita (chevron) hacia afuera
      d: `M${hx + dx - dir * 1.5} ${hy - 3} L${hx + dx + dir * 1.5} ${hy} ` +
         `L${hx + dx - dir * 1.5} ${hy + 3}`,
      fill: "none", stroke: AZWIN_EDGE, "stroke-width": 1.5,
      "stroke-linecap": "round", "stroke-linejoin": "round" });
    svg.appendChild(chev(-15, -1));   // ‹ izquierda
    svg.appendChild(chev(15, 1));     // › derecha
  }

  // Umbral de comms (h(az) + margen) punteado; solo visible si el margen > 0.
  function drawCommsMargin(y) {
    const m = st.commsMargin || 0;
    if (!st.mask.length || m <= 0) return;
    const pts = st.mask.map((s) => `${x(s.az)},${y(s.h_deg + m)}`);
    pts.push(`${x(360)},${y(st.mask[0].h_deg + m)}`);
    svg.appendChild(el("polyline", {
      points: pts.join(" "), fill: "none", stroke: "#93c5fd",
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
      // Clamp para que la etiqueta no se recorte en los bordes (no medimos ancho:
      // ~54px de medio-texto) y halo blanco para legibilidad sobre el terreno.
      const cx = Math.min(Math.max(x(mid.az), PAD.l + 54), W - PAD.r - 54);
      const t = el("text", {
        x: cx, y: y(mid.el) - 7, "text-anchor": "middle", "font-size": 10,
        fill: "#cbd5e1", stroke: GROUND, "stroke-width": 3, "paint-order": "stroke",
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
      const t = el("text", { x: gx + 18, y: gy + 3, "font-size": 10, fill: AXIS_INK });
      t.textContent = lbl;
      svg.appendChild(t);
    });
  }

  // Marcador del instante actual: relleno = visible, hueco = tapado.
  function drawCursor(y) {
    if (st.cursor == null) return;
    for (const [track, color] of [[st.earth, EARTH], [st.sun, SUN]]) {
      const p = track[st.cursor];
      if (!p) continue;
      svg.appendChild(el("circle", {
        cx: x(p.az), cy: y(p.el), r: 5,
        fill: p.visible ? color : SKY_HORIZON, stroke: color, "stroke-width": 2,
      }));
    }
  }

  function draw() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const r = range();
    const y = yFn(r);
    drawSky(y, r);
    drawAzWindow();
    drawGrid(y, r);
    drawTerrain(y, r);
    drawCommsMargin(y);
    drawTrack(y, st.earth, EARTH);
    drawTrack(y, st.sun, SUN);
    drawBlockedLabel(y);
    drawCursor(y);
    drawLegend();
  }

  return {
    setMask, setTracks, setFullSky, setParams, setAzimuthWindow, centerWindow,
    setCursor, draw,
  };
}
