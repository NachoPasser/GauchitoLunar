# MOON SOUTH POLE PLANNER

# 1. Visión general

## 1.1. ¿Qué es Moon South Pole Planner?

Moon South Pole Planner es una herramienta interactiva de visualización y análisis que permite evaluar y comparar diferentes ubicaciones de aterrizaje en el polo sur lunar, considerando dos factores fundamentales para la planificación de misiones:

1. **Disponibilidad de energía solar:** cuánto tiempo recibe luz solar una ubicación y cuánta energía potencial puede obtener mediante paneles solares.
2. **Visibilidad de la Tierra:** durante cuánto tiempo la Tierra permanece visible desde una ubicación, permitiendo establecer comunicaciones directas sin necesidad de satélites retransmisores.

La aplicación busca transformar información astronómica y topográfica compleja en visualizaciones intuitivas que permitan evaluar rápidamente diferentes escenarios de aterrizaje.

El usuario podrá seleccionar ubicaciones sobre un mapa lunar, establecer un período de análisis, comparar resultados y explorar cómo cambian las condiciones en fechas y horarios específicos.

## 1.2. Problema que buscamos resolver

La planificación de misiones al polo sur lunar presenta dificultades particulares debido a su geografía y geometría orbital.

Pequeñas variaciones en la ubicación o en la fecha de aterrizaje pueden producir diferencias importantes en:

- La duración de los períodos de iluminación solar.
- La energía potencialmente disponible.
- Los períodos de oscuridad.
- La visibilidad directa de la Tierra.
- Las ventanas disponibles para establecer comunicaciones.

Aunque existen herramientas que permiten obtener esta información, muchas están orientadas al análisis científico especializado y no facilitan la comparación rápida de múltiples escenarios.

Moon South Pole Planner busca reducir esa complejidad mediante una interfaz visual que conecte los datos científicos con decisiones concretas de planificación.

## 1.3. Objetivo principal

Desarrollar una aplicación que permita comparar rápidamente diferentes combinaciones de ubicación y fecha de aterrizaje en el polo sur lunar, evaluando su potencial energético solar y sus oportunidades de comunicación directa con la Tierra.

## 1.4. Público objetivo

- **Planificadores de misiones:** necesitan comparar ubicaciones y fechas para identificar escenarios favorables.
- **Ingenieros:** necesitan comprender las condiciones de iluminación y comunicación de una ubicación.
- **Educadores y estudiantes:** pueden explorar las particularidades geográficas y astronómicas del polo sur lunar.
- **Público general:** puede comprender visualmente los desafíos de la exploración lunar.

---

# 2. Conceptos fundamentales del proyecto

## 2.1. Los dos factores de evaluación

La aplicación se construye alrededor de dos factores independientes de evaluación.

### A. Energía solar

Representa el potencial de generación de energía solar de una ubicación.

Depende principalmente de:

- Tiempo durante el cual el Sol permanece visible.
- Elevación angular del Sol respecto del horizonte local.
- Orientación de los paneles solares.
- Características del terreno que pueden bloquear la iluminación.

Una ubicación puede recibir luz solar durante muchas horas, pero si el Sol permanece muy cerca del horizonte, el rendimiento de los paneles puede verse afectado.

### B. Comunicación con la Tierra

Representa la posibilidad de mantener comunicación directa entre la ubicación lunar y la Tierra.

Depende de:

- Posición aparente de la Tierra en el cielo lunar.
- Elevación angular de la Tierra respecto del horizonte local.
- Obstáculos topográficos que bloquean la línea de visión.
- Variaciones aparentes de la posición terrestre (libración lunar).

La Tierra puede encontrarse sobre el horizonte geométrico, pero quedar oculta detrás de una elevación del terreno.

## 2.2. El terreno como condicionante

La topografía lunar NO constituye una tercera métrica de evaluación.

Es un factor que condiciona las dos métricas principales.

Por ejemplo:

