// Proyección del mapa polar: estereográfica polar sur esférica (lat_0=-90).
// Validada al metro contra pyproj en el backend. Convención de azimut 0=N horario
// hacia E se respeta: el polo queda al centro, el norte apunta radialmente hacia
// afuera. El front SOLO ubica/lee puntos; los parámetros vienen de /api/map/meta.
//
// Forward:  ρ = 2R·tan(π/4 + φ/2);  x = ρ·sinλ,  y = ρ·cosλ
// Inverse:  ρ = hypot(x,y);  λ = atan2(x,y);  φ = 2·atan(ρ/2R) − π/2

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export function createProjection(meta) {
  const { R, lon0 } = meta.proj;
  const b = meta.bounds;
  const lon0r = (lon0 || 0) * D2R;

  function lonlatToXY(lon, lat) {
    const lam = lon * D2R - lon0r;
    const rho = 2 * R * Math.tan(Math.PI / 4 + (lat * D2R) / 2);
    return [rho * Math.sin(lam), rho * Math.cos(lam)];
  }

  function xyToLonlat(x, y) {
    const rho = Math.hypot(x, y);
    const lam = Math.atan2(x, y) + lon0r;
    const lat = (2 * Math.atan(rho / (2 * R)) - Math.PI / 2) * R2D;
    let lon = lam * R2D;
    lon = ((lon % 360) + 360) % 360;          // normalizar a [0, 360)
    return [lon, lat];
  }

  // Coordenadas proyectadas → fracción normalizada del lienzo (0..1). v crece hacia
  // abajo (y del raster crece hacia arriba, por eso se invierte).
  function xyToNorm(x, y) {
    return [(x - b.left) / (b.right - b.left), (b.top - y) / (b.top - b.bottom)];
  }

  function normToXY(u, v) {
    return [b.left + u * (b.right - b.left), b.top - v * (b.top - b.bottom)];
  }

  return {
    lonlatToNorm(lon, lat) {
      const [x, y] = lonlatToXY(lon, lat);
      return xyToNorm(x, y);
    },
    normToLonlat(u, v) {
      const [x, y] = normToXY(u, v);
      return xyToLonlat(x, y);
    },
    // Radio normalizado de un paralelo (círculo de latitud) para los anillos.
    latRingRadius(lat) {
      const rho = 2 * R * Math.tan(Math.PI / 4 + (lat * D2R) / 2);
      return rho / (b.right - b.left);        // fracción del ancho total
    },
    lonlatToXY,
    xyToLonlat,
  };
}
