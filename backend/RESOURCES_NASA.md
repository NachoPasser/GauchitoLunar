# Resources del reto (revisión H0)

> Ítem del H0: "revisar la pestaña Resources del reto por si la NASA apunta a un
> dataset/API específico". La página oficial no se pudo traer directo (cert SSL en
> el entorno); esto sale de búsqueda web + repos de otros equipos del mismo reto.
> **Verificar contra la pestaña Resources oficial antes de la demo.**

Reto: https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/

## Lo que la NASA parece apuntar

- **Topografía:** LRO **LOLA** gridded elevation. Se menciona `LDEM_85S_20M`
  (PDS Geosciences Node) y DEMs de alta resolución del polo sur (GSFC).
- **Efemérides:** **JPL Horizons**, efeméride **DE441**, orientación lunar con
  libración. (Coincide con nuestro plan de Horizons.)
- **Imágenes:** mosaico LROC WAC vía NASA SVS CGI Moon Kit (color del globo).
- **Iluminación:** mapas de promedio de largo plazo de iluminación solar y
  visibilidad de la Tierra (lo que ya bajamos de PGDA).
- **Coordenadas de sitios:** NASA 2025 Lunar Surface Data Book (centros de las
  regiones LOLA nombradas) → usar para afinar los sitios semilla (§4.5).

## Discrepancias con el SPEC (decidir en equipo)

1. **DEM:** el reto cita `LDEM_85S_20M` (20 m, 85°S). Nuestro SPEC usa
   `LDEM_80S_80MPP_ADJ` (80 m, 80°S) por peso/velocidad en 48 h. El de 80 m sigue
   siendo válido y más liviano; el de 20 m es la fuente "oficial" si hace falta
   precisión. Mantener 80 m para el MVP, anotar 20 m como mejora.
2. **Efeméride:** reto dice **DE441**, SPEC dice DE421. Diferencia despreciable
   para az/el al nivel de esta app, pero conviene pedir DE441 a Horizons para
   alinear con la fuente oficial. (Hoy el cache usa el default de Horizons.)
3. **Globo/color:** SVS CGI Moon Kit es opcional (solo estética del inset).

## Decisión (equipo, H0)

- **DEM: queda en 80 m (`LDEM_80S_80MPP_ADJ`).** El de 20 m solo si hace falta precisión.
- **Efeméride: DE441.** Es la que Horizons declara en su respuesta real (`{source: DE441}`,
  ver `tests/fixtures/horizons_earth_sample.txt`); `constants.EPHEMERIS` coincide y hay test.

## Acción pendiente

- Afinar coords de sitios semilla contra el Lunar Surface Data Book 2025.
- Confirmar todo contra la pestaña Resources oficial cuando haya red sin bloqueo.
