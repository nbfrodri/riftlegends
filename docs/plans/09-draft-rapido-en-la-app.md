# Plan 09 — Draft rápido en la app: draft broadcast, partida y resultados

- **Estado:** aprobado (21-11-2026). Redactado por Claude con las decisiones del usuario (al final).
- **Fase:** 2 · Draft rápido completo ([plan general](00-plan-general.md)).
- **Objetivo:** jugar en la app una serie contra la IA de principio a fin. Incluye configurar la serie, elegir lado, el draft broadcast, los roles, ver la partida en un timeline animado y el resultado del game y de la serie. Cierra la salida de la Fase 2: una Bo5 fearless contra la IA, con un E2E del flujo.

## Contexto

- **Núcleo listo:** reglas y series (plan 06), IA explicable (plan 07) y simulación con `match.play` (plan 08). La UI solo envía comandos y lee vistas y hechos; nunca decide ni simula.
- **IPC (plan 04):** el `core-host` usa hoy el catálogo de depuración. Este plan lo pasa al catálogo del draft, con el contenido cargado en la sesión.
- **Estilo Caja y spike S1:** el draft broadcast ya se midió (≤ 100 ms p95 al confirmar, ≥ 55 FPS, movimiento reducido). Se reutilizan su escena y sus umbrales. Los parámetros de ritmo van en un módulo compartido ([ADR 0003](../decisions/0003-go-no-go-fase1.md)).
- **Contenido (plan 10):** el dataset ficticio de 60+ campeones, los nombres, el coach de cada equipo y la caché de Data Dragon llegan con el plan 10. Hasta entonces se empaqueta el fixture ficticio actual (40 campeones, 2 equipos) como contenido de producción mínimo.
- **La partida animada es presentación:** la UI reproduce los `match.event` que devuelve `match.play`, a la velocidad elegida. No vuelve a simular.

## Lista de tests

### Flujo y núcleo

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| Q1 | El `core-host` abre sesiones del draft con el contenido cargado | Un comando inválido o de otra sesión se rechaza igual que hoy |
| Q2 | La IA de cada equipo sale de su coach en el contenido; la configuración solo dice qué equipo controla el usuario | Un equipo sin coach usa una IA por defecto documentada |
| Q3 | Una vista `match.view` devuelve los hechos de un game jugado | Tras reabrir la pantalla, el resultado se reconstruye sin volver a simular |
| Q4 | `match.view` incluye el estado del mapa minuto a minuto: torres por línea y nivel, torres de nexo, inhibidores (y su reaparición), dragones y progreso del alma, heraldos, barones, elders y buffs activos | Cuadra con los eventos; la UI no reimplementa las reglas del mapa |
| Q5 | Una vista `series.summary` da el MVP de la serie y los gaps por línea de cada game, con su explicación | Sin games jugados, vacía; un gap solo se marca por encima de un umbral documentado |

### Pantallas (tests de componentes)

| # | Pantalla | Comportamiento | Caso límite |
| --- | --- | --- | --- |
| U1 | Configuración | Elegir mi equipo, rival, formato, fearless y temporizador; empezar | No deja elegir el mismo equipo dos veces; fearless hard y temporizador apagado por defecto |
| U2 | Lado | Si me toca elegir lado, lo elijo; si no, se muestra quién elige | Game 1 por sembrado o sorteo; después elige el perdedor |
| U3 | Draft | Bans y picks por turno, con filtro por rol, búsqueda, teclado y confirmación | Los campeones vetados, elegidos o bloqueados por fearless no se pueden confirmar y dicen por qué |
| U4 | Draft | En el turno de la IA, la UI envía `draft.ai` tras una pausa de presentación | Con el temporizador apagado nunca hay `draft.timeout` |
| U5 | Draft | Al pasar el ratón por un jugador se ven sus atributos | Del rival se ve lo mismo por ahora (el scouting llega en el plan 19) |
| U6 | Panel de la IA | Plegable; muestra los puntos de cada decisión de la IA y sus alternativas | Plegado por defecto; recuerda su estado como preferencia de UI |
| U7 | Roles | Propone un reparto por posiciones y deja intercambiar con teclado o ratón | No confirma un reparto con roles repetidos |
| U8 | Partida | Timeline minuto a minuto: reloj, oro, kills, gráfica de ventaja de oro, feed de eventos y **objetivos detallados** (torres por línea, inhibidores, dragones y alma, heraldos, barones, elders y buffs con su tiempo) | Velocidad ×1, ×4 y ×16, pausa y saltar al final; con movimiento reducido va directo al final |
| U9 | Resultado del game | Ganador, estadísticas por jugador y las 3 disputas decisivas con sus causas | Las causas se traducen; una clave desconocida se muestra tal cual, sin romper |
| U10 | Serie | Marcador, **cada game de la serie consultable** (ganador, duración, estadísticas y disputas), **MVP de la serie** y **gaps por línea** | Al terminar la serie no se puede seguir jugando |

### E2E y rendimiento

| # | Comportamiento |
| --- | --- |
| E1 | E2E con Playwright `_electron`: una Bo5 fearless contra la IA de principio a fin, saltando las partidas |
| E2 | Capturas de regresión visual de configuración, draft, roles, partida y resultado (CI de Linux) |
| E3 | El draft cumple los umbrales del S1 al confirmar un pick (≤ 100 ms p95, ≥ 55 FPS) |
| E4 | Todos los textos están en ES y EN; ningún texto fijo en los componentes |

## Diseño

### Flujo

Configuración → lado → draft → roles → partida → resultado del game → (siguiente game o) resultado de la serie.

