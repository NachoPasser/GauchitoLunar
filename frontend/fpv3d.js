// Render 3D de primera persona: terreno real (parche de DEM) iluminado por el Sol.
// Rompe a propósito el invariante "Sin 3D" (decisión de producto, ver plan). Usa
// Three.js vendorizado. Marco mundo: X=Este, Y=Arriba, Z=Norte (mano derecha). El
// azimut A (0=N horario) → dirección (sin A, 0, cos A).
//
// Paso 2 (este archivo): escena + malla del parche + cámara + 1 luz direccional fija,
// SIN sombras. Sol real, sombras y sincronización llegan en pasos siguientes.

import * as THREE from "./vendor/three.module.js";

const SKY_BG = 0x05070f;
const EYE_HEIGHT_M = 2.0;            // altura del ojo sobre el sitio
const HFOV_DEG = 90;                 // FOV horizontal (coincide con AZ_WIN_WIDTH)

// base64 (float32 LE) → Float32Array.
function decodeHeights(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Float32Array(bytes.buffer);
}

// Malla del heightfield. z row-major [i=norte, j=este]; mundo X=este, Z=norte.
function buildGeometry(z, res, sizeM) {
  const seg = sizeM / (res - 1), half = sizeM / 2;
  const pos = new Float32Array(res * res * 3);
  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      const v = (i * res + j) * 3;
      pos[v] = -half + j * seg;        // X = Este
      pos[v + 1] = z[i * res + j];     // Y = Arriba (altura rel. al sitio)
      pos[v + 2] = -half + i * seg;    // Z = Norte
    }
  }
  const idx = [];
  for (let i = 0; i < res - 1; i++) {
    for (let j = 0; j < res - 1; j++) {
      const a = i * res + j, b = a + 1, c = a + res, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export function createFpv3d(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY_BG);

  const camera = new THREE.PerspectiveCamera(60, 2, 1, 400000);
  camera.position.set(0, EYE_HEIGHT_M, 0);
  let heading = 0;                     // azimut de mira (grados)

  // Luz direccional (Sol) + relleno ambiente tenue (legibilidad de zonas en sombra).
  const sun = new THREE.DirectionalLight(0xfff6e8, 2.6);
  scene.add(sun);
  scene.add(new THREE.AmbientLight(0x2a3550, 0.25));

  const mat = new THREE.MeshStandardMaterial({
    color: 0x9a9a97, roughness: 1, metalness: 0, side: THREE.DoubleSide,
  });
  let mesh = null;

  function setSun(azDeg, elDeg) {
    const a = (azDeg * Math.PI) / 180, e = (elDeg * Math.PI) / 180;
    // Dirección HACIA el Sol en mundo (X=E, Y=Up, Z=N).
    sun.position.set(Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e));
    sun.position.multiplyScalar(1e5);
    sun.target.position.set(0, 0, 0);
    sun.target.updateMatrixWorld();
  }

  function aimCamera() {
    const a = (heading * Math.PI) / 180;
    camera.lookAt(camera.position.x + Math.sin(a), camera.position.y,
                  camera.position.z + Math.cos(a));
  }
  function setHeading(azDeg) { heading = azDeg; aimCamera(); }

  function resize() {
    const w = canvas.clientWidth || 760, h = canvas.clientHeight || 340;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // FOV vertical para lograr HFOV_DEG horizontal según el aspecto.
    const hfov = (HFOV_DEG * Math.PI) / 180;
    camera.fov = (2 * Math.atan(Math.tan(hfov / 2) / camera.aspect) * 180) / Math.PI;
    camera.updateProjectionMatrix();
  }

  function setPatch(data) {
    const z = decodeHeights(data.z_b64);
    const sizeM = 2 * data.radius_km * 1000;
    if (mesh) { mesh.geometry.dispose(); scene.remove(mesh); }
    mesh = new THREE.Mesh(buildGeometry(z, data.res, sizeM), mat);
    scene.add(mesh);
    setSun(135, 10);          // placeholder (paso 2); el Sol real llega en el paso 3
    resize();
    aimCamera();
  }

  function render() { renderer.render(scene, camera); }

  function dispose() {
    if (mesh) mesh.geometry.dispose();
    mat.dispose();
    renderer.dispose();
  }

  return { setPatch, setSun, setHeading, resize, render, dispose, camera };
}
