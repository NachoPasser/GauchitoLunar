// Cliente del backend (contrato §5). Base configurable: definí window.API_BASE
// antes de importar para apuntar a otro host. Default: uvicorn local.
//
// Todos los pedidos tienen TIEMPO MÁXIMO y se pueden CANCELAR (opts.signal), y fallan con un
// ApiError tipado: quien lo muestra (errors.js) elige el mensaje según `kind`, en vez de
// enseñar el texto crudo del navegador ("Failed to fetch").
const API_BASE = window.API_BASE || "http://127.0.0.1:8000";

// Tiempos máximos (ms). /api/site y /api/mask pueden bajar efemérides de Horizons en vivo
// (unos segundos por sitio) o calcular la máscara por primera vez: margen generoso.
const T_FAST = 15000;
const T_HEAVY = 60000;

// kind: "network" (no hay conexión con el servidor) · "timeout" (no respondió a tiempo) ·
//       "aborted" (lo cancelamos nosotros: no es un error para el usuario) ·
//       "noephem" (503: sin efemérides ni internet) · "invalid" (4xx) · "server" (5xx) ·
//       "data" (el servidor no tiene los datos que necesita, ver getHealth).
export class ApiError extends Error {
  constructor(kind, message, { status = null, cause = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.cause = cause;
  }
}

// FastAPI manda `detail` como texto, o como lista de errores de validación (422).
function readDetail(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => [d.loc?.slice(1).join("."), d.msg].filter(Boolean).join(": "))
      .join("; ");
  }
  return "";
}

async function _get(path, { timeout = T_FAST, signal } = {}) {
  const ctrl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, timeout);
  const onAbort = () => ctrl.abort();
  if (signal?.aborted) ctrl.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  // Traduce un fallo de red/cancelación al ApiError que corresponda.
  const asFailure = (e) => {
    if (timedOut) return new ApiError("timeout", `Sin respuesta en ${timeout / 1000} s`);
    if (signal?.aborted || ctrl.signal.aborted) return new ApiError("aborted", "Cancelado");
    return new ApiError("network", e?.message || "Sin conexión", { cause: e });
  };
  try {
    let r;
    try { r = await fetch(API_BASE + path, { signal: ctrl.signal }); }
    catch (e) { throw asFailure(e); }
    if (!r.ok) {
      let detail = "";
      try { detail = readDetail((await r.json()).detail); } catch { /* sin body JSON */ }
      const kind = r.status === 503 ? "noephem" : r.status >= 500 ? "server" : "invalid";
      throw new ApiError(kind, detail || `HTTP ${r.status}`, { status: r.status });
    }
    try { return await r.json(); }
    catch (e) {
      if (timedOut || ctrl.signal.aborted) throw asFailure(e);
      throw new ApiError("server", "Respuesta inválida del servidor", { cause: e });
    }
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// Sitios semilla para poblar selectores / mapa.
export function getSites({ signal } = {}) {
  return _get("/api/sites", { signal });
}

// Máscara de horizonte h(az) (cacheada por sitio, no depende de la fecha).
export function getMask(lat, lon, { signal, timeout = T_HEAVY } = {}) {
  return _get(`/api/mask?lat=${lat}&lon=${lon}`, { timeout, signal });
}

// Tracks de Sol/Tierra + métricas + cartuchos para una ventana.
export function getSite(lat, lon, { date, windowDays, marginDeg, signal, timeout = T_HEAVY } = {}) {
  const p = new URLSearchParams({ lat, lon });
  if (date) p.set("date", date);
  if (windowDays != null) p.set("window_days", windowDays);
  if (marginDeg != null) p.set("comms_margin_deg", marginDeg);
  return _get(`/api/site?${p.toString()}`, { timeout, signal });
}

// URL del raster de fondo del mapa (para H3).
export function mapUrl(metric = "illumination") {
  return `${API_BASE}/api/map?metric=${metric}`;
}

// Geo-metadatos del fondo (bounds + proyección) para ubicar marcadores (H3).
export function getMapMeta(metric = "illumination", { signal } = {}) {
  return _get(`/api/map/meta?metric=${metric}`, { signal });
}

// ¿Tiene el servidor los datos que necesita (DEM y rasters)? Un backend viejo sin este
// endpoint (404) se da por listo: no bloquea la entrada.
export async function getHealth({ signal } = {}) {
  try {
    return await _get("/api/health", { signal });
  } catch (e) {
    if (e.status === 404) return { ready: true, missing: [], warnings: [] };
    throw e;
  }
}