- Una montaña puede bloquear la luz solar antes del ocaso astronómico.
- El borde de un cráter puede impedir la visibilidad de la Tierra.
- Una pendiente puede modificar el horizonte local y, por lo tanto, las condiciones de iluminación y comunicación.

Por esta razón, la aplicación debe utilizar información topográfica real para calcular las condiciones locales.

---

# 3. Alcance funcional

El proyecto se organiza alrededor de cuatro funcionalidades principales:

1. Exploración de ubicaciones mediante un mapa lunar.
2. Evaluación periódica de diferentes ubicaciones.
3. Comparación de múltiples ubicaciones.
4. Análisis puntual de una ubicación en una fecha y hora determinadas.

---

# 4. Experiencia de usuario (UX)

## 4.1. Flujo general

La experiencia se divide en tres etapas principales.

### Etapa 1: Bienvenida y selección del período

Al ingresar a la aplicación, el usuario encuentra:

- Una breve presentación del propósito de la herramienta.
- Una explicación sencilla de los dos factores evaluados.
- Un selector de fechas para establecer el período de análisis.
- Un botón para comenzar.

El objetivo es que el usuario pueda iniciar un análisis rápidamente, sin necesitar conocimientos astronómicos previos.

**Entrada principal:** fecha de inicio y fecha de finalización.

### Etapa 2: Exploración del mapa lunar

Una vez definido el período, el usuario accede al mapa del polo sur lunar.

En esta pantalla podrá:

- Visualizar todas las ubicaciones predefinidas.
- Identificar rápidamente qué ubicaciones presentan mejores condiciones.
- Agregar ubicaciones personalizadas.
- Seleccionar ubicaciones para compararlas.
- Consultar un ranking de los mejores sitios.

El mapa será el elemento central de la experiencia.

### Etapa 3: Análisis y comparación

El usuario podrá seleccionar una o varias ubicaciones para consultar sus resultados.

Existirán dos niveles de análisis temporal:

- **Vista periódica:** resume las condiciones de una ubicación durante todo el período seleccionado.
- **Vista puntual:** analiza las condiciones de una ubicación en una fecha y hora específicas.

La vista puntual incorpora una visualización del horizonte local que muestra las posiciones aparentes del Sol y la Tierra.

---

# 5. Mapa lunar interactivo

## 5.1. Objetivo

El mapa es el componente visual principal de Moon South Pole Planner.

Debe permitir explorar la geografía real del polo sur lunar y comprender cómo las características del terreno afectan las condiciones de iluminación y comunicación.

## 5.2. Características visuales

El mapa tendrá una representación circular de la región del polo sur lunar.

Debe mostrar:

- Cráteres.
- Elevaciones y montañas.
- Depresiones.
- Pendientes.
- Variaciones de altura del terreno.

Se priorizará la representación topográfica real por encima de una representación artística o meramente ilustrativa.

## 5.3. Fuente de información topográfica

La fuente principal será **Lunar Orbiter Laser Altimeter (LOLA)**.

LOLA proporciona información altimétrica de la superficie lunar que puede utilizarse para:

- Construir el modelo de elevación.
- Representar la topografía.
- Obtener perfiles de terreno.
- Calcular el horizonte local.
- Determinar posibles obstrucciones de la luz solar y de la línea de visión hacia la Tierra.

## 5.4. Ubicaciones disponibles

Existirán tres mecanismos para seleccionar sitios de aterrizaje.

**A. Ubicaciones predefinidas**

El equipo seleccionará una colección inicial de sitios relevantes del polo sur lunar.

Cada ubicación tendrá coordenadas y datos asociados.

**B. Selección mediante el mapa**

El usuario podrá hacer clic sobre cualquier punto del mapa.

La aplicación obtendrá sus coordenadas lunares y realizará el análisis correspondiente.

**C. Ingreso manual de coordenadas**

El usuario podrá ingresar latitud y longitud lunares para analizar una ubicación específica.

## 5.5. Indicadores de calidad

Cada ubicación tendrá un indicador visual de rendimiento mediante un sistema similar a un semáforo:

