// state.js — única fuente de verdad compartida por bienvenida / mapa / detalle
// (SPEC §flujo). Cruza PÁGINAS vía localStorage (son cargas distintas); dentro de
// una página, notifica cambios con subscribe(). Forma:
//   { rangoFechas:{desde,hasta}, sitios:[{name,lat,lon,kind}], sitioActivo, ventanaAzimut }
// Las semillas ⭐ vienen del backend; `sitios` guarda las chinchetas 📍 del usuario.

import { MAX_DAYS } from "./dates.js";

const KEY = "lln.state.v1";
const DEFAULT = {
  rangoFechas: { desde: null, hasta: null },   // "YYYY-MM-DD" en UTC
  sitios: [],                                  // chinchetas del usuario
  sitioActivo: null,                           // {lat,lon,name}
  ventanaAzimut: null,                         // {desde,hasta}° — reservado H6
};

// Lo que hay en localStorage puede venir viejo, a mano o corrupto: se valida la FORMA antes de
// usarlo (un `sitios: null` o un pin sin coordenadas rompía la carga del mapa en cada reintento).
// Lo inválido se descarta y se cae al valor por defecto.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);
const isDate = (d) =>
  typeof d === "string" && ISO.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`));

function sanitize(raw) {
  const r = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const rg = r.rangoFechas && typeof r.rangoFechas === "object" ? r.rangoFechas : {};
  let { desde, hasta } = rg;
  const days = (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / 86400000;
  if (!isDate(desde) || !isDate(hasta) || days < 0 || days > MAX_DAYS) {
    desde = null; hasta = null;                // rango roto o fuera de la regla: se descarta
  }
  const sitios = (Array.isArray(r.sitios) ? r.sitios : [])
    .filter((s) => s && isNum(s.lat) && isNum(s.lon))
    .map((s) => ({ ...s, kind: "pin", name: typeof s.name === "string" && s.name ? s.name
      : `${Math.abs(s.lat).toFixed(1)}°S ${Math.round(s.lon)}°E` }));
  const a = r.sitioActivo;
  const va = r.ventanaAzimut;
  return {
    rangoFechas: { desde, hasta },
    sitios,
    sitioActivo: a && isNum(a.lat) && isNum(a.lon) ? a : null,
    ventanaAzimut: va && isNum(va.desde) && isNum(va.hasta) ? va : null,
  };
}

function load() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) || "{}"));
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

// Elimina una chincheta propia por coordenadas (tolerancia por floats).
export function removeSitio(lat, lon) {
  const keep = state.sitios.filter(
    (s) => Math.abs(s.lat - lat) > 1e-6 || Math.abs(s.lon - lon) > 1e-6);
  commit({ ...state, sitios: keep });
}

export function setSitioActivo(s) {
  commit({ ...state, sitioActivo: s });
}

export function renameSitio(lat, lon, newName) {
  const sitios = state.sitios.map((s) =>
    Math.abs(s.lat - lat) < 1e-6 && Math.abs(s.lon - lon) < 1e-6
      ? { ...s, name: newName } : s);
  commit({ ...state, sitios });
}
