// dates.js — helpers de fechas ISO ("YYYY-MM-DD", siempre UTC) y la regla del rango.
// Los comparten la bienvenida (script.js) y el selector de fechas del mapa (dateRange.js):
// una sola fuente del límite de 30 días (1 ciclo sinódico, ver CLAUDE.md) y del formato.

export const MAX_DAYS = 30;
const MS_PER_DAY = 86400000;

// "YYYY-MM-DD" → Date en UTC (evita desfases por zona horaria).
export function parseISO(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export const toISO = (date) => date.toISOString().split("T")[0];

export function addDays(iso, n) {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return toISO(d);
}

// Días entre dos fechas ISO (b − a); null si falta alguna.
export function daysBetween(a, b) {
  const da = parseISO(a), db = parseISO(b);
  return da && db ? Math.round((db - da) / MS_PER_DAY) : null;
}

// "20 nov 2026" (año opcional: "20 nov"). Se arma por partes: el formato largo de es-AR
// da "20 de nov. de 2026" / "20-nov" según el navegador.
export function formatReadable(iso, { year = true } = {}) {
  const parts = new Intl.DateTimeFormat("es", { day: "2-digit", month: "short",
    year: "numeric", timeZone: "UTC" }).formatToParts(parseISO(iso));
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  const mes = get("month").replace(".", "");
  return `${get("day")} ${mes}${year ? ` ${get("year")}` : ""}`;
}

// Valida un rango. Devuelve { ok, days, error } (error = mensaje llano o null).
export function validateRange(desde, hasta) {
  if (!desde || !hasta) return { ok: false, days: null, error: "Elegí las dos fechas." };
  const days = daysBetween(desde, hasta);
  if (days < 0) return { ok: false, days, error: "El fin no puede ser anterior al inicio." };
  if (days > MAX_DAYS) {
    return { ok: false, days, error: `Máximo ${MAX_DAYS} días (elegiste ${days}).` };
  }
  return { ok: true, days, error: null };
}
