// =========================================================
// 1. NAVEGACIÓN ENTRE LOS 3 PASOS
// =========================================================
let currentStep = 1;

function goToStep(stepNumber) {
  currentStep = stepNumber;

  document.querySelectorAll('.step-panel').forEach((panel, idx) => {
    panel.classList.toggle('active', idx + 1 === stepNumber);
  });

  [1, 2, 3].forEach((n) => {
    const bar = document.getElementById(`bar-${n}`);
    if (bar) {
      bar.classList.toggle('bg-[#0032A0]', n <= stepNumber);
      bar.classList.toggle('bg-[#0032A0]/15', n > stepNumber);
    }
  });

  document.querySelectorAll('.phase-pill').forEach((pill) => {
    const target = Number(pill.dataset.goto);
    if (target === stepNumber) {
      pill.className = 'phase-pill cursor-pointer px-2 py-0.5 rounded font-["JetBrains_Mono"] text-[10px] font-semibold transition-colors bg-[#0032A0] text-white';
    } else {
      pill.className = 'phase-pill cursor-pointer px-2 py-0.5 rounded font-["JetBrains_Mono"] text-[10px] font-semibold transition-colors bg-slate-100 text-slate-500 hover:text-[#0032A0]';
    }
  });
}

document.querySelectorAll('[data-goto]').forEach((btn) => {
  btn.addEventListener('click', () => {
    goToStep(Number(btn.dataset.goto));
  });
});

document.addEventListener('keydown', (e) => {
  if (document.activeElement.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' && currentStep < 3) goToStep(currentStep + 1);
  if (e.key === 'ArrowLeft' && currentStep > 1) goToStep(currentStep - 1);
});

// =========================================================
// 2. CONTROL DE DOS CALENDARIOS Y LÍMITE DE 30 DÍAS (PASO 3)
// =========================================================
const MAX_MISSION_DAYS = 30;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const dateForm = document.getElementById('mission-date-form');
const startDateInput = document.getElementById('start-date-input');
const endDateInput = document.getElementById('end-date-input');
const durationBadge = document.getElementById('mission-duration-badge');

const feedbackBox = document.getElementById('telemetry-feedback');
const feedbackTitle = document.getElementById('feedback-title');
const feedbackDetail = document.getElementById('feedback-detail');
const clearBtn = document.getElementById('clear-feedback');

// Convierte "YYYY-MM-DD" a objeto Date en UTC (evita desfases por zona horaria)
function parseISODate(isoStr) {
  if (!isoStr) return null;
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Convierte objeto Date UTC a "YYYY-MM-DD"
function toISODate(dateObj) {
  return dateObj.toISOString().split('T')[0];
}

// Suma N días a una fecha ISO
function addDaysISO(isoStr, days) {
  const date = parseISODate(isoStr);
  date.setUTCDate(date.getUTCDate() + days);
  return toISODate(date);
}

// Formatea fecha legible en español (ej: "20 nov 2026")
function formatReadableDate(isoStr) {
  const date = parseISODate(isoStr);
  return date.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

// Muestra mensaje en la caja de telemetría (normal o error)
function showFeedback(title, detailHTML, isError = false) {
  feedbackBox.classList.remove('hidden');

  if (isError) {
    feedbackBox.className = 'mt-3 rounded-lg border border-[#E03C31]/50 bg-[#E03C31]/[0.06] px-3 py-2 text-xs';
    feedbackTitle.className = 'font-["JetBrains_Mono"] font-semibold text-[#E03C31] uppercase tracking-wide text-[10px]';
  } else {
    feedbackBox.className = 'mt-3 rounded-lg border border-[#0032A0]/30 bg-[#0032A0]/[0.04] px-3 py-2 text-xs';
    feedbackTitle.className = 'font-["JetBrains_Mono"] font-semibold text-[#0032A0] uppercase tracking-wide text-[10px]';
  }

  feedbackTitle.textContent = title;
  feedbackDetail.innerHTML = detailHTML;
}

// Actualiza límites del segundo calendario y el contador de días
function syncDateConstraints(autoAdjustEnd = false) {
  const startVal = startDateInput.value;

  if (!startVal) {
    endDateInput.disabled = true;
    endDateInput.value = '';
    durationBadge.textContent = `DURACIÓN: — / ${MAX_MISSION_DAYS} DÍAS`;
    return;
  }

  endDateInput.disabled = false;
  const maxAllowedEnd = addDaysISO(startVal, MAX_MISSION_DAYS);
  endDateInput.min = startVal;
  endDateInput.max = maxAllowedEnd;

  // Si se cambió el inicio y el fin quedó fuera de rango, ajustar automáticamente
  if (autoAdjustEnd && endDateInput.value) {
    if (endDateInput.value < startVal) {
      endDateInput.value = startVal;
    } else if (endDateInput.value > maxAllowedEnd) {
      endDateInput.value = maxAllowedEnd;
      showFeedback(
        'LÍMITE DE 30 DÍAS APLICADO',
        `La fecha de fin se ajustó automáticamente al máximo permitido de <strong>${MAX_MISSION_DAYS} días</strong> desde el inicio.`,
        true
      );
    }
  }

  updateDurationDisplay();
}

function updateDurationDisplay() {
  const start = parseISODate(startDateInput.value);
  const end = parseISODate(endDateInput.value);

  if (!start || !end) {
    durationBadge.textContent = `DURACIÓN: — / ${MAX_MISSION_DAYS} DÍAS`;
    durationBadge.className = 'font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider text-[#0032A0] bg-[#0032A0]/10 px-2 py-0.5 rounded';
    return null;
  }

  const diffDays = Math.round((end - start) / MS_PER_DAY);

  if (diffDays < 0 || diffDays > MAX_MISSION_DAYS) {
    durationBadge.textContent = `EXCEDE LÍMITE (${diffDays} DÍAS)`;
    durationBadge.className = 'font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider text-[#E03C31] bg-[#E03C31]/10 px-2 py-0.5 rounded';
  } else {
    durationBadge.textContent = `DURACIÓN: ${diffDays} / ${MAX_MISSION_DAYS} DÍAS`;
    durationBadge.className = 'font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider text-[#0032A0] bg-[#0032A0]/10 px-2 py-0.5 rounded';
  }

  return diffDays;
}

// Inicializar valores por defecto (ej. 20 Nov 2026 + 14 días)
startDateInput.value = '2026-11-20';
syncDateConstraints(false);
endDateInput.value = addDaysISO('2026-11-20', 14);
updateDurationDisplay();

startDateInput.addEventListener('change', () => {
  feedbackBox.classList.add('hidden');
  syncDateConstraints(true);
});

endDateInput.addEventListener('change', () => {
  feedbackBox.classList.add('hidden');
  const diffDays = updateDurationDisplay();

  // Respaldo por si el usuario tipea manualmente una fecha mayor a 30 días
  if (diffDays !== null && diffDays > MAX_MISSION_DAYS) {
    showFeedback(
      'DURACIÓN EXCEDIDA',
      `La misión no puede durar más de <strong>${MAX_MISSION_DAYS} días</strong> (un ciclo lunar completo). Seleccioná una fecha de fin igual o anterior al <strong>${formatReadableDate(endDateInput.max)}</strong>.`,
      true
    );
  } else if (diffDays !== null && diffDays < 0) {
    showFeedback(
      'RANGO INVÁLIDO',
      'La fecha de fin no puede ser anterior a la fecha de inicio de la misión.',
      true
    );
  }
});

// Botones de sugerencia rápida (14 días / 30 días)
document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const days = Number(btn.dataset.days);
    if (!startDateInput.value) {
      startDateInput.value = '2026-11-20';
    }
    syncDateConstraints(false);
    endDateInput.value = addDaysISO(startDateInput.value, days);
    updateDurationDisplay();
    feedbackBox.classList.add('hidden');
  });
});

