// =========================================================
// 1. DATOS DE EJEMPLO PARA 3 SITIOS DEL POLO SUR LUNAR
// =========================================================
// Cada sitio tiene 30 días de cobertura (array de 30 valores: 1 = activo, 0 = oculto)
const SITES_DATA = {
  shackleton: {
    id: 'shackleton',
    code: 'A-04',
    title: 'Borde Cráter Shackleton',
    coords: '89.54° S, 129.78° E // ALT: +1,840 m // SECTOR POLAR SUR',
    slope: '6.4°',
    slopeSafe: true,
    psrDistance: '380 m',
    baseEarthAzimuth: '014° NNE',
    // 30 días: 24 días de luz, 6 días de sombra, buena visibilidad de Tierra
    solarDays: [
      1,1,1,1,1,1,1,1,1,1,
      1,1,1,0,0,0,0,0,0,1,
      1,1,1,1,1,1,1,1,1,1
    ],
    earthDays: [
      1,1,1,1,1,1,1,1,1,1,
      1,1,0,0,0,0,0,1,1,1,
      1,1,1,1,1,1,1,1,1,1
    ]
  },
  malapert: {
    id: 'malapert',
    code: 'B-11',
    title: 'Macizo Malapert (Cresta Norte)',
    coords: '85.98° S, 002.40° E // ALT: +4,920 m // PICO DE COMUNICACIÓN',
    slope: '11.8°',
    slopeSafe: false, // Pendiente exigente (>10°)
    psrDistance: '1,420 m',
    baseEarthAzimuth: '358° N',
    // 30 días: comunicación casi permanente, ciclos de luz más alternados
    solarDays: [
      1,1,1,1,1,1,1,1,0,0,
      0,0,0,0,0,0,0,1,1,1,
      1,1,1,1,1,1,1,1,1,0
    ],
    earthDays: [
      1,1,1,1,1,1,1,1,1,1,
      1,1,1,1,1,1,1,1,1,1,
      1,1,1,1,1,0,0,1,1,1
    ]
  },
  cabeus: {
    id: 'cabeus',
    code: 'C-02',
    title: 'Interior Cráter Cabeus (PSR)',
    coords: '84.90° S, 324.50° E // ALT: -2,150 m // ZONA DE HIELO PERMANENTE',
    slope: '4.1°',
    slopeSafe: true,
    psrDistance: '0 m (DENTRO)',
    baseEarthAzimuth: '006° N',
    // 30 días: sin luz solar directa (PSR), solo breves ventanas rasantes de Tierra
    solarDays: [
      0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0,
      0,0,0,0,0,0,0,0,0,0
    ],
    earthDays: [
      0,0,0,1,1,1,1,0,0,0,
      0,0,0,0,0,0,0,1,1,1,
      1,1,0,0,0,0,0,0,0,0
    ]
  }
};

let activeSiteKey = 'shackleton';
let currentHourOffset = 120; // Hora dentro de las 720h (30 días)
const MISSION_START_UTC = Date.UTC(2026, 10, 20, 0, 0, 0); // 20 Nov 2026 00:00 UTC

// =========================================================
// 2. ACTUALIZACIÓN DINÁMICA DE LA FICHA DE TELEMETRÍA
// =========================================================
const timeSlider = document.getElementById('mission-time-slider');
const timelineNeedle = document.getElementById('timeline-needle');
const solarTrack = document.getElementById('solar-timeline-track');
const earthTrack = document.getElementById('earth-timeline-track');

function renderTimelineTracks(site) {
  solarTrack.innerHTML = '';
  earthTrack.innerHTML = '';

  for (let d = 0; d < 30; d++) {
    const sBlock = document.createElement('div');
    sBlock.className = `flex-1 h-full ${site.solarDays[d] ? 'bg-amber-400' : 'bg-slate-200'}`;
    solarTrack.appendChild(sBlock);

    const eBlock = document.createElement('div');
    eBlock.className = `flex-1 h-full ${site.earthDays[d] ? 'bg-[#0032A0]' : 'bg-slate-200'}`;
    earthTrack.appendChild(eBlock);
  }
}

