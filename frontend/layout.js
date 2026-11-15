// layout.js — tamaño del mapa y del detalle. Se diseña UNA vez a tamaño de referencia (mapa
// cuadrado de MAP_H, detalle de DET_W × MAP_H: misma altura siempre, cargue o no el
// contenido) y todo el conjunto (logo + mapa + detalle) se ESCALA en proporción para que
// entre en la ventana. No hay layouts distintos: achicar la ventana achica todo parejo,
// hasta MIN_SCALE; por debajo la página scrollea (no se apunta a celulares).
// Publica --map-h y --det-w en <html> y aplica transform: scale al <main>.

export const MAP_H = 778, DET_W = 680;          // tamaño de referencia (px)
const GAP = 24;                                  // separación mapa ↔ detalle (1.5rem)
const REF_W = MAP_H + GAP + DET_W;               // ancho de la fila con el detalle abierto
const SIDE_PAD = 32;                             // aire lateral mínimo
// Alto de referencia: logo 108 + mapa + patas del lander 56 + padding inferior 40.
const REF_H = 108 + MAP_H + 56 + 40;
export const MIN_SCALE = 0.6;

let scale = 1;
export const getScale = () => scale;

export function computeScale(viewW, viewH) {
  const s = Math.min(1, (viewW - SIDE_PAD) / REF_W, viewH / REF_H);
  return Math.max(MIN_SCALE, s);
}

export function initLayout() {
  const root = document.documentElement;
  const main = document.querySelector("main");
  root.style.setProperty("--map-h", `${MAP_H}px`);
  root.style.setProperty("--det-w", `${DET_W}px`);
  const apply = () => {
    scale = computeScale(root.clientWidth, window.innerHeight);
    main.style.transformOrigin = "top center";
    main.style.transform = scale < 1 ? `scale(${scale})` : "";
    // transform no reduce la caja de layout: el <main> se deja con su alto ya escalado (el
    // contenido sobrante se dibuja igual, y queda dentro tras el scale). Un margin negativo
    // no sirve: se colapsa con el del <body> y no le reduce el alto → scroll de más.
    main.style.height = "";
    const natural = main.offsetHeight;
    main.style.height = scale < 1 ? `${natural * scale}px` : "";
  };
  apply();
  window.addEventListener("resize", apply);
}
