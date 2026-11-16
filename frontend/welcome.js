// welcome.js — bienvenida (welcome.html + lógica de script.js) frente a la luna en
// map.html, que es la página de entrada. showWelcome({ ready }) la muestra sobre una capa que
// tapa la luna y devuelve una promesa que se resuelve cuando el usuario fija las fechas, el
// mapa terminó de cargar y la capa se quita. Mismo documento que el mapa: el rango queda
// directo en state.js.
//
// Espera del mapa: `ready(onProgress)` es una promesa con las cargas REALES del mapa (map.js).
// Al enviar las fechas:
//  · si ya cargó (lo normal: carga mientras se lee el tutorial) se pasa de inmediato;
//  · si falta algo, el loader aparece recién a los LOADER_DELAY_MS (así no parpadea) y se va
//    cuando termina la última carga: la espera dura lo que realmente tarde;
//  · si algo FALLA (API caída, imagen que no carga) se muestra el error con "Reintentar".
//    Que tarde no es un fallo: no hay tope de tiempo, se espera con el loader a que cargue.

import { initWelcome } from "./script.js";
import { ApiError } from "./api.js";
import { errorMessage } from "./errors.js";
import { setRango } from "./state.js";
import { DEFAULT_START, DEFAULT_SPAN_DAYS, addDays } from "./dates.js";

const LOADER_DELAY_MS = 200;    // cuánto esperar antes de mostrar el loader
const SLOW_NOTICE_MS = 10000;   // desde cuándo se avisa que la carga tarda (solo informa)
const MIN_FEEDBACK_MS = 650;    // el aviso "ventana cargada" se deja leer este mínimo

const T = (key, vars) => (window.i18n ? window.i18n.t(key, vars) : key);
const wait = (ms) => new Promise((res) => setTimeout(res, ms));

let fragment = null;   // markup cacheado: se pide una sola vez

async function mountWelcome(root, { onSubmit } = {}) {
  if (fragment == null) {
    let r;
    try { r = await fetch("welcome.html"); }
    catch (e) { throw new ApiError("network", e.message, { cause: e }); }
    if (!r.ok) throw new ApiError("server", `welcome.html: HTTP ${r.status}`, { status: r.status });
    fragment = await r.text();
  }
  root.innerHTML = fragment;
  window.i18n?.apply(root);                 // traduce el fragmento recién insertado
  return initWelcome(root, { onSubmit });
}

export async function showWelcome({ ready } = {}) {
  // Capa sin velo ni backdrop-filter (re-desenfocar el mapa en cada frame era lento): deja
  // ver el cielo de la página. Mientras está visible el mapa no se pinta (visibility:hidden
  // mantiene el layout; map.js sigue cargando detrás).
  const scrim = document.createElement("div");
  scrim.id = "welcome-layer";
  scrim.style.cssText = "position:fixed;inset:0;z-index:60;overflow:auto;display:flex;" +
    "align-items:center;justify-content:center;padding:1.5rem;" +
    "transition:opacity .35s;";
  const covered = document.querySelectorAll("body > header, body > main");
  covered.forEach((el) => { el.style.visibility = "hidden"; });
  document.body.appendChild(scrim);
  document.documentElement.classList.remove("booting");   // ya lo oculta esta capa (inline)

  return new Promise((resolve) => {
    let handle = null;
    let busy = false;                       // evita envíos dobles mientras se espera
    const root = document.createElement("div");
    root.className = "w-full flex justify-center";
    scrim.appendChild(root);

    // El mapa vuelve a pintarse y la capa se desvanece sobre él.
    function close() {
      covered.forEach((el) => { el.style.visibility = ""; });
      scrim.style.opacity = "0";
      scrim.style.pointerEvents = "none";
      setTimeout(() => { handle?.destroy(); scrim.remove(); resolve(); }, 350);
    }

    async function attempt() {
      const t0 = performance.now();
      handle.clearError();
      const gate = Promise.resolve(ready?.((done, total) => handle.setProgress(done, total)));
      const settledFast = await Promise.race([
        gate.then(() => true, () => true),          // terminó (bien o mal) antes del umbral
        wait(LOADER_DELAY_MS).then(() => false),
      ]);
      if (!settledFast) handle.setLoading(true);    // recién ahora se ve el loader

      // Sin tope de tiempo: las imágenes del mapa pueden tardar en una conexión lenta y
      // reintentar no las acelera, así que se espera con el loader hasta que carguen. Solo se
      // corta con un fallo real: los pedidos a la API traen su propio timeout y la imagen
      // rechaza si da error de carga.
      // Si se alarga, un aviso informativo (no es un error ni ofrece reintentar).
      const slowTimer = setTimeout(() => handle.setSlow(true), SLOW_NOTICE_MS);
      try {
        await gate;
      } catch (e) {
        handle.setLoading(false);
        handle.showError(errorMessage(e), start);
        busy = false;
        return;
      } finally {
        clearTimeout(slowTimer);
      }
      const rest = MIN_FEEDBACK_MS - (performance.now() - t0);
      if (rest > 0) await wait(rest);
      close();
    }

    // Inicia (o reintenta) la espera; ignora clics mientras hay una en curso.
    function start() {
      if (busy) return;
      busy = true;
      attempt();
    }

    // Si el fragmento de la bienvenida no se puede cargar NO se deja la pantalla en blanco:
    // se ofrece reintentar o entrar igual con las fechas por defecto.
    function mount() {
      mountWelcome(root, { onSubmit: start }).then(
        (h) => { handle = h; }, (e) => fallback(e, T("w.fallback.reason")));
    }

    function fallback(err, note = "") {
      root.innerHTML = `
        <div class="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl" role="alert">
          <p class="text-lg font-bold text-slate-900">${T("w.fallback.title")}</p>
          <p class="mt-2 text-sm text-slate-600"></p>
          <div class="mt-5 flex justify-center gap-3">
            <button type="button" data-a="retry" class="px-4 py-2 rounded-lg bg-[#0032A0]
              hover:bg-[#E03C31] text-white text-xs font-bold uppercase tracking-wider
              cursor-pointer">${T("w.fallback.retry")}</button>
            <button type="button" data-a="enter" class="px-4 py-2 rounded-lg border
              border-slate-300 text-slate-700 text-xs font-bold uppercase tracking-wider
              cursor-pointer hover:border-[#0032A0]">${T("w.fallback.enter")}</button>
          </div>
        </div>`;
      root.querySelector("p.text-sm").textContent = note || errorMessage(err);
      root.querySelector('[data-a="retry"]').onclick = () => { root.innerHTML = ""; mount(); };
      root.querySelector('[data-a="enter"]').onclick = async () => {
        root.querySelectorAll("button").forEach((b) => { b.disabled = true; });
        root.querySelector("p.text-sm").textContent = T("w.loading.text");  // se espera, sin tope
        setRango(DEFAULT_START, addDays(DEFAULT_START, DEFAULT_SPAN_DAYS));
        const slowTimer = setTimeout(() => {
          const p = root.querySelector("p.text-sm");
          if (p) p.textContent = T("w.loading.slow");
        }, SLOW_NOTICE_MS);
        try { await ready?.(); }
        catch (e) { clearTimeout(slowTimer); fallback(e, errorMessage(e)); return; }
        clearTimeout(slowTimer);
        close();
      };
    }

    mount();
  });
}