function computeNextTransition(daysArray, currentDayIndex, currentHourInDay) {
  const currentState = daysArray[currentDayIndex];
  let hoursRemaining = 24 - currentHourInDay;

  for (let d = currentDayIndex + 1; d < daysArray.length; d++) {
    if (daysArray[d] === currentState) {
      hoursRemaining += 24;
    } else {
      const days = Math.floor(hoursRemaining / 24);
      const hrs = hoursRemaining % 24;
      return `${days}d ${hrs}h`;
    }
  }
  return 'Fin de ventana (>30d)';
}

function updateTelemetryReadout() {
  const site = SITES_DATA[activeSiteKey];
  const dayIndex = Math.min(29, Math.floor(currentHourOffset / 24));
  const hourInDay = currentHourOffset % 24;

  // 1. Fecha y hora exacta
  const evalDate = new Date(MISSION_START_UTC + currentHourOffset * 3600 * 1000);
  const dateStr = evalDate.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  }).toUpperCase();
  const timeStr = String(evalDate.getUTCHours()).padStart(2, '0') + ':00 UTC';

  document.getElementById('current-timestamp').textContent = `${dateStr} — ${timeStr}`;
  document.getElementById('day-counter-label').textContent = `DÍA ${String(dayIndex + 1).padStart(2, '0')} / 30`;

  // Posición de la aguja roja en el timeline (0% a 100%)
  const pct = (currentHourOffset / 720) * 100;
  timelineNeedle.style.left = `${pct}%`;

  // 2. Datos estáticos del sitio
  document.getElementById('site-title').textContent = site.title;
  document.getElementById('site-coords').textContent = site.coords;
  document.getElementById('terrain-slope').textContent = site.slope;
  document.getElementById('terrain-psr').textContent = site.psrDistance;

  const slopeNote = document.getElementById('terrain-slope-note');
  if (site.slopeSafe) {
    slopeNote.textContent = 'SEGURA';
    slopeNote.className = 'font-["JetBrains_Mono"] text-[9px] text-emerald-700 font-semibold';
  } else {
    slopeNote.textContent = 'EXIGENTE';
    slopeNote.className = 'font-["JetBrains_Mono"] text-[9px] text-amber-700 font-semibold';
  }

  // 3. Estado Solar en este instante
  const hasSun = site.solarDays[dayIndex] === 1;
  const solarStatusTag = document.getElementById('solar-status-tag');
  const solarWatts = document.getElementById('solar-watts');
  const solarEff = document.getElementById('solar-efficiency');
  const solarBar = document.getElementById('solar-bar');
  const solarAngles = document.getElementById('solar-angles');
  const solarNext = document.getElementById('solar-next-change');
  const terrainTemp = document.getElementById('terrain-temp');
  const terrainTempNote = document.getElementById('terrain-temp-note');

  const azimut = Math.round((currentHourOffset * 0.508) % 360); // Giro solar ~360° en 29.5 días

  if (hasSun) {
    const sunElev = (0.6 + Math.sin(dayIndex * 0.3) * 0.6).toFixed(1);
    const watts = Math.round(1120 + Math.sin(dayIndex * 0.3) * 140);
    const eff = Math.round((watts / 1361) * 100);

    solarStatusTag.textContent = 'SOL DIRECTO';
    solarStatusTag.className = 'font-["JetBrains_Mono"] text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800';
    solarWatts.textContent = watts.toLocaleString('es-AR');
    solarEff.textContent = `${eff}% CAP.`;
    solarBar.style.width = `${eff}%`;
    solarBar.className = 'h-full bg-[#0032A0] transition-all duration-300';
    solarAngles.textContent = `+${sunElev}° / ${String(azimut).padStart(3, '0')}°`;
    solarNext.textContent = `Sombra en ${computeNextTransition(site.solarDays, dayIndex, hourInDay)}`;

    terrainTemp.textContent = '-42 °C';
    terrainTempNote.textContent = 'NOMINAL';
    terrainTempNote.className = 'font-["JetBrains_Mono"] text-[9px] text-slate-500';
  } else {
    solarStatusTag.textContent = 'EN SOMBRA';
    solarStatusTag.className = 'font-["JetBrains_Mono"] text-[10px] font-bold px-2 py-0.5 rounded bg-slate-200 text-slate-700';
    solarWatts.textContent = '0';
    solarEff.textContent = '0% CAP.';
    solarBar.style.width = '0%';
    solarAngles.textContent = `-1.1° / ${String(azimut).padStart(3, '0')}°`;
    solarNext.textContent = site.id === 'cabeus'
      ? 'Sombra permanente'
      : `Luz en ${computeNextTransition(site.solarDays, dayIndex, hourInDay)}`;

    terrainTemp.textContent = '-214 °C';
    terrainTempNote.textContent = 'CRIOGÉNICA';
    terrainTempNote.className = 'font-["JetBrains_Mono"] text-[9px] text-[#E03C31] font-semibold';
  }

  // 4. Estado Visibilidad de la Tierra en este instante
  const hasEarth = site.earthDays[dayIndex] === 1;
  const earthStatusTag = document.getElementById('earth-status-tag');
  const earthElevation = document.getElementById('earth-elevation');
  const earthSignal = document.getElementById('earth-signal');
  const earthBar = document.getElementById('earth-bar');
  const earthAngles = document.getElementById('earth-angles');
  const earthNext = document.getElementById('earth-next-change');

  if (hasEarth) {
    const eElev = (3.4 + Math.cos(dayIndex * 0.25) * 1.8).toFixed(1);
    const barPct = Math.min(100, Math.round((Number(eElev) / 6.5) * 100));

    earthStatusTag.textContent = 'ENLACE DIRECTO';
    earthStatusTag.className = 'font-["JetBrains_Mono"] text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800';
    earthElevation.textContent = `+${eElev}°`;
    earthSignal.textContent = 'LOS ACTIVO';
    earthBar.style.width = `${barPct}%`;
    earthBar.className = 'h-full bg-[#0032A0] transition-all duration-300';
    earthAngles.textContent = `${site.baseEarthAzimuth} / 1.28s`;
    earthNext.textContent = `${computeNextTransition(site.earthDays, dayIndex, hourInDay)} activos`;
  } else {
    earthStatusTag.textContent = 'OCULTO';
    earthStatusTag.className = 'font-["JetBrains_Mono"] text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-[#E03C31]';
    earthElevation.textContent = '-1.8°';
    earthSignal.textContent = 'SIN SEÑAL';
    earthBar.style.width = '0%';
    earthAngles.textContent = `${site.baseEarthAzimuth} / —`;
    earthNext.textContent = `Señal en ${computeNextTransition(site.earthDays, dayIndex, hourInDay)}`;
  }

  // 5. Semáforo Global (Veredicto)
  const verdictBadge = document.getElementById('mission-verdict-badge');
  const verdictDot = document.getElementById('verdict-dot');
  const verdictText = document.getElementById('verdict-text');

  if (hasSun && hasEarth) {
    verdictBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-emerald-300 bg-emerald-50 text-emerald-800 font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider';
    verdictDot.className = 'w-2 h-2 rounded-full bg-emerald-500';
    verdictText.textContent = 'VIABLE // ÓPTIMO';
  } else if (hasSun || hasEarth) {
    verdictBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-amber-300 bg-amber-50 text-amber-800 font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider';
    verdictDot.className = 'w-2 h-2 rounded-full bg-amber-500';
    verdictText.textContent = 'RESTRINGIDO // PARCIAL';
  } else {
    verdictBadge.className = 'flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-[#E03C31]/40 bg-[#E03C31]/10 text-[#E03C31] font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider';
    verdictDot.className = 'w-2 h-2 rounded-full bg-[#E03C31]';
    verdictText.textContent = 'CRÍTICO // SIN LUZ NI ENLACE';
  }
}

