// errors.js — mensaje legible para el usuario a partir de un ApiError (api.js). Un solo lugar
// decide qué se dice en cada tipo de fallo: así el detalle, el Top 3, el mapa y la bienvenida
// hablan igual y ninguno muestra el texto crudo del navegador ("Failed to fetch").

const T = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);

export function errorMessage(e) {
  switch (e?.kind) {
    case "network": return T("err.network");
    case "timeout": return T("err.timeout");
    case "noephem": return T("detail.noEphem");
    case "invalid": return T("err.invalid", { msg: e.message });
    case "server": return T("err.server", { msg: e.message });
    case "data": return e.message;                    // ya viene redactado (ver map.js)
    default: return T("err.generic", { msg: e?.message ?? String(e) });
  }
}

// Cancelaciones propias (cambió el pedido, se cerró el modal): no son errores para mostrar.
export const isAbort = (e) => e?.kind === "aborted";
