// Resuelve y persiste la base del backend (modo dev). Script CLÁSICO: corre antes
// que los módulos ES, así window.API_BASE ya está cuando api.js se evalúa.
//
// Acepta ?api=ORIGEN una sola vez, lo SANITIZA a http(s)://host[:puerto] (descarta
// cualquier cola) y lo guarda en localStorage para que persista entre páginas sin
// arrastrarlo por la URL (eso lo compondría en navegaciones sucesivas).
(function () {
  var raw = new URLSearchParams(location.search).get("api");
  var clean = null;
  if (raw) {
    var m = raw.match(/^https?:\/\/[\w.-]+(?::\d+)?/);   // solo el origen
    clean = m && m[0];
  }
  if (clean) {
    try { localStorage.setItem("lln.api", clean); } catch (e) { /* modo privado */ }
  }
  var stored = null;
  try { stored = localStorage.getItem("lln.api"); } catch (e) { /* modo privado */ }
  // En producción (no localhost) usa el mismo origen; en dev apunta al backend local.
  var isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
  var devDefault = "http://127.0.0.1:8000";
  var prodDefault = location.origin;
  window.API_BASE = clean || stored || (isLocal ? devDefault : prodDefault);
})();
