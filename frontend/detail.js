// Harness de H2: selector de sitios semilla + modal de detalle compartido.
// La lógica del skyline/métricas vive en detailModal.js (reusada por H3).

import { getSites } from "./api.js";
import { createDetailModal } from "./detailModal.js";

const $ = (id) => document.getElementById(id);
const modal = createDetailModal();

function selected() {
  const o = $("site-select").selectedOptions[0];
  return [Number(o.dataset.lat), Number(o.dataset.lon), o.textContent];
}

// Pobla el selector con los sitios semilla.
async function loadSites() {
  try {
    const { sites } = await getSites();
    const sel = $("site-select");
    sel.innerHTML = "";
    sites.forEach((s, i) => {
      const o = document.createElement("option");
      o.value = i;
      o.textContent = s.name;
      o.dataset.lat = s.lat;
      o.dataset.lon = s.lon;
      sel.appendChild(o);
    });
    sel.addEventListener("change", () => modal.show(...selected()));
    if (sites.length) modal.show(...selected());
  } catch (e) {
    const s = $("status");
    s.textContent = `No se pudieron listar los sitios: ${e.message}`;
    s.className = "text-xs text-red-500";
  }
}

$("open-btn").addEventListener("click", () => modal.openEmpty());

modal.openEmpty();
loadSites();
