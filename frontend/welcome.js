// welcome.js — bienvenida (welcome.html + lógica de script.js) frente a la luna en
// map.html, que es la página de entrada. showWelcome() la muestra sobre un velo que tapa
// la luna y devuelve una promesa que se resuelve cuando el usuario fija las fechas y la
// capa se quita. Mismo documento que el mapa: el rango queda directo en state.js.

import { initWelcome } from "./script.js";

let fragment = null;   // markup cacheado: se pide una sola vez

async function mountWelcome(root, { onSubmit } = {}) {
  fragment ??= await (await fetch("welcome.html")).text();
  root.innerHTML = fragment;
  return initWelcome(root, { onSubmit });
}

export async function showWelcome() {
  // Capa sin velo ni backdrop-filter (re-desenfocar el mapa en cada frame era lento): deja
  // ver el cielo de la página. Mientras está visible el mapa no se pinta (visibility:hidden mantiene el layout; map.js sigue
  // cargando detrás).
  const scrim = document.createElement("div");
  scrim.id = "welcome-layer";
  scrim.style.cssText = "position:fixed;inset:0;z-index:60;overflow:auto;display:flex;" +
    "align-items:center;justify-content:center;padding:1.5rem;" +
    "transition:opacity .35s;";
  const covered = document.querySelectorAll("body > header, body > main");
  covered.forEach((el) => { el.style.visibility = "hidden"; });
  document.body.appendChild(scrim);

  return new Promise((resolve) => {
    let handle = null;
    const root = document.createElement("div");
    root.className = "w-full flex justify-center";
    scrim.appendChild(root);
    mountWelcome(root, {
      onSubmit: () => {
        // El mapa vuelve a pintarse y el velo se desvanece sobre él.
        covered.forEach((el) => { el.style.visibility = ""; });
        scrim.style.opacity = "0";
        scrim.style.pointerEvents = "none";
        setTimeout(() => { handle?.destroy(); scrim.remove(); resolve(); }, 350);
      },
    }).then((h) => { handle = h; });
  });
}