// =========================================================
// 3. EVENTOS DE INTERACCIÓN
// =========================================================
document.querySelectorAll('.site-pill').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeSiteKey = btn.dataset.site;

    document.querySelectorAll('.site-pill').forEach((pill) => {
      if (pill.dataset.site === activeSiteKey) {
        pill.className = 'site-pill cursor-pointer px-2.5 py-1 rounded font-["JetBrains_Mono"] text-[10px] font-semibold transition-colors bg-[#0032A0] text-white';
      } else {
        pill.className = 'site-pill cursor-pointer px-2.5 py-1 rounded font-["JetBrains_Mono"] text-[10px] font-semibold transition-colors bg-slate-100 text-slate-600 hover:text-[#0032A0]';
      }
    });

    document.getElementById('save-toast').classList.add('hidden');
    renderTimelineTracks(SITES_DATA[activeSiteKey]);
    updateTelemetryReadout();
  });
});

timeSlider.addEventListener('input', (e) => {
  currentHourOffset = Number(e.target.value);
  updateTelemetryReadout();
});

document.getElementById('step-back-btn').addEventListener('click', () => {
  currentHourOffset = Math.max(0, currentHourOffset - 6);
  timeSlider.value = currentHourOffset;
  updateTelemetryReadout();
});

document.getElementById('step-fwd-btn').addEventListener('click', () => {
  currentHourOffset = Math.min(720, currentHourOffset + 6);
  timeSlider.value = currentHourOffset;
  updateTelemetryReadout();
});