- Verde: condiciones favorables.
- Amarillo: condiciones intermedias.
- Rojo: condiciones desfavorables.

La clasificación se realizará utilizando los resultados del análisis de energía solar y comunicación.

Los criterios de clasificación deberán ser transparentes y configurables. No se debe presentar un sitio como globalmente favorable sin aclarar qué métricas justifican esa evaluación.

## 5.6. Ranking de ubicaciones

La interfaz permitirá:

- Mostrar las tres mejores ubicaciones.
- Ampliar el ranking a todas las ubicaciones disponibles.
- Seleccionar manualmente sitios para compararlos.
- Actualizar el ranking a medida que se agreguen ubicaciones.

El ranking debe considerar el período de análisis seleccionado.

---

# 6. Vista periódica

## 6.1. Objetivo

La vista periódica permite comprender las condiciones generales de una ubicación durante todo el período seleccionado.

No busca mostrar cada instante, sino resumir el comportamiento energético y de comunicación del sitio.

Su principal utilidad es facilitar la comparación rápida entre diferentes ubicaciones.

## 6.2. Métricas principales

### A. Energía solar potencial

Indicador: energía solar acumulada durante el período.

Unidad recomendada: kWh/m².

También podrá utilizarse kWh cuando se haya definido una superficie de paneles solares y un modelo de conversión energética.

La estimación deberá considerar:

- Tiempo de iluminación.
- Elevación solar.
- Obstrucciones topográficas.
- Orientación de los paneles, cuando esté definida.

### B. Visibilidad de la Tierra

Indicador: porcentaje del período durante el cual la Tierra permanece visible desde la ubicación.

Ejemplo:

Si la Tierra está visible durante 70 horas de un período de 100 horas, el indicador será del 70%.

### C. Noche más larga

Indicador: duración del intervalo continuo más largo durante el cual el sitio permanece sin iluminación solar directa.

Esta métrica es importante porque permite identificar períodos críticos para el almacenamiento energético y la autonomía de los sistemas.

## 6.3. Información complementaria

Se podrán incluir:

- Duración total de iluminación.
- Duración total de oscuridad.
- Cantidad de períodos de iluminación.
- Duración de las ventanas de comunicación.
- Duración del mayor período sin comunicación.

---

# 7. Vista puntual

## 7.1. Objetivo

La vista puntual permite estudiar las condiciones específicas de una ubicación en una fecha y hora determinadas.

Mientras que la vista periódica resume el comportamiento general, esta vista proporciona información detallada sobre un momento concreto.

## 7.2. Métricas principales

### A. Energía solar

Indicador: energía solar potencial correspondiente al intervalo seleccionado.

Se tendrá en cuenta:

- Elevación del Sol.
- Visibilidad solar desde el punto.
- Condiciones topográficas.
- Tiempo de iluminación dentro del intervalo analizado.

### B. Visibilidad de la Tierra

Indicador: porcentaje del intervalo seleccionado durante el cual la Tierra permanece visible.

### C. Tiempo hasta el ocaso

Indicador: tiempo restante hasta que el Sol desaparezca detrás del horizonte local.

Es importante diferenciar el ocaso astronómico del ocaso topográfico: el terreno puede ocultar al Sol antes de que alcance el horizonte geométrico.

Si el Sol ya está oculto, se deberá indicar el tiempo hasta el próximo amanecer o el estado correspondiente.

### D. Tiempo hasta Earthset

Indicador: tiempo restante hasta que la Tierra desaparezca detrás del horizonte local.

Este evento puede producirse por la geometría aparente de la Tierra y por las obstrucciones del terreno.

Si la Tierra ya está oculta, deberá indicarse el tiempo hasta su próxima aparición.

---

# 8. Visualización del horizonte local

## 8.1. Objetivo

La visualización del horizonte es uno de los componentes más importantes y distintivos del proyecto.

Su propósito es mostrar cómo se ven el Sol y la Tierra desde una ubicación específica de la superficie lunar.

