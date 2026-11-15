// icons.js — íconos SVG de sitio (no emoji), compartidos por el mapa y el Top 3:
// estrella cobalto = predefinido, chincheta roja = del usuario. `size` = alto en px.

export function siteIcon(kind, size = 24) {
  if (kind === "pin") {
    const w = Math.round(size * 22 / 28);
    return `<svg width="${w}" height="${size}" viewBox="0 0 22 28" aria-hidden="true">` +
      `<path d="M11 27C11 27 20 16 20 10a9 9 0 10-18 0c0 6 9 17 9 17z" ` +
      `fill="#E03C31" stroke="#fff" stroke-width="2"/>` +
      `<circle cx="11" cy="10" r="3.2" fill="#fff"/></svg>`;
  }
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true">` +
    `<path d="M12 2l2.6 6.3 6.8.5-5.2 4.4 1.7 6.6L12 16.9 6.1 20.3l1.7-6.6L2.6 9.3l6.8-.5z" ` +
    `fill="#0032a0" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