document.getElementById('save-site-btn').addEventListener('click', () => {
  const toast = document.getElementById('save-toast');
  toast.classList.remove('hidden');
});

document.getElementById('back-to-map-btn').addEventListener('click', () => {
  alert('Aquí volverías a la vista del mapa lunar para seleccionar otro punto.');
});

// =========================================================
// 4. DIBUJO DEL BORDE NASA (#0032A0 + ESTRELLAS + VECTOR ROJO)
// =========================================================
function renderNasaBorderDetails() {
  const container = document.getElementById('nasa-framed-block');
  const svg = document.getElementById('nasa-border-stars');
  if (!container || !svg) return;

  const rect = container.getBoundingClientRect();
  const w = Math.round(rect.width);
  const h = Math.round(rect.height);
  if (w === 0 || h === 0) return;

  const borderThickness = window.innerWidth >= 640 ? 24 : 18;

  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.innerHTML = '';

  const ns = 'http://www.w3.org/2000/svg';

  const defs = document.createElementNS(ns, 'defs');
  const starPath = document.createElementNS(ns, 'path');
  starPath.setAttribute('id', 'nasa-4pt-star');
  starPath.setAttribute(
    'd',
    'M 0 -11 C 0.6 -2.2 2.2 -0.6 11 0 C 2.2 0.6 0.6 2.2 0 11 C -0.6 2.2 -2.2 0.6 -11 0 C -2.2 -0.6 -0.6 -2.2 0 -11 Z'
  );
  starPath.setAttribute('fill', '#FFFFFF');
  starPath.setAttribute('stroke', '#0032A0');
  starPath.setAttribute('stroke-width', '1.45');
  starPath.setAttribute('stroke-linejoin', 'miter');
  starPath.setAttribute('stroke-miterlimit', '6');
  starPath.setAttribute('vector-effect', 'non-scaling-stroke');
  defs.appendChild(starPath);
  svg.appendChild(defs);

  let seed = 42;
  function rand() {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  }

  function randomPointInBorder(margin = 4) {
    const side = Math.floor(rand() * 4);
    const minBand = margin;
    const maxBand = borderThickness - margin;
    const bandPos = minBand + rand() * (maxBand - minBand);

    if (side === 0) {
      return { x: margin + rand() * (w - margin * 2), y: bandPos };
    } else if (side === 1) {
      return { x: w - bandPos, y: margin + rand() * (h - margin * 2) };
    } else if (side === 2) {
      return { x: margin + rand() * (w - margin * 2), y: h - bandPos };
    } else {
      return { x: bandPos, y: margin + rand() * (h - margin * 2) };
    }
  }

  const dotCount = Math.floor((w + h) / 13);
  for (let i = 0; i < dotCount; i++) {
    const { x, y } = randomPointInBorder(4);
    const r = (0.75 + rand() * 0.95).toFixed(2);
    const opacity = (0.72 + rand() * 0.28).toFixed(2);

    const circle = document.createElementNS(ns, 'circle');
    circle.setAttribute('cx', x.toFixed(1));
    circle.setAttribute('cy', y.toFixed(1));
    circle.setAttribute('r', r);
    circle.setAttribute('fill', '#FFFFFF');
    circle.setAttribute('opacity', opacity);
    svg.appendChild(circle);
  }

  const vectorGroup = document.createElementNS(ns, 'g');
  const vStartX = -16;
  const vStartY = h - 78;
  const vEndX = 96;
  const vEndY = h + 14;

  const redOrbitHalo = document.createElementNS(ns, 'path');
  redOrbitHalo.setAttribute('d', `M ${vStartX} ${vStartY} Q 18 ${h - 16}, ${vEndX} ${vEndY}`);
  redOrbitHalo.setAttribute('fill', 'none');
  redOrbitHalo.setAttribute('stroke', '#FFFFFF');
  redOrbitHalo.setAttribute('stroke-width', '5');
  redOrbitHalo.setAttribute('stroke-linecap', 'round');
  redOrbitHalo.setAttribute('opacity', '0.95');
  vectorGroup.appendChild(redOrbitHalo);

  const redOrbitLine = document.createElementNS(ns, 'path');
  redOrbitLine.setAttribute('d', `M ${vStartX} ${vStartY} Q 18 ${h - 16}, ${vEndX} ${vEndY}`);
  redOrbitLine.setAttribute('fill', 'none');
  redOrbitLine.setAttribute('stroke', '#E03C31');
  redOrbitLine.setAttribute('stroke-width', '2.75');
  redOrbitLine.setAttribute('stroke-linecap', 'round');
  vectorGroup.appendChild(redOrbitLine);

  const chevron = document.createElementNS(ns, 'polygon');
  chevron.setAttribute(
    'points',
    `${vStartX - 4},${vStartY - 3} ${vStartX + 11},${vStartY + 2} ${vStartX + 4},${vStartY + 5} ${vStartX + 3},${vStartY + 12}`
  );
  chevron.setAttribute('fill', '#E03C31');
  chevron.setAttribute('stroke', '#FFFFFF');
  chevron.setAttribute('stroke-width', '0.8');
  chevron.setAttribute('stroke-linejoin', 'miter');
  vectorGroup.appendChild(chevron);

  svg.appendChild(vectorGroup);

  const starPositions = [
    { x: w - 6, y: 5, scale: 1.78, delay: '0s' },
    { x: w * 0.39, y: -3, scale: 0.92, delay: '0.7s' },
    { x: -3, y: h * 0.16, scale: 0.9, delay: '1.4s' },
    { x: w + 3, y: h * 0.84, scale: 0.9, delay: '2.0s' },
    { x: w * 0.21, y: h + 3, scale: 0.88, delay: '0.4s' },
    { x: w * 0.69, y: h + 3, scale: 0.94, delay: '1.7s' }
  ];

  starPositions.forEach((pos) => {
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', '#nasa-4pt-star');
    use.setAttribute(
      'transform',
      `translate(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}) scale(${pos.scale})`
    );
    use.setAttribute('class', 'nasa-star-twinkle');
    use.style.animationDelay = pos.delay;
    svg.appendChild(use);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  renderTimelineTracks(SITES_DATA[activeSiteKey]);
  updateTelemetryReadout();
  renderNasaBorderDetails();

  const container = document.getElementById('nasa-framed-block');
  if (container && 'ResizeObserver' in window) {
    const observer = new ResizeObserver(() => renderNasaBorderDetails());
    observer.observe(container);
  }
});

window.addEventListener('resize', renderNasaBorderDetails);