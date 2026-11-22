# Registro de decisiones

Resumen de las decisiones **vigentes**, para empezar cualquier sesión sin volver a preguntar. Cada fila enlaza a su fuente de verdad. Se actualiza en el mismo PR que toma o cambia una decisión; las sustituidas se tachan y se indica su reemplazo.

## Producto y alcance

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | Juego de gestión de esports de LoL para **escritorio** (Windows y Linux), no web. DraftSim solo aporta ideas, no código | [IDEA.md](../../IDEA.md), [inventario de DraftSim](../research/draftsim-inventario.md) |
| 2026-11-19 | **Contenido real de LoL** asumiendo el riesgo; el nombre "Rift Legends" se mantiene; sin assets de Riot en el repo ni en los binarios (descarga en tiempo de ejecución) | [ADR 0001](0001-stack-tecnologico.md), [NOTICE.md](../../NOTICE.md) |
| 2026-11-19 | Primer hito: **draft rápido completo** contra la IA. Primero las ligas top y después las menores. Jugadores reales con regens. Sin despido ni draft local para dos jugadores por ahora. Timeline de partida y después minimapa | [IDEA.md §12](../../IDEA.md), [plan general](../plans/00-plan-general.md) |
| 2026-11-21 | **Scrims** en la Fase 7 (plan 20): peticiones y bloques automáticos, mejoran forma, química, campeones, preparación y meta, revelan información en ambos sentidos y se pueden jugar con draft propio | [IDEA §8](../../IDEA.md#8-novedades-respecto-a-draftsim) |
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

## Fase 2 · Draft rápido

| Fecha | Decisión | Fuente |
| --- | --- | --- |
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
| 2026-11-21 | Lados como en pro (game 1 el mejor sembrado o sorteo; después elige el perdedor); temporizador **opcional y apagado** por defecto, que vive en la UI | [plan 06](../archive/plans/06-reglas-de-draft.md) |
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
| 2026-11-22 | Datos reales solo de **Leaguepedia** (CC BY-SA), temporada **2026 completa**, en un snapshot JSON en el repo; nombres de campeón desde la caché (sin texto de Riot en el repo); atributos no medibles estimados y marcados; personalidad del coach por estilo de draft; coeficientes de fuerza por liga editables | [plan 11](../plans/11-datos-reales.md) |
| 2026-11-22 | **Logos de equipo** en la caché (origen `leaguepedia`, #252): solo `https` al host y ruta del snapshot, sin SVG, SHA-1 del snapshot, magic bytes, 512 KB, sin redirects y nombre local por slug del id; caída al escudo propio | [plan 11](../plans/11-datos-reales.md#logos-de-equipos-en-la-caché-252) |
| 2026-11-22 | Datos reales: la app **no consulta Leaguepedia**; un workflow semanal regenera el snapshot y abre un PR (llega con cada versión). Nombres, retratos y clases de campeón desde **CommunityDragon**. Riot Open Access (GRID), solo tras estudiar sus condiciones y nunca con clave en la app | [plan 11](../plans/11-datos-reales.md#decisiones-del-usuario-22-11-2026) |
| 2026-11-22 | El snapshot separa plantillas históricas y de temporada. Los desambiguadores personales de los identificadores se sustituyen por huellas | [plan 11](../plans/11-datos-reales.md#diseño) |
| 2026-11-22 | Jugadores y equipos reales (#250): atributos por percentil de rol y liga con fuerza de liga editable, lo no medible **estimado y marcado**, sembrado global por % de victorias suavizado y personalidad del coach por estilo de draft relativo a su liga | [plan 11](../plans/11-datos-reales.md), [pipeline](../../tools/data-pipeline/README.md#jugadores-y-equipos) |

## Estilo visual

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | Ventana **sin marco** con barra de título propia; **solo tema oscuro**; i18n ES/EN con selector en Ajustes; tests visuales con capturas en el CI de Linux | [plan 02](../archive/plans/02-ui-kit-shell.md) |
| 2026-11-20 | Ventana de **1280×720 como mínimo** (1366×768 por defecto); el botón de plegar la barra lateral dice «Contraer» / «Collapse» | PR de este cambio |
| 2026-11-20 | Posiciones con **jerga competitiva**: Top, Jungla/Jungle, Mid, ADC y Support en ES y EN (el identificador interno sigue siendo `bot`) | PR de este cambio |
| 2026-11-20 | **Iconos de rol propios** en el estilo Caja, que funcionan sin red y en el modo ficticio; los oficiales se descargarán de CommunityDragon en el modo LoL real (plan 10) | PR de este cambio |
| 2026-11-19 | El botón **minimizar se oculta** en compositores Wayland en mosaico que no lo soportan (Hyprland, sway, river y niri); en el resto se muestra | PR #54 |
| 2026-11-19 | Estilo **Caja** (Frecuencia con Unbounded + Archivo), **barra lateral izquierda** fija y plegable, e icono **Corte · Puntera** | [ADR 0002](0002-estilo-visual.md), [design/](../../design/README.md) |

## Repositorio y proceso

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | Repo principal **privado** (código en inglés, documentación en español) y **repo público solo para releases** | [ADR 0001](0001-stack-tecnologico.md) |
| 2026-11-19 | Licencia dual MIT o Apache-2.0; publicar sin firma de código (SignPath si el repo se hace público) | [README](../../README.md) |
| 2026-11-19 | **Trunk-based**: solo `main` y ramas cortas por issue; beta = `vX.Y.Z-beta.N`; estable = `vX.Y.Z` | [AGENTS.md](../../AGENTS.md) |
| 2026-11-21 | El flujo plan → issues → PR se aplica también a las funciones nuevas y a los cambios posteriores al plan general; solo los arreglos pequeños van directos a issue y PR | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | Flujo **plan → issues "Tarea de plan" → tablero → rama → PR con `Closes #NN`**; solo squash; `main` protegida (PR obligatorio sin aprobaciones, historial lineal y sin force-push) | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | CI de GitHub Actions: `verify` (Ubuntu) y `core-windows` (tests del núcleo y contratos en Windows, desde el 20-11) en cada PR, ambos **obligatorios** en `protect-main`; `verify-windows` en `main` y en tags. Dependabot semanal con auto-merge de patch y minor | [ci.yml](../../.github/workflows/ci.yml), [plan 01](../archive/plans/01-cimientos.md) |
| 2026-11-20 | Todo lo escrito (documentación, planes, issues, PR y respuestas) debe ser **claro, entendible y breve** | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | El diseño visual y el trabajo mecánico se delegan en **Codex**; el usuario elige modelo y effort entre las opciones que se le presentan | [AGENTS.md](../../AGENTS.md) |
