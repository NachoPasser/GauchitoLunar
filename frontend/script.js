// script.js — lógica de la bienvenida (tutorial de 3 pasos + rango de fechas, máx. 30 días).
// initWelcome(root, { onSubmit }) la inicializa sobre el markup de welcome.html ya inserto en
// `root` (todo se busca dentro de root: no toca ids del resto de la página). Devuelve
// { destroy } para quitar los listeners globales al cerrarla.

import { setRango } from "./state.js";
import { MAX_DAYS, parseISO, addDays, daysBetween, formatReadable } from "./dates.js";
import { drawGlobe, GLOBE_LIGHT } from "./globe.js";

export function initWelcome(root, { onSubmit } = {}) {
  const $ = (id) => root.querySelector('#' + id);

  // =========================================================
  // 1. NAVEGACIÓN ENTRE LOS 3 PASOS
  // =========================================================
  let currentStep = 1;

  function goToStep(stepNumber) {
    currentStep = stepNumber;

    root.querySelectorAll('.step-panel').forEach((panel, idx) => {
      panel.classList.toggle('active', idx + 1 === stepNumber);
    });

    [1, 2, 3].forEach((n) => {
      const bar = $(`bar-${n}`);
      if (bar) {
        bar.classList.toggle('bg-[#0032A0]', n <= stepNumber);
        bar.classList.toggle('bg-[#0032A0]/15', n > stepNumber);
      }
    });

    root.querySelectorAll('.phase-pill').forEach((pill) => {
      const target = Number(pill.dataset.goto);
      if (target === stepNumber) {
        pill.className = 'phase-pill cursor-pointer px-2 py-0.5 rounded font-["JetBrains_Mono"] text-[10px] font-semibold transition-colors bg-[#0032A0] text-white';
      } else {
        pill.className = 'phase-pill cursor-pointer px-2 py-0.5 rounded font-["JetBrains_Mono"] text-[10px] font-semibold transition-colors bg-slate-100 text-slate-500 hover:text-[#0032A0]';
      }
    });
  }

  root.querySelectorAll('[data-goto]').forEach((btn) => {
    btn.addEventListener('click', () => {
      goToStep(Number(btn.dataset.goto));
    });
  });

  const onKey = (e) => {
    if (document.activeElement.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight' && currentStep < 3) goToStep(currentStep + 1);
    if (e.key === 'ArrowLeft' && currentStep > 1) goToStep(currentStep - 1);
  };
  document.addEventListener('keydown', onKey);

  // =========================================================
  // 2. CONTROL DE DOS CALENDARIOS Y LÍMITE DE 30 DÍAS (PASO 3)
  // =========================================================
  const MAX_MISSION_DAYS = MAX_DAYS;
  const parseISODate = parseISO, addDaysISO = addDays, formatReadableDate = formatReadable;
  // Acceso corto al motor i18n (window.i18n lo define i18n.js, cargado antes de los módulos).
  const T = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);

  const dateForm = $('mission-date-form');
  const startDateInput = $('start-date-input');
  const endDateInput = $('end-date-input');
  const durationBadge = $('mission-duration-badge');

  const feedbackBox = $('telemetry-feedback');
  const feedbackTitle = $('feedback-title');
  const feedbackDetail = $('feedback-detail');
  const clearBtn = $('clear-feedback');

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
      durationBadge.textContent = T('w.duration.empty', { max: MAX_MISSION_DAYS });
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
          T('w.fb.limitApplied.title'),
          T('w.fb.limitApplied.body', { max: MAX_MISSION_DAYS }),
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
      durationBadge.textContent = T('w.duration.empty', { max: MAX_MISSION_DAYS });
      durationBadge.className = 'font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider text-[#0032A0] bg-[#0032A0]/10 px-2 py-0.5 rounded';
      return null;
    }

    const diffDays = daysBetween(startDateInput.value, endDateInput.value);

    if (diffDays < 0 || diffDays > MAX_MISSION_DAYS) {
      durationBadge.textContent = T('w.duration.exceed', { n: diffDays });
      durationBadge.className = 'font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider text-[#E03C31] bg-[#E03C31]/10 px-2 py-0.5 rounded';
    } else {
      durationBadge.textContent = T('w.duration.value', { n: diffDays, max: MAX_MISSION_DAYS });
      durationBadge.className = 'font-["JetBrains_Mono"] text-[10px] font-bold uppercase tracking-wider text-[#0032A0] bg-[#0032A0]/10 px-2 py-0.5 rounded';
    }

    return diffDays;
  }

  // Inicializar valores por defecto (ej. 20 Nov 2026 + 14 días)
  startDateInput.value = '2026-11-20';
  syncDateConstraints(false);
  endDateInput.value = addDaysISO('2026-11-20', 14);
  updateDurationDisplay();

  // El badge de duración se setea por JS: al cambiar de idioma hay que regenerarlo (el texto
  // estático lo re-aplica i18n.apply). Se quita al cerrar la bienvenida (destroy).
  const onLang = () => updateDurationDisplay();
  document.addEventListener('i18n:change', onLang);

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
        T('w.fb.durationExceeded.title'),
        T('w.fb.durationExceeded.body',
          { max: MAX_MISSION_DAYS, date: formatReadableDate(endDateInput.max) }),
        true
      );
    } else if (diffDays !== null && diffDays < 0) {
      showFeedback(
        T('w.fb.invalidRange.title'),
        T('w.fb.invalidRange.bodyBefore'),
        true
      );
    }
  });

  // Botones de sugerencia rápida (14 días / 30 días)
  root.querySelectorAll('.preset-btn').forEach((btn) => {
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
        T('w.fb.incomplete.title'),
        T('w.fb.incomplete.body'),
        true
      );
      return;
    }

    const diffDays = updateDurationDisplay();

    if (diffDays < 0) {
      showFeedback(
        T('w.fb.invalidRange.title'),
        T('w.fb.invalidRange.bodyAfter'),
        true
      );
      return;
    }

    if (diffDays > MAX_MISSION_DAYS) {
      showFeedback(
        T('w.fb.missionExceeded.title'),
        T('w.fb.missionExceeded.body', { max: MAX_MISSION_DAYS, n: diffDays }),
        true
      );
      return;
    }

    showFeedback(
      T('w.fb.loaded.title'),
      T('w.fb.loaded.body', {
        from: formatReadableDate(startVal),
        to: formatReadableDate(endVal),
        n: diffDays,
      }),
      false
    );

    // H4: fija el rango global en la única fuente de verdad (state.js) y avisa a quien
    // montó la bienvenida (mapa: quita la capa y sigue con el rango elegido).
    setRango(startVal, endVal);
    setTimeout(() => onSubmit?.({ desde: startVal, hasta: endVal }), 650);
  });

  clearBtn.addEventListener('click', () => {
    feedbackBox.classList.add('hidden');
  });

  // =========================================================
  // 3. DIBUJO DEL BORDE NASA (#0032A0 + ESTRELLAS + VECTOR ROJO)
  // =========================================================
  function renderNasaBorderDetails() {
    const container = $('nasa-framed-block');
    const svg = $('nasa-border-stars');
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

    // Anillo del logo (designReferences/logo.jpg), con la orientación de la flecha original
    // (de arriba-izquierda a abajo-derecha): órbita elíptica inclinada, roja con una
    // línea blanca fina por debajo, cortada por un hueco arriba a la izquierda, y una
    // estrella blanca de 4 puntas por encima. Esquina inferior izquierda del marco.
    const vectorGroup = document.createElementNS(ns, 'g');
    const cx = 42, cy = h - 34;
    const orbit = document.createElementNS(ns, 'g');
    orbit.setAttribute('transform', `translate(${cx}, ${cy}) rotate(38)`);
    // pathLength=100 + dasharray: arco principal, hueco, trazo corto, hueco, arco final.
    const ellipse = (dy, color, width) => {
      const e = document.createElementNS(ns, 'ellipse');
      e.setAttribute('cx', 0);
      e.setAttribute('cy', dy);
      e.setAttribute('rx', 74);
      e.setAttribute('ry', 29);
      e.setAttribute('fill', 'none');
      e.setAttribute('stroke', color);
      e.setAttribute('stroke-width', width);
      e.setAttribute('pathLength', 100);
      e.setAttribute('stroke-dasharray', '63 3.5 4 3.5 26');
      e.setAttribute('stroke-linecap', 'round');
      return e;
    };
    orbit.appendChild(ellipse(4.2, '#FFFFFF', 3));     // línea blanca por debajo
    orbit.appendChild(ellipse(0, '#E03C31', 7.4));     // anillo rojo
    // Pasa por detrás del bloque: se recorta la zona del bloque (rect redondeado, rounded-2xl)
    // con una máscara. Así conserva todo su color (una capa trasera real quedaría bajo la
    // sombra azul del contenedor).
    const mask = document.createElementNS(ns, 'mask');
    mask.setAttribute('id', 'nasa-ring-mask');
    mask.setAttribute('maskUnits', 'userSpaceOnUse');
    mask.setAttribute('x', -200);
    mask.setAttribute('y', -200);
    mask.setAttribute('width', w + 400);
    mask.setAttribute('height', h + 400);
    const maskAll = document.createElementNS(ns, 'rect');
    maskAll.setAttribute('x', -200);
    maskAll.setAttribute('y', -200);
    maskAll.setAttribute('width', w + 400);
    maskAll.setAttribute('height', h + 400);
    maskAll.setAttribute('fill', '#FFFFFF');
    const maskBlock = document.createElementNS(ns, 'rect');
    maskBlock.setAttribute('width', w);
    maskBlock.setAttribute('height', h);
    maskBlock.setAttribute('rx', 16);
    maskBlock.setAttribute('fill', '#000000');
    // Ventana en la punta inferior izquierda: ahí el anillo pasa por DELANTE del bloque.
    // El rect empieza/termina donde el anillo cruza los bordes del bloque (fuera de él),
    // así el cambio detrás→delante no deja cortes visibles.
    const maskCorner = document.createElementNS(ns, 'rect');
    maskCorner.setAttribute('x', -30);
    maskCorner.setAttribute('y', h - 46);
    maskCorner.setAttribute('width', 92);
    maskCorner.setAttribute('height', 70);
    maskCorner.setAttribute('fill', '#FFFFFF');
    mask.append(maskAll, maskBlock, maskCorner);
    defs.appendChild(mask);
    // La máscara va en un grupo sin transform (usa el sistema de coordenadas del marco).
    const ringLayer = document.createElementNS(ns, 'g');
    ringLayer.setAttribute('mask', 'url(#nasa-ring-mask)');
    ringLayer.appendChild(orbit);
    vectorGroup.appendChild(ringLayer);

    const star = document.createElementNS(ns, 'path');
    star.setAttribute('d', 'M 0 -11 C 0.6 -2.2 2.2 -0.6 11 0 C 2.2 0.6 0.6 2.2 0 11 ' +
      'C -0.6 2.2 -2.2 0.6 -11 0 C -2.2 -0.6 -0.6 -2.2 0 -11 Z');
    star.setAttribute('transform', `translate(${cx - 31}, ${cy - 52}) scale(1.4)`);
    star.setAttribute('fill', '#FFFFFF');
    vectorGroup.appendChild(star);

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

  renderNasaBorderDetails();
  // Globo del paso 1 (centrado en 0,0; r=84 como en el mapa), paleta para fondo blanco.
  drawGlobe($('welcome-globe'), { cx: 0, cy: 0, r: 84, tilt: 28, cap: 18 }, GLOBE_LIGHT);
  const container = $('nasa-framed-block');
  const observer = 'ResizeObserver' in window
    ? new ResizeObserver(() => renderNasaBorderDetails()) : null;
  if (container && observer) observer.observe(container);

  return {
    destroy() {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('i18n:change', onLang);
      observer?.disconnect();
    },
  };
}
