// state.js — única fuente de verdad compartida por bienvenida / mapa / detalle
// (SPEC §flujo). Cruza PÁGINAS vía localStorage (son cargas distintas); dentro de
// una página, notifica cambios con subscribe(). Forma:
//   { rangoFechas:{desde,hasta}, sitios:[{name,lat,lon,kind}], sitioActivo, ventanaAzimut }
// Las semillas ⭐ vienen del backend; `sitios` guarda las chinchetas 📍 del usuario.

const KEY = "lln.state.v1";
const DEFAULT = {
  rangoFechas: { desde: null, hasta: null },   // "YYYY-MM-DD" en UTC
  sitios: [],                                  // chinchetas del usuario
  sitioActivo: null,                           // {lat,lon,name}
  ventanaAzimut: null,                         // {desde,hasta}° — reservado H6
};

function load() {
  try {
    return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { ...DEFAULT };
  }
}

let state = load();
const subs = new Set();

function commit(next) {
  state = next;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* modo privado */ }
  subs.forEach((fn) => fn(state));
}

export function getState() { return state; }

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }

export function setRango(desde, hasta) {
  commit({ ...state, rangoFechas: { desde, hasta } });
}

export function startDate() { return state.rangoFechas.desde || null; }

// Días de la ventana derivados del rango; fallback si no se eligió (1 ciclo sinódico).
export function windowDays(fallback = 30) {
  const { desde, hasta } = state.rangoFechas;
  if (!desde || !hasta) return fallback;
  const ms = Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`);
  const d = Math.round(ms / 86400000);
  return d > 0 ? d : fallback;
}

export function addSitio(sitio) {
  commit({ ...state, sitios: [...state.sitios, sitio] });
  return sitio;
}

export function setSitioActivo(s) {
  commit({ ...state, sitioActivo: s });
}

// Puente para el cascarón clásico (index.html/script.js no es módulo ES).
if (typeof window !== "undefined") {
  window.LLNState = { setRango, windowDays, startDate, getState };
}
