// format.js — formateo numérico sensato para la UI (SPEC §6: lenguaje llano).
// Centraliza redondeos para no mostrar precisión falsa ("12.4584" → "12.5").

// Energía kWh/m²: entero si es grande, 1 decimal si es chico.
export function fmtEnergy(x) {
  if (x == null || !isFinite(x)) return "—";
  return x >= 100 ? String(Math.round(x)) : x.toFixed(1);
}

// Fracción 0–1 → porcentaje entero.
export function fmtPct(x) {
  return `${Math.round((x || 0) * 100)}%`;
}

// Horas → texto corto: < 2 días en horas enteras, si no en días con 1 decimal.
export function fmtHours(h) {
  if (h == null || !isFinite(h)) return "—";
  return h < 48 ? `${Math.round(h)} h` : `${(h / 24).toFixed(1)} d`;
}

// Días: 1 decimal si < 10, entero si no.
export function fmtDays(d) {
  if (d == null || !isFinite(d)) return "—";
  return d < 10 ? d.toFixed(1) : String(Math.round(d));
}

// Grados con N decimales (default 0).
export function fmtDeg(x, dp = 0) {
  if (x == null || !isFinite(x)) return "—";
  return `${x.toFixed(dp)}°`;
}
