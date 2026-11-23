# Registro de decisiones

Resumen de las decisiones **vigentes**, para empezar cualquier sesión sin volver a preguntar. Cada fila enlaza a su fuente de verdad. Se actualiza en el mismo PR que toma o cambia una decisión; las sustituidas se tachan y se indica su reemplazo.

## Producto y alcance

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | Juego de gestión de esports de LoL para **escritorio** (Windows y Linux), no web. DraftSim solo aporta ideas, no código | [IDEA.md](../../IDEA.md), [inventario de DraftSim](../research/draftsim-inventario.md) |
| 2026-11-19 | **Contenido real de LoL** asumiendo el riesgo; el nombre "Rift Legends" se mantiene; sin assets de Riot en el repo ni en los binarios (descarga en tiempo de ejecución) | [ADR 0001](0001-stack-tecnologico.md), [NOTICE.md](../../NOTICE.md) |
| 2026-11-19 | Primer hito: **draft rápido completo** contra la IA. Primero las ligas top y después las menores. Jugadores reales con regens. Sin despido ni draft local para dos jugadores por ahora. Timeline de partida y después minimapa | [IDEA.md §12](../../IDEA.md), [plan general](../plans/00-plan-general.md) |
| 2026-11-21 | **Scrims** en la Fase 7 (plan 20): peticiones y bloques automáticos, mejoran forma, química, campeones, preparación y meta, revelan información en ambos sentidos y se pueden jugar con draft propio | [IDEA §8](../../IDEA.md#8-novedades-respecto-a-draftsim) |
| 2026-11-22 | El usuario es el **manager** y contrata al **staff** (head coach, assistant coach, analistas, coaches por posición y psicólogo). Antes de cada serie elige si draftea él, con sugerencias del assistant coach, o si delega en el head coach. **Finanzas** con ingresos, gastos, sueldos, primas, traspasos, buyouts y reglas salariales por liga. Cada rol de staff mejora un solo sistema, visible en el desglose | [IDEA §5 y §7](../../IDEA.md#5-rol-del-jugador), planes 29 y 30 |
| 2026-11-22 | **Nacionalidad e idioma** de jugadores y staff, con bandera. Idioma de trabajo por equipo: quien no lo habla comunica peor y baja la química hasta que lo aprende; compartir nacionalidad suma química. Plazas de importados y residencia por liga | [IDEA §7](../../IDEA.md#nacionalidad-e-idioma), planes 11, 17 y 21 |
| 2026-11-22 | **Formatos de competición como datos**: por defecto los reales de la temporada; al crear la carrera el usuario puede cambiar por competición splits, round robin, Bo, grupos o Swiss, eliminación simple o doble y plazas internacionales. Fijos durante la carrera salvo para temporadas futuras | [plan general, Fase 4](../plans/00-plan-general.md), plan 12 |
| 2026-11-22 | **Meta propio de cada carrera**: la tier list parte del contenido con el que empezó la carrera y cambia con parches simulados con su semilla; cada carrera evoluciona distinta. **Maestría** de 0 a 100 por jugador y campeón, entrenable con coste de oportunidad | [plan general, Fase 7](../plans/00-plan-general.md), planes 18 y 20 |
| 2026-11-19 | **Carreras ilimitadas**, autoguardado, ironman opcional, backups y export/import. Historial completo (palmarés, partidos, Hall of Fame, perfiles) | Planes 27 y 28 del [plan general](../plans/00-plan-general.md) |
| 2026-11-19 | Interfaz con **i18n ES/EN** desde el inicio. PC gaming medio como objetivo. Pruebas en Arch Wayland y Windows | [ADR 0001](0001-stack-tecnologico.md) |

## Técnica

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | **Electron + núcleo TypeScript + React**; plan B Godot + C# si el draft broadcast sale caro | [ADR 0001](0001-stack-tecnologico.md) |
| 2026-11-19 | Núcleo puro y determinista en un `utilityProcess`; SQLite por carrera con hechos append-only; sin event sourcing integral | [ADR 0001](0001-stack-tecnologico.md) |
| 2026-11-19 | **TDD obligatorio** (los spikes desechables quedan exentos) | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | Catálogo obligatorio de librerías: shadcn/ui sobre Base UI con Tailwind v4, TanStack, Motion + PixiJS (sin GSAP), Lucide + game-icons e i18next. Context7 para consultar su documentación | [libraries.md](../libraries.md) |
| 2026-11-19 | Actualización desde la app con `electron-updater` (botón, canal estable o beta) | [ADR 0001](0001-stack-tecnologico.md) |

## Fase 1 · Spikes

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-20 | Umbrales del draft broadcast: ≤ 100 ms p95 al confirmar, ≥ 55 FPS de media, p95 entre fotogramas ≤ 25 ms; retoque con un agente ≤ 30 min. Medición de GPU en el Arch del usuario; Windows solo funcional en CI (T1 se repite a mano en Windows antes de la primera release) | [plan 03](../plans/03-spikes.md) |
| 2026-11-20 | Endurecimiento previo a los spikes: #64 (Electron) y #66 (reloj del núcleo); el resto de la revisión, en paralelo | [plan 03](../plans/03-spikes.md) |
| 2026-11-20 | **Go: se confirma Electron** y no se activa el plan B (Godot). T1–T7 en verde; quedan como requisito de la primera release pública la instalación en máquinas limpias con SmartScreen y T1 en un Windows con GPU | [ADR 0003](0003-go-no-go-fase1.md) |
| 2026-11-20 | Driver de SQLite: **`node:sqlite`** dentro del `utilityProcess`, sin módulos nativos; AppImage con el runtime estático | [ADR 0003](0003-go-no-go-fase1.md) |
| 2026-11-20 | La **`DataTable` se virtualiza** con TanStack Virtual (#91): sin virtualizar, 500 filas no cumplen el presupuesto | [S2](../research/spikes-2026-11/s2-dense-table.md) |
| 2026-11-20 | El ritmo de cada escena animada se centraliza en un módulo de parámetros compartido con su medidor (T3 costó ≈90 s) | [ADR 0003](0003-go-no-go-fase1.md) |
| 2026-11-22 | Los datos brutos de los spikes se consultan en el commit archivado (#296) | [Evidencias](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/) |

## Fase 2 · Draft rápido

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-22 | En el pool de campeones, el buscador comparte fila con los filtros de rol por icono. Cada casilla muestra solo el retrato y conserva el nombre del campeón como etiqueta accesible. | [#308](https://github.com/nbfrodri/riftlegends/issues/308) |
| 2026-11-20 | IPC: main solo hace de **relevo** (comprueba el marco emisor); el `utilityProcess` valida con Zod y decide. Sin `MessagePort` directo | [plan 04](../archive/plans/04-contratos-ipc.md) |
| 2026-11-20 | Comandos **idempotentes por `expectedPosition`** (posición del siguiente hecho), en lugar de IDs aleatorios | [plan 04](../archive/plans/04-contratos-ipc.md) |
| 2026-11-20 | Hechos con **claves con nombre** y forma canónica ordenada (no tuplas) | [plan 04](../archive/plans/04-contratos-ipc.md) |
| 2026-11-20 | En la Fase 2 la sesión vive **en memoria**; SQLite llega con el plan 13 (Fase 5) | [plan 04](../archive/plans/04-contratos-ipc.md) |
| 2026-11-20 | RNG: `xoroshiro128plus` de `pure-rand` 8.4.2, semillas por FNV-1a de 32 bits (vectores de S3) y **un flujo por ámbito** con registro de números fijos | [plan 05](../plans/05-rng-determinismo.md) |
| 2026-11-20 | **Punto fijo con escala 10.000** y redondeo mitad hacia par en las rutas que deciden resultados | [plan 05](../plans/05-rng-determinismo.md) |
| 2026-11-20 | Goldens con cabecera `sim_version`/`content_version`; cambiar bytes obliga a subir `sim_version` | [plan 05](../plans/05-rng-determinismo.md) |
| 2026-11-20 | Job **`core-windows`** (tests del núcleo) en cada PR, obligatorio en `protect-main` | [plan 05](../plans/05-rng-determinismo.md) |
| 2026-11-20 | **Stryker** sobre `packages/core` al cerrar cada fase: `break` 70 %, objetivo 80 % | [plan 05](../plans/05-rng-determinismo.md) |
| 2026-11-21 | Draft: fearless **hard por defecto**, configurable (hard, soft o sin); el último game **no libera** campeones | [plan 06](../archive/plans/06-reglas-de-draft.md) |
| 2026-11-21 | ~~Lados como en pro (game 1 el mejor sembrado o sorteo; después elige el perdedor)~~ Sustituida por la fila del 22-11 sobre la elección dividida; temporizador **opcional y apagado** por defecto, que vive en la UI | [plan 06](../archive/plans/06-reglas-de-draft.md) |
| 2026-11-22 | **Elección dividida**: quien tiene prioridad elige una sola cosa, el lado del mapa (azul o rojo) o el orden de draft (first o last pick), y el rival elige la otra. Prioridad: game 1 **a sorteo** en el draft rápido; después, el perdedor del game anterior | issue #305 |
| 2026-11-21 | IA de draft: componentes con puntos enteros, 12 personalidades como datos, dificultad por coach (margen de error, lectura del rival y mirar adelante) y explicación en el hecho `ai.decided` | [plan 07](../archive/plans/07-ia-de-draft.md) |
| 2026-11-21 | Simulación de partida: **el ganador sale de la partida** (bucle por minuto con disputas y causas; termina al caer un nexo), 13 factores y bandas de calibración Monte Carlo; cada evento lleva zona y segundo para el minimapa | [plan 08](../archive/plans/08-simulacion-de-partida.md) |
| 2026-11-21 | La IA de cada equipo sale de su **coach** (`"coach"` en `series.start`; sin coach, `balanced` normal); `match.view` devuelve los hechos de un game jugado; el contenido ficticio se empaqueta en `packages/core/content/` | [plan 09](../archive/plans/09-draft-rapido-en-la-app.md) |
| 2026-11-21 | ~~**Atributos de jugador** (líneas, peleas, macro, mecánicas, temple, resistencia mental, experiencia, constancia y shotcalling) que deciden las disputas; se ven en el perfil del jugador, el mercado y el draft. Los de rivales, con la precisión que dé el scouting (plan 19)~~ Sustituida por la fila siguiente | [plan 08](../archive/plans/08-simulacion-de-partida.md) |
| 2026-11-21 | **20 atributos de jugador** en cinco áreas (línea, mapa, pelea, mental y equipo); se añaden farming, roaming, visión, agresividad, posicionamiento, control de objetivos, gestión de oleadas, versatilidad, anticipación, comunicación y concentración. Se ven en el perfil, el mercado y el draft; los de rivales, según el scouting (plan 19). Con jugadores reales salen de estadísticas por rol y liga (plan 11) | [plan 08](../archive/plans/08-simulacion-de-partida.md#atributos-de-jugador) |
| 2026-11-21 | `match.play` **sustituye a `game.finish`**: tras los roles se juega el game y su ganador sale de la simulación. Forma del día por equipo (escalada por la constancia) y riesgo simétrico como causas visibles; calibración K1–K5 en verde con `SIM_VERSION` 2 | [plan 08](../archive/plans/08-simulacion-de-partida.md#calibración-21-11-2026) |
| 2026-11-21 | Los atributos **se entrenan**: el usuario elige qué mejorar en el entrenamiento (plan 20), con coste de oportunidad, límites por edad y potencial, y rendimientos decrecientes; los mentales mejoran más despacio | [plan 08](../archive/plans/08-simulacion-de-partida.md) |
| 2026-11-21 | **La IA de cada equipo sale de su coach y su staff** (personalidad y dificultad); el jugador no la configura antes de una partida | [plan 09](../archive/plans/09-draft-rapido-en-la-app.md) |
| 2026-11-21 | El único equipo humano puede consultar y sustituir su **plan de partida** para el game actual | [plan 09, Q7](../archive/plans/09-draft-rapido-en-la-app.md#plan-de-partida-q7) |
| 2026-11-22 | Plan 09 cerrado: el E2E de la Bo5 se juega **sin fearless** hasta que el plan 10 traiga 70 campeones (#233 lo pasa a hard) | [plan 09](../archive/plans/09-draft-rapido-en-la-app.md) |
| 2026-11-22 | Contenido ficticio: **70 campeones** (14 por rol) y **8 equipos** con coach y sembrado, en JSON validado con Zod; Bo5 con fearless hard sin red | [plan 10](../archive/plans/10-contenido.md) |
| 2026-11-22 | El juego usa los **assets reales** de LoL y de los equipos de esports: caché de Data Dragon y CommunityDragon con **descarga automática** al arrancar con red; iconos oficiales de rol y objetivos ya en el plan 10; campeones reales jugables, logos y todos los equipos de LCK, LPL, LEC, LCP, LCS y CBLOL en el plan 11 | [plan 10](../archive/plans/10-contenido.md#decisiones-del-usuario-22-11-2026) |
| 2026-11-22 | Datos reales solo de **Leaguepedia** (CC BY-SA) en un snapshot JSON en el repo; nombres de campeón desde la caché; atributos no medibles estimados y marcados; personalidad del coach por estilo de draft; coeficientes de fuerza por liga editables | [plan 11](../plans/11-datos-reales.md) |
| 2026-11-22 | Cambio de temporada automático (#288) cuando las seis ligas tengan partidas. La temporada anterior pasa a trayectoria y completa muestras de atributos al inicio del año | [pipeline](../../tools/data-pipeline/README.md#cambio-de-temporada) |
| 2026-11-22 | ~~**Logos de equipo** en la caché (origen `leaguepedia`, #252)~~ Sustituida por la fila siguiente | [plan 11](../plans/11-datos-reales.md#logos-de-equipos-en-la-caché-252-284) |
| 2026-11-22 | **Logos de equipos desde la API pública de lolesports.com en el pipeline** (`pnpm data:logos` escribe `content/real/logos.json`; autorizado por el usuario el 22-11-2026); la app **solo descarga las imágenes de Riot** (hosts exactos, SHA-256, tamaño y magic bytes, sin SVG, 512 KB, sin redirects) y cae al escudo propio | [plan 11](../plans/11-datos-reales.md#logos-de-equipos-en-la-caché-252-284) |
| 2026-11-22 | Datos reales: la app **no consulta Leaguepedia**; un workflow semanal regenera el snapshot y abre un PR (llega con cada versión). Nombres, retratos y clases de campeón desde **CommunityDragon**. Riot Open Access (GRID), solo tras estudiar sus condiciones y nunca con clave en la app | [plan 11](../plans/11-datos-reales.md#decisiones-del-usuario-22-11-2026) |
| 2026-11-22 | **Las carreras guardadas no cambian con los datos nuevos.** Cada carrera copia el contenido con el que empezó (equipos, jugadores, campeones y su `content_version`) y desde ahí los fichajes y la evolución los decide la partida. Una actualización del juego con datos nuevos (workflow semanal) solo afecta a las carreras nuevas y al draft rápido; nunca corrompe ni modifica una carrera en curso | [plan general](../plans/00-plan-general.md), plan 13 |
| 2026-11-22 | El snapshot separa plantillas históricas y de temporada. Los desambiguadores personales de los identificadores se sustituyen por huellas | [plan 11](../plans/11-datos-reales.md#diseño) |
| 2026-11-22 | Jugadores y equipos reales (#250): atributos por percentil de rol y liga en una banda 55–88 (mezcla de métricas, resultados y puntos de liga editables; #280), nivel ponderado por rol, lo no medible **estimado y marcado**, sembrado global tipo Elo (prior de liga + % de victorias suavizado) y personalidad del coach por estilo de draft relativo a su liga | [plan 11](../plans/11-datos-reales.md), [pipeline](../../tools/data-pipeline/README.md#jugadores-y-equipos) |
| 2026-11-22 | **Trayectoria en los atributos reales** (#287): `history.json` con 7 años previos (partidas, eventos internacionales, títulos) por consultas agregadas de Cargo, caché de años cerrados con clave estable; sube experiencia, temple, resistencia, constancia y el nivel cierra hasta la mitad de la distancia al techo 94 (atributos ≤ 95), con peso 0,85 por año de antigüedad. Faker pasa de 74 a 82; techo de nivel 94 | [pipeline](../../tools/data-pipeline/README.md#trayectoria-de-los-jugadores), [plan 11](../plans/11-datos-reales.md) |
| 2026-11-22 | Campeones reales generados por `pnpm data:champions` desde el snapshot y el catálogo de CommunityDragon (parche fijado): rol con ≥ 5 % de los picks, tier por presencia (picks + bans), matchups y sinergias con **muestra mínima de 20 partidas**; daño, curva y arquetipos de una tabla curada solo con ids (sin ella, según la clase y tier C) | [plan 11](../plans/11-datos-reales.md#campeones-reales-cómo-se-generan-249) |

## Estilo visual

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | Ventana **sin marco** con barra de título propia; **solo tema oscuro**; i18n ES/EN con selector en Ajustes; tests visuales con capturas en el CI de Linux | [plan 02](../archive/plans/02-ui-kit-shell.md) |
| 2026-11-20 | Ventana de **1280×720 como mínimo** (1366×768 por defecto); el botón de plegar la barra lateral dice «Contraer» / «Collapse» | PR de este cambio |
| 2026-11-20 | Posiciones con **jerga competitiva**: Top, Jungla/Jungle, Mid, ADC y Support en ES y EN (el identificador interno sigue siendo `bot`) | PR de este cambio |
| 2026-11-20 | **Iconos de rol propios** en el estilo Caja, que funcionan sin red y en el modo ficticio; los oficiales se descargarán de CommunityDragon en el modo LoL real (plan 10) | PR de este cambio |
| 2026-11-22 | Iconos de **estadísticas** (KDA, oro, súbditos, daño y visión) del cliente oficial: set SVG del marcador de fin de partida en la caché de CommunityDragon; sin caché, iconos de Lucide. Los **objetivos** usan su icono oficial en todas las pantallas | [plan 11](../plans/11-datos-reales.md), #293 |
| 2026-11-22 | En la partida, **un panel por equipo** con su color: torres en pie, torres e inhibidor de cada línea, nexo y, bajo una línea, sus objetivos y efectos activos. El panel lee el mapa con `teamMap`, que reutilizará el minimapa (plan 23) | #310 |
| 2026-11-22 | En el mapa de la partida, las estructuras en pie y los efectos activos llevan el color de su equipo. Las estructuras destruidas se muestran en gris, atenuadas y con una raya diagonal | #310 |
| 2026-11-19 | El botón **minimizar se oculta** en compositores Wayland en mosaico que no lo soportan (Hyprland, sway, river y niri); en el resto se muestra | PR #54 |
| 2026-11-22 | **Barras de desplazamiento** Caja en toda la app, definidas una sola vez en el CSS global con `::-webkit-scrollbar` (8 px, pista transparente, pulgar `line` que pasa a `muted` al pasar el ratón, sin flechas). Ningún elemento usa `scrollbar-color` ni `scrollbar-width` (salvo `none`), porque en Chromium anulan esas reglas | [styles.css](../../packages/ui-kit/styles.css) (#307) |
| 2026-11-19 | Estilo **Caja** (Frecuencia con Unbounded + Archivo), **barra lateral izquierda** fija y plegable, e icono **Corte · Puntera** | [ADR 0002](0002-estilo-visual.md), [design/](../../design/README.md) |
| 2026-11-22 | Las capturas visuales esperan los recursos de cada pantalla (#317) | [Tests visuales](../../apps/desktop/e2e/visual/README.md) |

## Repositorio y proceso

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | ~~Repo principal **privado** (código en inglés, documentación en español) y **repo público solo para releases**~~ Sustituida por la fila del 22-11 | [ADR 0001](0001-stack-tecnologico.md) |
| 2026-11-22 | El repo principal pasa a ser **público** (sin minutos de GitHub Actions en el privado). Código en inglés y documentación en español; las releases siguen en el repo público de releases. Firma de código con SignPath (solicitud pendiente) | Decisión del usuario |
| 2026-11-19 | Licencia dual MIT o Apache-2.0; publicar sin firma de código hasta tener SignPath (el repo ya es público) | [README](../../README.md) |
| 2026-11-19 | **Trunk-based**: solo `main` y ramas cortas por issue; beta = `vX.Y.Z-beta.N`; estable = `vX.Y.Z` | [AGENTS.md](../../AGENTS.md) |
| 2026-11-21 | El flujo plan → issues → PR se aplica también a las funciones nuevas y a los cambios posteriores al plan general; solo los arreglos pequeños van directos a issue y PR | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | Flujo **plan → issues "Tarea de plan" → tablero → rama → PR con `Closes #NN`**; solo squash; `main` protegida (PR obligatorio sin aprobaciones, historial lineal y sin force-push) | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | CI de GitHub Actions: `verify` (Ubuntu) y `core-windows` (tests del núcleo y contratos en Windows, desde el 20-11) en cada PR, ambos **obligatorios** en `protect-main`; `verify-windows` en `main` y en tags. Dependabot semanal con auto-merge de patch y minor | [ci.yml](../../.github/workflows/ci.yml), [plan 01](../archive/plans/01-cimientos.md) |
| 2026-11-20 | Todo lo escrito (documentación, planes, issues, PR y respuestas) debe ser **claro, entendible y breve** | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | El diseño visual y el trabajo mecánico se delegan en **Codex**; el usuario elige modelo y effort entre las opciones que se le presentan | [AGENTS.md](../../AGENTS.md) |
