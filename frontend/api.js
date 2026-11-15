// Cliente del backend (contrato §5). Base configurable: definí window.API_BASE
// antes de importar para apuntar a otro host. Default: uvicorn local.
const API_BASE = window.API_BASE || "http://127.0.0.1:8000";

async function _get(path) {
  const r = await fetch(API_BASE + path);
  if (!r.ok) {
    let detail = "";
    try { detail = (await r.json()).detail || ""; } catch { /* sin body JSON */ }
    throw new Error(detail || `HTTP ${r.status}`);
  }
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

// Parche de DEM (heightfield local ENU) para el render 3D de 1ª persona.
export function getDemPatch(lat, lon, { radiusKm, res } = {}) {
  const p = new URLSearchParams({ lat, lon });
  if (radiusKm != null) p.set("radius_km", radiusKm);
  if (res != null) p.set("res", res);
  return _get(`/api/dem-patch?${p.toString()}`);
}

// URL del raster de fondo del mapa (para H3).
export function mapUrl(metric = "illumination") {
  return `${API_BASE}/api/map?metric=${metric}`;
}

// Geo-metadatos del fondo (bounds + proyección) para ubicar marcadores (H3).
export function getMapMeta(metric = "illumination") {
  return _get(`/api/map/meta?metric=${metric}`);
}