// Envío del formulario
dateForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const startVal = startDateInput.value;
  const endVal = endDateInput.value;

  if (!startVal || !endVal) {
    showFeedback(
      'FECHAS INCOMPLETAS',
      'Seleccioná tanto la fecha de inicio como la fecha de fin para iniciar la simulación.',
      true
    );
    return;
  }

  const diffDays = updateDurationDisplay();

  if (diffDays < 0) {
    showFeedback(
      'RANGO INVÁLIDO',
      'La fecha de fin debe ser posterior o igual a la fecha de inicio.',
      true
    );
    return;
  }

  if (diffDays > MAX_MISSION_DAYS) {
    showFeedback(
      'LÍMITE DE MISIÓN EXCEDIDO',
      `La misión no puede durar más de <strong>${MAX_MISSION_DAYS} días</strong> (seleccionaste ${diffDays} días). Reducí el período para continuar.`,
      true
    );
    return;
  }

  showFeedback(
    'VENTANA CARGADA EN MATRIZ',
    `Analizando sitios en el Polo Sur del <strong class="font-['JetBrains_Mono'] text-[#0032A0]">${formatReadableDate(startVal)}</strong> al <strong class="font-['JetBrains_Mono'] text-[#0032A0]">${formatReadableDate(endVal)}</strong> (${diffDays} días)...`,
    false
  );

  // H4: fija el rango global en la única fuente de verdad y navega al mapa. El
  // estado y la base del backend cruzan la página vía localStorage (NO por la URL:
  // arrastrar ?api= la componía en navegaciones sucesivas). Ver apibase.js.
  if (window.LLNState) window.LLNState.setRango(startVal, endVal);
  setTimeout(() => {
    window.location.href = "map.html";
  }, 650);
});

clearBtn.addEventListener('click', () => {
  feedbackBox.classList.add('hidden');
});

// =========================================================
// 3. DIBUJO DEL BORDE NASA (#0032A0 + ESTRELLAS + VECTOR ROJO)
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
  renderNasaBorderDetails();
  const container = document.getElementById('nasa-framed-block');
  if (container && 'ResizeObserver' in window) {
    const observer = new ResizeObserver(() => renderNasaBorderDetails());
    observer.observe(container);
  }
});

window.addEventListener('resize', renderNasaBorderDetails);