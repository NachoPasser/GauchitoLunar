// i18n.js — motor de idioma ES/EN (script CLÁSICO, expone window.i18n).
// Detección: localStorage > ?lang > navigator.language (default EN si no es ES).
// Aplica textos vía [data-i18n] (textContent), [data-i18n-html] (innerHTML) y
// [data-i18n-attr="attr:key;attr2:key2"]. Monta un toggle ES|EN fijo en toda página.
// Los módulos (map.js, detail.js…) leen window.i18n y escuchan el evento
// 'i18n:change' para re-renderizar lo que generan por JS. Las claves de las vistas
// que aún no se migraron se agregan en piezas siguientes; por ahora: bienvenida.
(function () {
  const STORE = "lln.lang";

  // Catálogo. Valores pueden pasar de 100 cols: son datos de traducción, no lógica.
  const DICT = {
    es: {
      "locale.date": "es-AR",
      "nav.introSteps": "Pasos de introducción",
      "w.step1.title": "¡Bienvenido, explorador!",
      "w.step1.p1": 'El <strong class="font-semibold text-slate-900">Polo Sur de la Luna</strong> es uno de los lugares más fascinantes para la futura exploración lunar. Pero <span class="text-[#0032A0] font-medium">¿dónde deberíamos aterrizar?</span>',
      "w.step1.p2": "¡Exploremos la superficie lunar y descubramos qué lugares ofrecen las mejores condiciones para llevar a cabo una misión exitosa!",
      "w.step1.ready": "LISTO PARA INICIAR SECUENCIA",
      "w.step1.cta": "EXPLORAR CONDICIONES",
      "w.step2.title": "Dos factores clave.",
      "w.step2.sub": "Encontrar el lugar adecuado requiere evaluar dos condiciones fundamentales para una futura misión lunar.",
      "w.step2.f1.title": "1. Energía solar",
      "w.step2.f1.body": '<strong class="text-slate-900 font-medium">¿Cuánta luz solar recibe cada ubicación?</strong> Analizá los períodos de iluminación, los ángulos de incidencia y la energía solar disponible.',
      "w.step2.f2.title": "2. Visibilidad de la Tierra",
      "w.step2.f2.body": '<strong class="text-slate-900 font-medium">¿Durante cuánto tiempo permanece la Tierra visible desde cada ubicación?</strong> Evaluá las ventanas de visibilidad y las oportunidades de comunicación directa.',
      "w.back": "← VOLVER",
      "w.step2.cta": "DEFINIR PERÍODO",
      "w.step3.title": "¿Cuándo deberíamos comenzar?",
      "w.step3.sub": "Elige un período de tiempo para tu análisis. Lo utilizaremos para comparar los posibles lugares de aterrizaje e identificar las ubicaciones más prometedoras.",
      "w.step3.window": "Ventana operativa (Límite: 30 días)",
      "w.step3.startLabel": "Fecha de inicio",
      "w.step3.endLabel": "Fecha de fin",
      "w.analyze": "ANALIZAR",
      "w.suggestions": "Sugerencias:",
      "w.preset14": "14 días (Medio ciclo)",
      "w.preset30": "30 días (Ciclo lunar completo)",
      "w.step3.back": "← FACTORES CLAVE",
      "w.feedback.close": "Cerrar aviso",
      "w.duration.empty": "DURACIÓN: — / {max} DÍAS",
      "w.duration.value": "DURACIÓN: {n} / {max} DÍAS",
      "w.duration.exceed": "EXCEDE LÍMITE ({n} DÍAS)",
      "w.fb.limitApplied.title": "LÍMITE DE 30 DÍAS APLICADO",
      "w.fb.limitApplied.body": 'La fecha de fin se ajustó automáticamente al máximo permitido de <strong>{max} días</strong> desde el inicio.',
      "w.fb.durationExceeded.title": "DURACIÓN EXCEDIDA",
      "w.fb.durationExceeded.body": 'La misión no puede durar más de <strong>{max} días</strong> (un ciclo lunar completo). Seleccioná una fecha de fin igual o anterior al <strong>{date}</strong>.',
      "w.fb.invalidRange.title": "RANGO INVÁLIDO",
      "w.fb.invalidRange.bodyBefore": "La fecha de fin no puede ser anterior a la fecha de inicio de la misión.",
      "w.fb.invalidRange.bodyAfter": "La fecha de fin debe ser posterior o igual a la fecha de inicio.",
      "w.fb.incomplete.title": "FECHAS INCOMPLETAS",
      "w.fb.incomplete.body": "Seleccioná tanto la fecha de inicio como la fecha de fin para iniciar la simulación.",
      "w.fb.missionExceeded.title": "LÍMITE DE MISIÓN EXCEDIDO",
      "w.fb.missionExceeded.body": 'La misión no puede durar más de <strong>{max} días</strong> (seleccionaste {n} días). Reducí el período para continuar.',
      "w.fb.loaded.title": "VENTANA CARGADA EN MATRIZ",
      "w.fb.loaded.body": 'Analizando sitios en el Polo Sur del <strong class="font-[\'JetBrains_Mono\'] text-[#0032A0]">{from}</strong> al <strong class="font-[\'JetBrains_Mono\'] text-[#0032A0]">{to}</strong> ({n} días)...',
      "common.close": "Cerrar",
      "common.sun": "Sol",
      "common.earth": "Tierra",
      "map.title": "Mapa polar sur · Lunar Landing Site Navigator",
      "map.addSite": "Agregar sitio",
      "map.bgAlt": "Mapa de luz promedio del polo sur lunar",
      "map.legend.seed": "Predefinido",
      "map.legend.yours": "Tuyo",
      "map.legend.active": "Activo",
      "map.compare": "🏆 Comparar",
      "map.compareBtn": "COMPARAR",
      "map.compareTitle": "Comparar sitios",
      "map.zoomOut": "Alejar (−)",
      "map.zoomOutShort": "Alejar",
      "map.zoomLevel": "Nivel de zoom",
      "map.zoomIn": "Acercar (+)",
      "map.zoomInShort": "Acercar",
      "map.zoomReset": "Restablecer zoom (1.0×)",
      "map.zoomResetShort": "Restablecer zoom",
      "map.poleS": "polo S",
      "map.loadError": "No se pudo cargar el mapa (¿backend activo?): {msg}",
      "top3.title": "Top 3 · dónde aterrizar",
      "top3.sub": "Ranking de todos los sitios según el criterio elegido.",
      "top3.tab.comms": "Comunicación",
      "top3.tab.energy": "Energía solar",
      "top3.tab.mixed": "Mixto",
      "t3.tag": "RANKING DE SITIOS DE ATERRIZAJE",
      "t3.criteria": "Criterios",
      "t3.prev": "Criterio anterior",
      "t3.next": "Siguiente criterio",
      "t3.stage": "Top 3 por criterio",
      "t3.pill.comms": "Comunicación con la Tierra",
      "t3.th.pos": "POS",
      "t3.th.site": "SITIO CANDIDATO",
      "t3.th.mixed": "ÍNDICE MIXTO",
      "t3.th.energy": "ENERGÍA (kWh/m²)",
      "t3.th.comms": "TIERRA A LA VISTA",
      "t3.th.detail": "DETALLE",
      "t3.table.aria": "Tabla de posiciones completa",
      "t3.tableEyebrow": "TABLA DE POSICIONES",
      "t3.comms.title": "Top 3 — Comunicación directa con la Tierra",
      "t3.comms.sub": "Clasificación según el tiempo total de línea de vista directa con la Tierra durante la ventana de tiempo elegida.",
      "t3.energy.title": "Top 3 — Energía solar captada",
      "t3.energy.sub": "Clasificación según la energía solar total que recibiría un panel solar apoyado en el suelo durante la ventana de tiempo elegida.",
      "t3.mixed.title": "Top 3 — Equilibrio entre comunicación y energía",
      "t3.mixed.sub": "Clasificación según el equilibrio entre energía solar total y tiempo de comunicación con la Tierra.",
      "t3.shortWin": " Ventana menor a un ciclo lunar (~29.5 días): valores válidos solo para estas fechas.",
      "t3.window": "VENTANA: {from} – {to} ({n} DÍAS)",
      "t3.windowDays": "VENTANA: {n} DÍAS",
      "t3.kind.pin": "TUYO",
      "t3.kind.seed": "PREDEFINIDO",
      "t3.rank": "PUESTO {n}",
      "t3.detail": "Ver detalle",
      "t3.rowDetail": "DETALLE →",
      "t3.k.commsEyebrow": "Tiempo con la Tierra a la vista (de {h} h)",
      "t3.k.lineOfSight": "LÍNEA DE VISTA",
      "t3.k.longestGap": "Corte más largo",
      "t3.k.solar": "Energía solar",
      "t3.k.energyEyebrow": "Energía captada (panel horizontal)",
      "t3.k.lit": "{pct} CON SOL",
      "t3.k.daily": "Promedio diario",
      "t3.k.earthView": "Tierra a la vista",
      "t3.k.mixedEyebrow": "Índice mixto (comunicación + energía)",
      "t3.noData": "sin datos (no se pudieron cargar sus efemérides)",
      "t3.empty": "Ningún sitio con datos para rankear.",
      "t3.count": "{n} SITIOS EVALUADOS",
      "t3.toggleShow": "VER TABLA DE POSICIONES COMPLETA",
      "t3.toggleHide": "OCULTAR TABLA DE POSICIONES",
      "t3.load.prep": "Preparando el cálculo",
      "t3.load.calc": "Calculando energía y visibilidad de la Tierra",
      "t3.load.n": "{done} / {total} sitios",
      "dr.chipTitle": "Cambiar las fechas del análisis",
      "dr.aria": "Cambiar fechas",
      "dr.noRange": "ELEGIR FECHAS",
      "dr.days": "{n} DÍAS",
      "dr.title": "Ventana de análisis",
      "dr.start": "INICIO",
      "dr.end": "FIN",
      "dr.preset14": "14 días · medio ciclo",
      "dr.preset30": "30 días · ciclo lunar",
      "dr.cancel": "Cancelar",
      "dr.apply": "Aplicar",
      "dr.window": "{n} días de ventana",
      "dr.err.both": "Elegí las dos fechas.",
      "dr.err.order": "El fin no puede ser anterior al inicio.",
      "dr.err.max": "Máximo {max} días (elegiste {n}).",
      "dr.adjusted": "Fin ajustado al máximo de {max} días.",
      "dr.statusError": "No se pudieron actualizar las fechas: {msg}",
      "frame.tab": "POLO SUR LUNAR",
      "w.loading.text": "CARGANDO EL MAPA",
      "w.loading.retry": "REINTENTAR",
      "w.loading.timeout": "El mapa tarda más de lo esperado.",
      "err.network": "No se pudo conectar con el servidor. ¿Está corriendo el backend?",
      "err.timeout": "El servidor tardó demasiado en responder. Probá de nuevo.",
      "err.invalid": "El servidor rechazó el pedido: {msg}",
      "err.server": "El servidor tuvo un problema: {msg}",
      "err.generic": "Ocurrió un error inesperado: {msg}",
      "err.dataMissing": "Al servidor le faltan datos ({missing}). Descargalos con fetch_data.sh y reiniciá el backend.",
      "common.retry": "Reintentar",
      "detail.errorTitle": "No se pudo cargar este sitio",
      "detail.slow": "Esto está tardando más de lo normal: se están descargando las efemérides de este sitio.",
      "t3.partial": "{bad} de {total} sitios sin datos: este ranking es parcial.",
      "t3.retryFailed": "Reintentar esos sitios",
      "t3.allFailed": "No se pudo calcular ningún sitio.",
      "w.fallback.title": "No se pudo cargar la bienvenida",
      "w.fallback.retry": "Reintentar",
      "w.fallback.enter": "Entrar igual",
      "w.fallback.reason": "No se pudo cargar un archivo de la aplicación. Revisá tu conexión e intentá de nuevo.",
      "detail.title": "Detalle de sitio · Skyline",
      "detail.openBtn": "Ver detalle del sitio",
      "detail.siteLabel": "Sitio",
      "detail.delete": "🗑 Eliminar",
      "detail.deleteAria": "Eliminar sitio",
      "detail.rename": "Renombrar sitio",
      "detail.fullsky": "Escala real",
      "detail.fullskyTip": "Normalmente agrandamos las montañas para que se vean bien. Activalo para verlas en su tamaño real, con el cielo completo.",
      "detail.fpv": "Primera persona",
      "detail.fpvTip": "Vista de primera persona: mirás el cielo desde el sitio.",
      "detail.skylineAria": "Skyline: elevación del Sol y la Tierra sobre el horizonte",
      "detail.playAria": "Reproducir la animación del tiempo",
      "detail.pauseAria": "Pausar",
      "detail.renameDup": "Ya existe un sitio con ese nombre",
      "detail.sliderAria": "Instante dentro de la ventana",
      "detail.newSite": "Sitio nuevo",
      "detail.noEphem": "Sin efemérides para este sitio. Probá uno predefinido o conectate a internet.",
      "detail.loadError": "No se pudo cargar (¿backend activo?): {msg}",
      "detail.load.horizon": "Trazando el horizonte desde el DEM",
      "detail.load.ephem": "Bajando efemérides del Sol y la Tierra (JPL Horizons)",
      "detail.load.integrate": "Integrando energía y visibilidad",
      "sky.looking": "mirando {deg}° · {dir}",
      "sky.compass": "N,NE,E,SE,S,SO,O,NO",
      "panel.dayBadge": "DÍA {day} / {total}",
      "panel.state.lit": "con luz",
      "panel.state.dark": "sin luz",
      "panel.state.visible": "con señal",
      "panel.state.hidden": "sin señal",
      "panel.strip.sunTitle": "Días con / sin luz solar",
      "panel.strip.earthTitle": "Días con / sin enlace a la Tierra",
      "panel.strip.segTip": "{n} días seguidos {state}{more}",
      "panel.strip.more": ", o más (sigue fuera de tus fechas)",
      "panel.sun.title": "Sol",
      "panel.sun.value": "Energía acumulada",
      "panel.sun.foot": "Tiempo con luz total",
      "panel.earth.title": "Tierra",
      "panel.earth.value": "Sobre el horizonte",
      "panel.earth.foot": "Tiempo a la vista total",
      "panel.sun.on": "Con luz",
      "panel.sun.off": "En sombra",
      "panel.earth.on": "Enlace",
      "panel.earth.off": "Sin enlace",
      "panel.ev.noEvent": "Sin {what} en la ventana",
      "panel.ev.inPrefix": "{what} en",
      "panel.ev.sunset": "Ocaso",
      "panel.ev.sunrise": "Amanecer",
      "panel.ev.linkOff": "Corte de enlace",
      "panel.ev.linkOn": "Enlace",
      "panel.tip.sunPill": "Si ahora le da el Sol a este punto. Los grados indican cuánto pasa el Sol por encima de las montañas; si son negativos, está escondido detrás.",
      "panel.tip.energy": "Energía que juntó hasta este momento un panel solar de 1 m² apoyado en el piso. Solo crece mientras le da el Sol.",
      "panel.tip.litPct": "Porcentaje del tiempo elegido donde llega el Sol a este punto.",
      "panel.tip.earthClear": "Cuánto asoma la Tierra por encima de las montañas. Si el número es negativo, el relieve la tapa y no hay señal.",
      "panel.tip.earthPct": "Porcentaje del tiempo elegido donde se puede hablar directo con la Tierra, sin satélites de relevo.",
      "panel.tip.sunEvent": "Cuánto falta para que el Sol se esconda tras las montañas, o para que vuelva a salir.",
      "panel.tip.earthEvent": "Cuánto falta para perder la señal con la Tierra, o para recuperarla.",
      "panel.tip.sunStrip": "Cada bloque es una racha seguida de luz (ámbar) o de oscuridad (gris), y su ancho muestra cuánto dura. Las noches largas son las difíciles: hay que aguantarlas con baterías. El signo ≥ marca rachas que siguen más allá de las fechas elegidas.",
      "panel.tip.earthStrip": "Cada bloque es una racha seguida con señal (azul) o sin señal (gris), y su ancho muestra cuánto dura. Un bloque gris largo significa días sin hablar con la Tierra. El signo ≥ marca rachas que siguen más allá de las fechas elegidas.",
      "panel.tip.earthPillBase": "Si desde acá se ve la Tierra. Cuando se ve, se puede hablar con ella directo.",
      "panel.tip.earthPillMargin": " Pedimos que asome al menos {margin}° sobre las montañas.",
    },
    en: {
      "locale.date": "en-US",
      "nav.introSteps": "Introduction steps",
      "w.step1.title": "Welcome, explorer!",
      "w.step1.p1": 'The <strong class="font-semibold text-slate-900">Moon\'s South Pole</strong> is one of the most fascinating places for future lunar exploration. But <span class="text-[#0032A0] font-medium">where should we land?</span>',
      "w.step1.p2": "Let's explore the lunar surface and discover which places offer the best conditions to carry out a successful mission!",
      "w.step1.ready": "READY TO START SEQUENCE",
      "w.step1.cta": "EXPLORE CONDITIONS",
      "w.step2.title": "Two key factors.",
      "w.step2.sub": "Finding the right place means evaluating two fundamental conditions for a future lunar mission.",
      "w.step2.f1.title": "1. Solar energy",
      "w.step2.f1.body": '<strong class="text-slate-900 font-medium">How much sunlight does each location receive?</strong> Analyze illumination periods, incidence angles and the available solar energy.',
      "w.step2.f2.title": "2. Earth visibility",
      "w.step2.f2.body": '<strong class="text-slate-900 font-medium">How long does Earth stay visible from each location?</strong> Assess the visibility windows and the direct communication opportunities.',
      "w.back": "← BACK",
      "w.step2.cta": "SET PERIOD",
      "w.step3.title": "When should we start?",
      "w.step3.sub": "Choose a time period for your analysis. We'll use it to compare the candidate landing sites and identify the most promising locations.",
      "w.step3.window": "Operating window (Limit: 30 days)",
      "w.step3.startLabel": "Start date",
      "w.step3.endLabel": "End date",
      "w.analyze": "ANALYZE",
      "w.suggestions": "Suggestions:",
      "w.preset14": "14 days (Half cycle)",
      "w.preset30": "30 days (Full lunar cycle)",
      "w.step3.back": "← KEY FACTORS",
      "w.feedback.close": "Close notice",
      "w.duration.empty": "DURATION: — / {max} DAYS",
      "w.duration.value": "DURATION: {n} / {max} DAYS",
      "w.duration.exceed": "EXCEEDS LIMIT ({n} DAYS)",
      "w.fb.limitApplied.title": "30-DAY LIMIT APPLIED",
      "w.fb.limitApplied.body": 'The end date was automatically adjusted to the maximum allowed of <strong>{max} days</strong> from the start.',
      "w.fb.durationExceeded.title": "DURATION EXCEEDED",
      "w.fb.durationExceeded.body": 'The mission cannot last more than <strong>{max} days</strong> (one full lunar cycle). Pick an end date on or before <strong>{date}</strong>.',
      "w.fb.invalidRange.title": "INVALID RANGE",
      "w.fb.invalidRange.bodyBefore": "The end date cannot be earlier than the mission start date.",
      "w.fb.invalidRange.bodyAfter": "The end date must be on or after the start date.",
      "w.fb.incomplete.title": "INCOMPLETE DATES",
      "w.fb.incomplete.body": "Select both the start and end date to begin the simulation.",
      "w.fb.missionExceeded.title": "MISSION LIMIT EXCEEDED",
      "w.fb.missionExceeded.body": 'The mission cannot last more than <strong>{max} days</strong> (you selected {n} days). Shorten the period to continue.',
      "w.fb.loaded.title": "WINDOW LOADED INTO MATRIX",
      "w.fb.loaded.body": 'Analyzing sites at the South Pole from <strong class="font-[\'JetBrains_Mono\'] text-[#0032A0]">{from}</strong> to <strong class="font-[\'JetBrains_Mono\'] text-[#0032A0]">{to}</strong> ({n} days)...',
      "common.close": "Close",
      "common.sun": "Sun",
      "common.earth": "Earth",
      "map.title": "South polar map · Lunar Landing Site Navigator",
      "map.addSite": "Add site",
      "map.bgAlt": "Average-light map of the lunar south pole",
      "map.legend.seed": "Preset",
      "map.legend.yours": "Yours",
      "map.legend.active": "Active",
      "map.compare": "🏆 Compare",
      "map.compareBtn": "COMPARE",
      "map.compareTitle": "Compare sites",
      "map.zoomOut": "Zoom out (−)",
      "map.zoomOutShort": "Zoom out",
      "map.zoomLevel": "Zoom level",
      "map.zoomIn": "Zoom in (+)",
      "map.zoomInShort": "Zoom in",
      "map.zoomReset": "Reset zoom (1.0×)",
      "map.zoomResetShort": "Reset zoom",
      "map.poleS": "S pole",
      "map.loadError": "Couldn't load the map (backend running?): {msg}",
      "top3.title": "Top 3 · where to land",
      "top3.sub": "Ranking of all sites by the chosen criterion.",
      "top3.tab.comms": "Communication",
      "top3.tab.energy": "Solar energy",
      "top3.tab.mixed": "Mixed",
      "t3.tag": "LANDING SITE RANKING",
      "t3.criteria": "Criteria",
      "t3.prev": "Previous criterion",
      "t3.next": "Next criterion",
      "t3.stage": "Top 3 by criterion",
      "t3.pill.comms": "Communication with Earth",
      "t3.th.pos": "POS",
      "t3.th.site": "CANDIDATE SITE",
      "t3.th.mixed": "MIXED INDEX",
      "t3.th.energy": "ENERGY (kWh/m²)",
      "t3.th.comms": "EARTH IN VIEW",
      "t3.th.detail": "DETAIL",
      "t3.table.aria": "Full standings table",
      "t3.tableEyebrow": "STANDINGS TABLE",
      "t3.comms.title": "Top 3 — Direct communication with Earth",
      "t3.comms.sub": "Ranked by the total line-of-sight time with Earth during the chosen time window.",
      "t3.energy.title": "Top 3 — Solar energy captured",
      "t3.energy.sub": "Ranked by the total solar energy a solar panel lying flat on the ground would receive during the chosen time window.",
      "t3.mixed.title": "Top 3 — Balance between communication and energy",
      "t3.mixed.sub": "Ranked by the balance between total solar energy and communication time with Earth.",
      "t3.shortWin": " Window shorter than one lunar cycle (~29.5 days): values only apply to these dates.",
      "t3.window": "WINDOW: {from} – {to} ({n} DAYS)",
      "t3.windowDays": "WINDOW: {n} DAYS",
      "t3.kind.pin": "YOURS",
      "t3.kind.seed": "PRESET",
      "t3.rank": "RANK {n}",
      "t3.detail": "View detail",
      "t3.rowDetail": "DETAIL →",
      "t3.k.commsEyebrow": "Time with Earth in view (of {h} h)",
      "t3.k.lineOfSight": "LINE OF SIGHT",
      "t3.k.longestGap": "Longest outage",
      "t3.k.solar": "Solar energy",
      "t3.k.energyEyebrow": "Energy captured (flat panel)",
      "t3.k.lit": "{pct} SUNLIT",
      "t3.k.daily": "Daily average",
      "t3.k.earthView": "Earth in view",
      "t3.k.mixedEyebrow": "Mixed index (communication + energy)",
      "t3.noData": "no data (its ephemerides could not be loaded)",
      "t3.empty": "No site with data to rank.",
      "t3.count": "{n} SITES EVALUATED",
      "t3.toggleShow": "VIEW FULL STANDINGS TABLE",
      "t3.toggleHide": "HIDE STANDINGS TABLE",
      "t3.load.prep": "Preparing the calculation",
      "t3.load.calc": "Calculating energy and Earth visibility",
      "t3.load.n": "{done} / {total} sites",
      "dr.chipTitle": "Change the analysis dates",
      "dr.aria": "Change dates",
      "dr.noRange": "PICK DATES",
      "dr.days": "{n} DAYS",
      "dr.title": "Analysis window",
      "dr.start": "START",
      "dr.end": "END",
      "dr.preset14": "14 days · half cycle",
      "dr.preset30": "30 days · lunar cycle",
      "dr.cancel": "Cancel",
      "dr.apply": "Apply",
      "dr.window": "{n}-day window",
      "dr.err.both": "Pick both dates.",
      "dr.err.order": "The end can't be before the start.",
      "dr.err.max": "Maximum {max} days (you picked {n}).",
      "dr.adjusted": "End adjusted to the {max}-day maximum.",
      "dr.statusError": "Couldn't update the dates: {msg}",
      "frame.tab": "LUNAR SOUTH POLE",
      "w.loading.text": "LOADING THE MAP",
      "w.loading.retry": "RETRY",
      "w.loading.timeout": "The map is taking longer than expected.",
      "err.network": "Couldn't reach the server. Is the backend running?",
      "err.timeout": "The server took too long to respond. Try again.",
      "err.invalid": "The server rejected the request: {msg}",
      "err.server": "The server had a problem: {msg}",
      "err.generic": "An unexpected error occurred: {msg}",
      "err.dataMissing": "The server is missing data ({missing}). Download it with fetch_data.sh and restart the backend.",
      "common.retry": "Retry",
      "detail.errorTitle": "Couldn't load this site",
      "detail.slow": "This is taking longer than usual: this site's ephemerides are being downloaded.",
      "t3.partial": "{bad} of {total} sites have no data: this ranking is partial.",
      "t3.retryFailed": "Retry those sites",
      "t3.allFailed": "No site could be calculated.",
      "w.fallback.title": "Couldn't load the welcome screen",
      "w.fallback.retry": "Retry",
      "w.fallback.enter": "Enter anyway",
      "w.fallback.reason": "An application file failed to load. Check your connection and try again.",
      "detail.title": "Site detail · Skyline",
      "detail.openBtn": "View site detail",
      "detail.siteLabel": "Site",
      "detail.delete": "🗑 Delete",
      "detail.deleteAria": "Delete site",
      "detail.rename": "Rename site",
      "detail.fullsky": "Real scale",
      "detail.fullskyTip": "We usually enlarge the mountains so they're easy to see. Turn this on to view them at their real size, with the full sky.",
      "detail.fpv": "First person",
      "detail.fpvTip": "First-person view: you look at the sky from the site.",
      "detail.skylineAria": "Skyline: elevation of the Sun and Earth above the horizon",
      "detail.playAria": "Play the time animation",
      "detail.pauseAria": "Pause",
      "detail.renameDup": "A site with that name already exists",
      "detail.sliderAria": "Instant within the window",
      "detail.newSite": "New site",
      "detail.noEphem": "No ephemeris for this site. Try a preset one or connect to the internet.",
      "detail.loadError": "Couldn't load (backend running?): {msg}",
      "detail.load.horizon": "Tracing the horizon from the DEM",
      "detail.load.ephem": "Fetching Sun and Earth ephemeris (JPL Horizons)",
      "detail.load.integrate": "Integrating energy and visibility",
      "sky.looking": "looking {deg}° · {dir}",
      "sky.compass": "N,NE,E,SE,S,SW,W,NW",
      "panel.dayBadge": "DAY {day} / {total}",
      "panel.state.lit": "lit",
      "panel.state.dark": "dark",
      "panel.state.visible": "linked",
      "panel.state.hidden": "no link",
      "panel.strip.sunTitle": "Days with / without sunlight",
      "panel.strip.earthTitle": "Days with / without Earth link",
      "panel.strip.segTip": "{n} days in a row {state}{more}",
      "panel.strip.more": ", or more (continues beyond your dates)",
      "panel.sun.title": "Sun",
      "panel.sun.value": "Accumulated energy",
      "panel.sun.foot": "Total time in light",
      "panel.earth.title": "Earth",
      "panel.earth.value": "Above the horizon",
      "panel.earth.foot": "Total time in view",
      "panel.sun.on": "Lit",
      "panel.sun.off": "In shadow",
      "panel.earth.on": "Linked",
      "panel.earth.off": "No link",
      "panel.ev.noEvent": "No {what} in the window",
      "panel.ev.inPrefix": "{what} in",
      "panel.ev.sunset": "Sunset",
      "panel.ev.sunrise": "Sunrise",
      "panel.ev.linkOff": "Link loss",
      "panel.ev.linkOn": "Link",
      "panel.tip.sunPill": "Whether the Sun reaches this point right now. The degrees show how far the Sun clears the mountains; if negative, it's hidden behind them.",
      "panel.tip.energy": "Energy gathered so far by a 1 m² solar panel lying on the ground. It only grows while the Sun is shining on it.",
      "panel.tip.litPct": "Percentage of the chosen time when the Sun reaches this point.",
      "panel.tip.earthClear": "How far Earth rises above the mountains. If the number is negative, the terrain blocks it and there's no signal.",
      "panel.tip.earthPct": "Percentage of the chosen time when you can talk directly to Earth, without relay satellites.",
      "panel.tip.sunEvent": "How long until the Sun hides behind the mountains, or until it rises again.",
      "panel.tip.earthEvent": "How long until the link to Earth is lost, or until it's back.",
      "panel.tip.sunStrip": "Each block is a continuous streak of light (amber) or darkness (grey), and its width shows how long it lasts. Long nights are the hard ones: you ride them out on batteries. The ≥ sign marks streaks that continue beyond the chosen dates.",
      "panel.tip.earthStrip": "Each block is a continuous streak with signal (blue) or without (grey), and its width shows how long it lasts. A long grey block means days without talking to Earth. The ≥ sign marks streaks that continue beyond the chosen dates.",
      "panel.tip.earthPillBase": "Whether Earth is visible from here. When it is, you can talk to it directly.",
      "panel.tip.earthPillMargin": " We require it to rise at least {margin}° above the mountains.",
    },
  };

  function detect() {
    try {
      const saved = localStorage.getItem(STORE);
      if (saved === "es" || saved === "en") return saved;
    } catch { /* modo privado */ }
    const url = new URLSearchParams(location.search).get("lang");
    if (url === "es" || url === "en") return url;
    const nav = (navigator.language || "en").toLowerCase();
    return nav.startsWith("es") ? "es" : "en";
  }

  let lang = detect();

  function t(key, vars) {
    const table = DICT[lang] || DICT.es;
    let s = table[key];
    if (s == null) s = DICT.es[key];
    if (s == null) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m));
    return s;
  }

  function apply(root) {
    root = root || document;
    root.querySelectorAll("[data-i18n]").forEach((el) => {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    root.querySelectorAll("[data-i18n-html]").forEach((el) => {
      el.innerHTML = t(el.getAttribute("data-i18n-html"));
    });
    root.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr").split(";").forEach((pair) => {
        const parts = pair.split(":");
        const attr = (parts[0] || "").trim();
        const key = (parts[1] || "").trim();
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  function setLang(next) {
    if (next !== "es" && next !== "en") return;
    lang = next;
    try { localStorage.setItem(STORE, next); } catch { /* modo privado */ }
    document.documentElement.setAttribute("lang", next);
    apply(document);
    syncToggle();
    document.dispatchEvent(new CustomEvent("i18n:change", { detail: { lang } }));
  }

  // --- Toggle ES|EN fijo (arriba a la derecha). Inline styles: no depende de CSS. ---
  let toggleEl = null;

  function syncToggle() {
    if (!toggleEl) return;
    toggleEl.querySelectorAll("button").forEach((b) => {
      const on = b.dataset.lang === lang;
      b.style.background = on ? "#0032A0" : "transparent";
      b.style.color = on ? "#fff" : "#0032A0";
    });
  }

  function mountToggle() {
    if (toggleEl || !document.body) return;
    toggleEl = document.createElement("div");
    toggleEl.id = "lln-lang-toggle";
    toggleEl.setAttribute("role", "group");
    toggleEl.setAttribute("aria-label", "Idioma / Language");
    toggleEl.style.cssText =
      "position:fixed;top:10px;right:12px;z-index:9999;display:flex;gap:2px;" +
      "font-family:'JetBrains Mono',monospace;font-size:11px;font-weight:600;" +
      "background:#fff;border:1.5px solid #0032A0;border-radius:8px;padding:2px;" +
      "box-shadow:0 2px 8px rgba(0,50,160,.18);user-select:none;";
    ["es", "en"].forEach((code) => {
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.lang = code;
      b.textContent = code.toUpperCase();
      b.style.cssText =
        "cursor:pointer;border:0;border-radius:6px;padding:3px 8px;background:transparent;" +
        "color:#0032A0;line-height:1;";
      b.addEventListener("click", () => setLang(code));
      toggleEl.appendChild(b);
    });
    document.body.appendChild(toggleEl);
    syncToggle();
  }

  window.i18n = {
    get lang() { return lang; },
    t,
    setLang,
    apply,
  };

  function init() {
    document.documentElement.setAttribute("lang", lang);
    apply(document);
    mountToggle();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
