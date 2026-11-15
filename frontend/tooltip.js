// tooltip.js — tooltips livianos para cualquier elemento con [data-tip]. Un único
// globo flotante (position: fixed) para que no lo recorte el overflow de tarjetas.
// Aparece con hover, foco o tap (los [data-tip] llevan tabindex="0"). Idempotente.

let tipEl = null;

function hide() { if (tipEl) tipEl.hidden = true; }

function show(target) {
  tipEl.textContent = target.dataset.tip;
  tipEl.hidden = false;
  const r = target.getBoundingClientRect();
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight, gap = 8;
  const x = Math.max(gap, Math.min(innerWidth - w - gap, r.left + r.width / 2 - w / 2));
  const y = r.top - h - gap >= gap ? r.top - h - gap : r.bottom + gap;   // arriba o abajo
  tipEl.style.left = `${x}px`;
  tipEl.style.top = `${y}px`;
}

export function initTooltips() {
  if (tipEl) return;
  tipEl = document.createElement("div");
  tipEl.className = "tip";
  tipEl.setAttribute("role", "tooltip");
  tipEl.hidden = true;
  document.body.appendChild(tipEl);

  const find = (e) => e.target.closest?.("[data-tip]");
  document.addEventListener("mouseover", (e) => { const t = find(e); if (t) show(t); });
  document.addEventListener("mouseout", (e) => {
    const t = find(e);
    if (t && !t.contains(e.relatedTarget)) hide();
  });
  document.addEventListener("focusin", (e) => { const t = find(e); if (t) show(t); });
  document.addEventListener("focusout", hide);
  document.addEventListener("scroll", hide, true);       // el globo es fixed: ocultar
}
