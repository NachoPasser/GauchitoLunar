// Cliente del backend (contrato §5). Base configurable: definí window.API_BASE
// antes de importar para apuntar a otro host. Default: uvicorn local.
const API_BASE = window.API_BASE || "http://127.0.0.1:8000";

async function _get(path) {
  const r = await fetch(API_BASE + path);
  if (!r.ok) throw new Error(`${path} → HTTP ${r.status}`);
  return r.json();
}

// Sitios semilla para poblar selectores / mapa.
export function getSites() {
  return _get("/api/sites");
}

// Máscara de horizonte h(az) (cacheada por sitio, no depende de la fecha).
export function getMask(lat, lon) {
  return _get(`/api/mask?lat=${lat}&lon=${lon}`);
}

// Tracks de Sol/Tierra + métricas + cartuchos para una ventana.
export function getSite(lat, lon, { date, windowDays, marginDeg } = {}) {
  const p = new URLSearchParams({ lat, lon });
  if (date) p.set("date", date);
  if (windowDays != null) p.set("window_days", windowDays);
  if (marginDeg != null) p.set("comms_margin_deg", marginDeg);
  return _get(`/api/site?${p.toString()}`);
}

// URL del raster de fondo del mapa (para H3).
export function mapUrl(metric = "illumination") {
  return `${API_BASE}/api/map?metric=${metric}`;
}

// Geo-metadatos del fondo (bounds + proyección) para ubicar marcadores (H3).
export function getMapMeta(metric = "illumination") {
  return _get(`/api/map/meta?metric=${metric}`);
}