No se trata de una visualización global de la Luna, sino de una representación del cielo observado desde el punto de aterrizaje.

## 8.2. Elementos visuales

La visualización deberá mostrar:

- El horizonte local.
- El perfil topográfico que define ese horizonte.
- La posición aparente del Sol.
- La posición aparente de la Tierra.
- La elevación angular de ambos astros.
- Los momentos de salida y ocultamiento.

La representación será una vista horizontal o panorámica del entorno celeste.

El horizonte no debe asumirse como una línea perfectamente plana: debe calcularse utilizando el relieve real que rodea al punto de observación.

## 8.3. Línea de tiempo

La visualización incorporará una línea de tiempo interactiva.

El usuario podrá desplazarse temporalmente para observar cómo cambian las posiciones del Sol y la Tierra.

La línea de tiempo debe:

- Permitir avanzar y retroceder.
- Mostrar la fecha y hora seleccionadas.
- Actualizar las posiciones de los astros.
- Actualizar los indicadores de elevación.
- Mostrar los eventos de ocaso y Earthset.
- Identificar los períodos de iluminación y visibilidad terrestre.

**Importante:** el ciclo solar lunar dura aproximadamente 29,5 días terrestres. Por eso, la línea de tiempo debe trabajar con fechas y horas terrestres reales, y no asumir que un día lunar equivale a 24 horas.

## 8.4. Eventos visuales

Se deberán identificar claramente:

- Sunrise: salida del Sol.
- Sunset: ocultamiento del Sol.
- Earthrise: aparición de la Tierra sobre el horizonte.
- Earthset: ocultamiento de la Tierra.

Estos eventos deben calcularse considerando el horizonte topográfico local.

---

# 9. Comparación entre ubicaciones

## 9.1. Objetivo

Permitir que el usuario compare diferentes sitios de aterrizaje sin tener que consultar individualmente cada uno.

## 9.2. Funcionamiento

El usuario podrá seleccionar múltiples ubicaciones desde el mapa.

A medida que agrega sitios, la aplicación construirá una comparación dinámica.

Se podrá mostrar:

- Energía solar potencial.
- Porcentaje de tiempo con iluminación.
- Noche más larga.
- Porcentaje de tiempo con la Tierra visible.
- Mayor período continuo sin comunicación.

## 9.3. Presentación

Se priorizará una comparación lado a lado mediante tarjetas o paneles.

Cada ubicación deberá mostrar:

- Nombre o identificador.
- Coordenadas.
- Indicador general.
- Métricas principales.
- Posición en el ranking.

La comparación deberá permitir identificar rápidamente las ventajas y desventajas de cada alternativa.

---

# 10. Fuentes de datos científicos

La aplicación utilizará información proveniente de fuentes científicas para garantizar que las visualizaciones y los cálculos tengan una base real.

## 10.1. LOLA — Lunar Orbiter Laser Altimeter

**Función:** información topográfica lunar.

Datos utilizados:

- Modelos digitales de elevación.
- Alturas del terreno.
- Perfiles topográficos.

Aplicaciones:

- Construcción del mapa.
- Representación del relieve.
- Cálculo del horizonte local.
- Detección de obstrucciones.

## 10.2. SPICE — NASA/JPL

**Función:** cálculos astronómicos y geométricos.

Datos utilizados:

- Posiciones de cuerpos celestes.
- Orientación lunar.
- Sistemas de referencia.
- Información temporal y orbital.

Aplicaciones:

- Calcular la posición aparente del Sol.
- Calcular la posición aparente de la Tierra.
- Determinar sus elevaciones respecto del horizonte.
- Simular la evolución temporal de sus posiciones.

## 10.3. JPL Horizons

**Función:** consulta y validación de posiciones astronómicas.

Aplicaciones:

- Contrastar posiciones calculadas.
- Verificar resultados de SPICE.
- Validar escenarios temporales.

## 10.4. NASA Scientific Visualization Studio (SVS)

**Función:** material visual y referencias científicas.