Una sola ruta, `/draft`, con sub-pantallas según la fase de `draft.view` (`side`, `bans1`…`roles`, `result`, `over`) y un estado local de presentación (partida en reproducción, resultado visto).

### Núcleo

- `core-host` con `draftCommands`, `draftQueries` y `draftDispatcher`. La sesión se abre con `draftStateWith(contenido, contenido de partida)`.
- `series.start` indica por equipo `null` (humano), `"coach"` o ajustes explícitos. Con `"coach"`, la personalidad y el `coachRating` salen del coach del equipo en el contenido; sin coach, `balanced` con dificultad `normal`.
- Contenido empaquetado: el fixture ficticio vive en `packages/core/content/` como contenido de producción mínimo (los fixtures de test lo reexportan). Cada equipo de `matchContent.teams` gana un `name` (nombre propio, sin i18n) y un `coach` `{ name, personality, rating }`, ambos opcionales. El plan 10 lo amplía.
- `match.view { game }` devuelve `{ game, facts }` con los hechos `match.*` guardados en la serie; un game sin jugar responde `game-not-played`.
- El `core-host` combina el catálogo del draft (primero) con el de depuración, que siguen usando la sonda del renderer y el E2E del IPC.

### UI

| Pieza | Ubicación |
| --- | --- |
| Pantallas del flujo | `apps/desktop/src/renderer/draft/` (una por fase) |
| Escena broadcast (Motion + PixiJS) | `apps/desktop/src/renderer/draft/broadcast/`, con el ritmo en el módulo compartido |
| Reproductor del timeline | `apps/desktop/src/renderer/match/` |
| Componentes reutilizables (cartas, marcador, tabla de estadísticas) | `packages/ui-kit` |
| Textos | catálogos i18n ES y EN |

**Base del flujo** (`renderer/draft/`, issue 2): `DraftScreen` abre la sesión y elige la sub-pantalla con `stageOf(view, presentation)`. Cada etapa (`setup`, `side`, `draft`, `roles`, `match`, `result`) es una entrada de `draftStages` en `stages.tsx`: para sustituir un marcador de posición se cambia su entrada por un componente sin props que lee el flujo con `useDraftSession()` (`view`, `options`, `mine`, `send`, `present`). La cabecera (migas, título y marcador) la dibuja `DraftScreen`. El estado de presentación (`present("side" | "match" | "result" | null)`) cubre lo que el núcleo no sabe: el lado que tomó la IA, la partida en reproducción y el resultado visto. La query `series.options` da equipos (nombre y coach) y el pool. Mientras no haya clasificación (plan 10), el orden del contenido es el sembrado. Componentes nuevos en `ui-kit`: `IconButton` y `SegmentedControl`.

Sin imágenes de Riot: en el modo ficticio, los campeones se muestran con iniciales y un color generado. El arte real llega con la caché de Data Dragon (plan 10).

## Troceado en issues (Tarea de plan · milestone «Fase 2 — Draft rápido completo»)

| Orden | Issue | Test que lo cierra |
| --- | --- | --- |
| 1 | Núcleo: `core-host` con el catálogo del draft, contenido empaquetado, IA desde el coach y `match.view` | Q1–Q3 |
| 2 | Configuración de la serie y elección de lado | U1, U2 |
| 3 | Tablero del draft: bans, picks, rejilla, filtros, búsqueda y teclado | U3, U5 |
| 4 | Turnos de la IA, temporizador y escena broadcast | U4, E3 |
| 5 | Panel de explicación de la IA | U6 |
| 6 | Asignación de roles | U7 |
| 7 | Reproductor del timeline de partida | U8 |
| 8 | Resultado del game y de la serie | U9, U10 |
| 9 | E2E de la Bo5 fearless, capturas visuales e i18n completo | E1, E2, E4 |
| 10 | Núcleo: estado del mapa por minuto en `match.view` y `series.summary` (MVP y gaps por línea) | Q4, Q5 |

1 primero; 2, 3, 6 y 10 en paralelo tras 1; 7 y 8 tras 10; 4 y 5 tras 3; 9 cierra el plan. Las maquetas aprobadas están en [design/visual-style/quick-draft/](../../design/visual-style/quick-draft/index.html).

## Riesgos

- **Contenido mínimo:** 40 campeones no bastan para una Bo5 con fearless hard (60 picks). El E1 usa **fearless soft** y pasará a hard cuando el plan 10 traiga 60+ campeones.
- **Rendimiento del broadcast:** la escena real es más rica que la del spike. E3 lo vigila en el CI y en el Arch del usuario.
- **Pantallas en paralelo:** comparten `ui-kit` y los catálogos i18n. Cada issue declara qué ficheros toca.

## Decisiones del usuario (21-11-2026)

1. El plan cubre el **flujo completo**: configuración, draft, roles, partida y resultados.
2. La partida se ve en un **timeline animado**, con velocidades y botón de saltar.
3. El desglose de la IA va en un **panel opcional y plegable**.
4. Se configuran equipos, formato y fearless, y temporizador. **La personalidad y la dificultad de la IA no las elige el jugador:** salen del coach y del staff de cada equipo.
5. Reparto: **Codex `gpt-6.2-astra` (high)** para lo visual (issues 3, 4 y 7) y **subagentes de Claude** (Sonnet, medium) para el resto. Claude redacta, trocea, revisa e integra.
6. El E2E de la Bo5 usa fearless soft hasta que el plan 10 traiga 60+ campeones.
7. Tras ver las maquetas: objetivos detallados en la partida; en resultados, cada game de la serie, el **MVP de la serie** y los **gaps por línea**; rejilla de draft densa (~24 campeones) con ficha y panel de la IA plegables; jerga Top/Mid/Bot en el feed, y el icono del juego en la barra lateral (ADR 0002).
