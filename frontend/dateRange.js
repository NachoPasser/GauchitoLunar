// dateRange.js — selector de fechas del mapa: un chip con el rango vigente ("20 NOV – 29
// NOV 2026 · 9 DÍAS") que abre un panel para cambiarlo sin volver a la bienvenida. Usa las
// mismas reglas que ella (dates.js: máx. 30 días, UTC). No sabe nada del mapa: avisa con
// onApply({desde, hasta}) y quien lo monta refresca lo que dependa del rango.

import { MAX_DAYS, addDays, daysBetween, formatReadable, validateRange } from "./dates.js";

const PRESETS = [[14, "dr.preset14"], [30, "dr.preset30"]];

// Acceso corto al motor i18n (window.i18n lo define i18n.js, cargado antes de los módulos).
const T = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);
const ICON_CAL = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" ' +
  'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ' +
  'aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/>' +
  '<path d="M3 10h18M8 3v4M16 3v4"/></svg>';

export function createDateRange(root, { getRange, onApply }) {
  root.innerHTML = `
    <button type="button" class="dr__chip" aria-haspopup="dialog" aria-expanded="false"
            title="Cambiar las fechas del análisis" data-i18n-attr="title:dr.chipTitle">
      ${ICON_CAL}<span class="dr__label"></span><span class="dr__days"></span>
      <svg class="dr__chev" width="10" height="10" viewBox="0 0 24 24" fill="none"
           stroke="currentColor" stroke-width="3" stroke-linecap="round"
           stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
    </button>
    <div class="dr__pop" role="dialog" aria-label="Cambiar fechas" hidden
         data-i18n-attr="aria-label:dr.aria">
      <p class="dr__title" data-i18n="dr.title">Ventana de análisis</p>
      <div class="dr__fields">
        <label class="dr__field"><span data-i18n="dr.start">INICIO</span>
          <input type="date" class="dr__input" data-f="start" /></label>
        <label class="dr__field"><span data-i18n="dr.end">FIN</span>
          <input type="date" class="dr__input" data-f="end" /></label>
      </div>
      <div class="dr__presets">
        ${PRESETS.map(([d, k]) => `<button type="button" class="dr__preset" data-days="${d}"
          data-i18n="${k}">${T(k)}</button>`).join("")}
      </div>
      <p class="dr__msg" aria-live="polite"></p>
      <div class="dr__actions">
        <button type="button" class="dr__btn dr__btn--ghost" data-a="cancel"
                data-i18n="dr.cancel">Cancelar</button>
        <button type="button" class="dr__btn dr__btn--ok" data-a="apply"
                data-i18n="dr.apply">Aplicar</button>
      </div>
    </div>`;
  window.i18n?.apply(root);                      // traduce el markup recién montado
  const $ = (sel) => root.querySelector(sel);
  const chip = $(".dr__chip"), pop = $(".dr__pop"), msg = $(".dr__msg");
  const start = $('[data-f="start"]'), end = $('[data-f="end"]');
  const apply = $('[data-a="apply"]');

  function refresh() {
    const { desde, hasta } = getRange() || {};
    if (!desde || !hasta) {
      $(".dr__label").textContent = T("dr.noRange");
      $(".dr__days").textContent = "";
      return;
    }
    $(".dr__label").textContent =
      `${formatReadable(desde, { year: false })} – ${formatReadable(hasta)}`.toUpperCase();
    $(".dr__days").textContent = T("dr.days", { n: daysBetween(desde, hasta) });
  }

  // Estado del formulario: límites del calendario de fin, mensaje y botón Aplicar.
  function validate(note = "") {   // note = clave i18n de un aviso (o "")
    if (start.value) { end.min = start.value; end.max = addDays(start.value, MAX_DAYS); }
    const v = validateRange(start.value, end.value);
    msg.textContent = v.error ? T(v.error.key, v.error.vars)
      : note ? T(note, { max: MAX_DAYS }) : v.days != null ? T("dr.window", { n: v.days }) : "";
    msg.classList.toggle("is-err", !!v.error);
    apply.disabled = !v.ok;
    return v;
  }

  const isOpen = () => !pop.hidden;
  function open() {
    const { desde, hasta } = getRange() || {};
    start.value = desde || ""; end.value = hasta || "";
    validate();
    pop.hidden = false;
    chip.setAttribute("aria-expanded", "true");
  }
  function close() {
    pop.hidden = true;
    chip.setAttribute("aria-expanded", "false");
  }

  chip.addEventListener("click", () => (isOpen() ? close() : open()));
  start.addEventListener("change", () => {
    // Si el fin quedó fuera de [inicio, inicio+30 d], se ajusta (y se avisa).
    let note = "";
    if (start.value && end.value) {
      const max = addDays(start.value, MAX_DAYS);
      if (end.value < start.value) end.value = start.value;
      else if (end.value > max) {
        end.value = max;
        note = "dr.adjusted";
      }
    }
    validate(note);
  });
  end.addEventListener("change", () => validate());
  pop.addEventListener("click", (e) => {
    const p = e.target.closest(".dr__preset");
    if (p && start.value) { end.value = addDays(start.value, Number(p.dataset.days)); validate(); }
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "cancel") close();
    if (a === "apply" && validate().ok) {
      close();
      onApply({ desde: start.value, hasta: end.value });
    }
  });
  // Cerrar al hacer clic afuera o con Esc.
  document.addEventListener("pointerdown", (e) => {
    if (isOpen() && !root.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && isOpen()) close(); });

  // Al cambiar de idioma: el texto estático lo re-aplica i18n.apply; acá, lo que arma el JS.
  document.addEventListener("i18n:change", () => { refresh(); if (isOpen()) validate(); });

  refresh();
  return { refresh, close };
}