Aplicaciones:

- Contrastar visualizaciones.
- Consultar productos de iluminación.
- Obtener referencias para la representación visual.

## 10.5. Relación entre las fuentes

| Fuente | Información | Aplicación |
|---|---|---|
| LOLA | Altimetría | Mapa y horizonte |
| SPICE | Geometría astronómica | Posiciones del Sol y la Tierra |
| Horizons | Efemérides | Validación |
| SVS | Productos visuales | Contraste y referencias |

---

# 11. Consideraciones técnicas y científicas

## 11.1. Cálculo del horizonte

El horizonte local se calculará utilizando los datos topográficos de LOLA.

Para cada dirección alrededor del punto de observación se deberá determinar la elevación angular del terreno.

Esto permitirá obtener un perfil de horizonte realista.

Una vez calculado, podrá utilizarse para determinar si un astro se encuentra:

- Sobre el horizonte y visible.
- Debajo del horizonte.
- Bloqueado por una elevación del terreno.

## 11.2. Posiciones astronómicas

Las posiciones del Sol y la Tierra deberán calcularse utilizando un sistema de referencia coherente con la ubicación lunar.

No alcanza con utilizar coordenadas globales de los astros: necesitamos obtener su posición aparente desde el punto específico de observación.

Se deberán considerar las variaciones orbitales y la orientación de la Luna.

## 11.3. Cálculo energético

La energía solar potencial no debe calcularse únicamente contando las horas de iluminación.

También es importante considerar el ángulo de incidencia de la radiación sobre los paneles.

Para obtener un valor físico en kWh será necesario definir supuestos sobre los paneles solares, como su superficie, orientación y eficiencia.

Si estos parámetros todavía no están definidos, la aplicación deberá priorizar la irradiación solar acumulada por unidad de superficie (kWh/m²).

## 11.4. Escala temporal

Todos los cálculos deberán utilizar fechas y tiempos astronómicos coherentes.

La aplicación deberá manejar correctamente los sistemas temporales utilizados por SPICE y convertirlos a una representación comprensible para el usuario.

---

# 12. Arquitectura conceptual

La aplicación puede organizarse en cuatro componentes principales.

### A. Frontend

Responsable de la experiencia visual e interacción.

Funciones:

- Bienvenida y selección temporal.
- Mapa lunar interactivo.
- Selección de ubicaciones.
- Ranking.
- Comparaciones.
- Vista periódica.
- Vista puntual.
- Visualización del horizonte.

### B. Motor de datos topográficos

Responsable de procesar la información de LOLA.

Funciones:

- Cargar los modelos de elevación.
- Consultar alturas por coordenadas.
- Construir perfiles topográficos.
- Calcular horizontes locales.

### C. Motor astronómico

Responsable de los cálculos de posiciones y visibilidad.

Funciones:

- Calcular posiciones del Sol y la Tierra.
- Determinar elevaciones angulares.
- Detectar eventos de salida y ocultamiento.
- Calcular ventanas de iluminación.
- Calcular ventanas de comunicación.

### D. Motor de evaluación

Responsable de transformar los resultados científicos en métricas comprensibles.

Funciones:

- Calcular energía solar potencial.
- Calcular porcentajes de visibilidad.
- Calcular períodos de oscuridad.
- Construir rankings.
- Comparar ubicaciones.

---

# 13. Alcance del desarrollo

Para evitar que la complejidad del proyecto se vuelva inmanejable, el desarrollo se dividirá en etapas.

## Etapa 1 — MVP funcional

Objetivo: tener una aplicación capaz de analizar y comparar ubicaciones.

Funcionalidades:

- Mapa del polo sur lunar.
- Topografía real basada en LOLA.
- Ubicaciones predefinidas.
- Selección mediante coordenadas.
- Selección de período.
- Cálculo de las dos métricas principales.
- Vista periódica.
- Ranking de ubicaciones.
- Comparación de múltiples sitios.

## Etapa 2 — Análisis puntual

Objetivo: permitir estudiar condiciones específicas de una ubicación.

Funcionalidades:

- Selector de fecha y hora.
- Métricas puntuales.
- Tiempo hasta el ocaso.
- Tiempo hasta Earthset.
- Elevación del Sol y la Tierra.
- Cálculo del horizonte topográfico local.

## Etapa 3 — Visualización dinámica

Objetivo: hacer comprensible la evolución temporal de las condiciones lunares.

Funcionalidades:

- Vista panorámica del horizonte.
- Representación del Sol y la Tierra.
- Línea de tiempo interactiva.
- Animación de posiciones astronómicas.
- Visualización de eventos de salida y ocultamiento.

## Etapa 4 — Mejoras y precisión

Objetivo: mejorar la calidad científica y ampliar las capacidades de análisis.

Posibles funcionalidades:

- Mayor resolución topográfica.
- Mejoras en los cálculos de libración.
- Modelos energéticos más completos.
- Mayor cantidad de ubicaciones predefinidas.
- Exportación de resultados.
- Comparación avanzada de escenarios.

---

# 14. Principios de diseño

Moon South Pole Planner deberá respetar los siguientes principios:

1. **Claridad antes que complejidad:** los resultados deben ser comprensibles sin conocimientos astronómicos especializados.
2. **Comparación rápida:** el usuario debe poder identificar diferencias entre ubicaciones sin navegar por múltiples pantallas.
3. **Información científicamente fundamentada:** las visualizaciones deben derivarse de datos reales y cálculos verificables.
4. **Topografía real:** el terreno debe influir en los resultados y no ser únicamente decorativo.
5. **Transparencia:** las métricas y sus supuestos deben estar documentados.
6. **Flexibilidad temporal:** cambiar la fecha debe permitir evaluar rápidamente cómo varían las condiciones.
7. **Accesibilidad:** tanto un ingeniero como un estudiante deben poder utilizar la herramienta.

---

# 15. Qué NO busca hacer el proyecto

Para mantener el enfoque, es importante establecer los límites de la aplicación.

Moon South Pole Planner no pretende:

- Diseñar una misión lunar completa.
- Calcular la trayectoria de aterrizaje de una nave.
- Simular el comportamiento físico completo de paneles solares.
- Diseñar sistemas de telecomunicaciones.
- Reemplazar las herramientas científicas especializadas de NASA o JPL.
- Proporcionar una simulación tridimensional físicamente completa de toda la superficie lunar.

Su propósito es evaluar las condiciones ambientales y geométricas de distintas ubicaciones para facilitar la selección de sitios y fechas.

---

# 16. Criterios de éxito

Consideraremos que el proyecto cumple su objetivo si un usuario puede:

1. Seleccionar un período de análisis.
2. Visualizar las ubicaciones disponibles sobre un mapa topográfico lunar.
3. Identificar rápidamente cuáles presentan mejores condiciones.
4. Agregar una ubicación personalizada.
5. Comparar diferentes ubicaciones.
6. Consultar las métricas periódicas de cada sitio.
7. Seleccionar una fecha y hora específicas.
8. Visualizar las posiciones del Sol y la Tierra respecto del horizonte local.
9. Identificar cuánto tiempo falta para el ocaso y Earthset.
10. Comprender cómo pequeñas variaciones geográficas o temporales pueden afectar la viabilidad de una misión.

---

# 17. Identidad del proyecto

**Nombre:** Moon South Pole Planner

**Concepto central:** convertir datos científicos complejos en decisiones visuales y comprensibles.

**Propuesta de valor:**

Una herramienta que permite explorar, comparar y evaluar rápidamente las condiciones de iluminación solar y comunicación directa con la Tierra en posibles sitios de aterrizaje del polo sur lunar.

**Idea que debe transmitir la aplicación:**

No alcanza con encontrar un lugar donde aterrizar. Hay que comprender cuándo recibe luz, cuándo puede comunicarse con la Tierra y cómo el terreno modifica ambas condiciones.

---
