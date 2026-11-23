# Plan general de Rift Legends

## Contexto

La decisión de stack está en el [ADR 0001](../decisions/0001-stack-tecnologico.md): **Electron + núcleo TypeScript + React**, con Godot + C# como plan B si el draft broadcast resulta demasiado caro de producir. El estilo visual es **Caja**, con barra lateral e icono Corte · Puntera ([ADR 0002](../decisions/0002-estilo-visual.md)). Este plan es el **mapa maestro**: fija la estructura, la arquitectura, las fases, sus criterios de salida y el índice de los **planes específicos** que se escribirán después, uno por sistema o función. No detalla la implementación de cada sistema; eso corresponde a cada plan específico.

Al aprobarse, este plan se copia a `docs/plans/00-plan-general.md` en la rama `docs/stack-decision` y se hace commit (`docs(plan): add general roadmap`).

### Paso previo: ordenar la documentación existente (en la misma rama)
- **Mover** `reports/` y `research_notes/` a `docs/research/stack-2026-11/` (con `git mv`), añadir un `README.md` breve que indique que es un archivo histórico del 19-11-2026 y que la decisión vigente es el ADR 0001, y actualizar los enlaces del ADR. No se borran, porque son la evidencia del ADR y la base si se activa el plan B. Commit: `docs: move stack research to docs/research`.
- **Actualizar `IDEA.md`:** cambiar el estado a "Idea; stack decidido (ADR 0001)"; en el §11, añadir la cláusula de Riot que prohíbe usar su PI en juegos, la coincidencia del nombre con la ERL polaca y la postura adoptada (riesgo asumido, sin assets de Riot en el repo ni en los binarios, descarga en tiempo de ejecución); en el §12, marcar como resueltas las preguntas de liga inicial (top primero, menores después), jugadores (reales con regens), visualización de partida (timeline y después minimapa), despido (no por ahora), draft local (no por ahora) y stack (ADR 0001); añadir que la UI tendrá i18n ES/EN. Commit: `docs(idea): update with stack and scope decisions`.

Decisiones del desarrollador que lo condicionan: LoL real con el riesgo asumido; el nombre se mantiene; repo privado con documentación en español y código en inglés; releases en un repo público aparte; UI con i18n ES+EN desde el inicio; PC gaming medio; pruebas en Arch Wayland y Windows; primer hito = draft rápido completo; primero las ligas top y después las menores; jugadores reales al inicio y regens después; sin despido ni draft local para dos jugadores por ahora; timeline de partida primero y minimapa después; DraftSim solo como fuente de ideas.

## Principios transversales

- **Núcleo puro y determinista.** `packages/core` no importa DOM, Electron, Node `fs` ni el reloj. Se rige por `(estado, comando, rng) → hechos`, usa un PRNG con nombre, semillas derivadas por hash `H(seed, ámbito, ids)` y enteros o punto fijo en las rutas que deciden resultados. Biome rechaza el azar del sistema, los relojes y los temporizadores en el código del núcleo, tanto por sus nombres globales (como `crypto` y `performance`) como por las importaciones de Node que los exponen.
- **Hechos como fuente de verdad.** Una tabla append-only `facts` guarda los hechos y las proyecciones (estadísticas, historial, Hall of Fame) se derivan de ella. El estado actual se persiste en la misma transacción. Sin event sourcing integral.
- **Contenido como datos.** Esquemas Zod en `packages/content`; todo el contenido se valida al cargar y cada carrera registra el `content_version` con que se jugó.
- **Una sola autoridad.** El `utilityProcess` del núcleo es el único que escribe en SQLite. El renderer envía comandos y recibe hechos y vistas por IPC tipado.
- **Explicabilidad (pilar 2).** Cada decisión de la IA y cada resultado simulado devuelve un desglose de factores que la UI puede mostrar.
- **Teclado primero en las pantallas densas**, con estados de foco visibles y escalado al 150 %.
- **Módulos pequeños** (lección de DraftSim): un fichero por concepto y nada por encima de ~300 líneas sin motivo.
- **TDD obligatorio (red → green → refactor).** No se escribe código de producción sin un test que falle antes por la razón esperada. Por capa:
  - *Núcleo, contratos, contenido y persistencia:* tests unitarios y de propiedades (fast-check) primero; golden tests de log de hechos por semilla; tests de integración con SQLite real (fichero temporal), sin mocks de la base de datos.
  - *UI:* tests de comportamiento de componentes (Vitest + Testing Library, por rol y texto, nunca por detalles de implementación) antes de implementar; E2E con Playwright `_electron` para cada flujo de hito escrito antes de cerrarlo. Lo visual puro (ritmo de animación, estilo) se valida manualmente o con capturas, no con TDD.
  - *Spikes (Fase 1):* exentos, porque son código desechable; lo que sobreviva se reescribe con TDD.
  - *Bugs:* primero un test de regresión que lo reproduzca y después el arreglo.
- **Cada plan específico empieza por su lista de tests** (comportamientos y casos límite) antes del diseño de implementación, y cada ticket define el test que lo cierra.
- **Calidad de los tests:** mutation testing con Stryker sobre `packages/core` al cerrar cada fase (umbral en el [plan 05](05-rng-determinismo.md#mutación): 70 % mínimo, 80 % objetivo); la cobertura se informa, pero no es el objetivo.
- **Definición de hecho:** test rojo visto, verde, refactor, `pnpm verify` en verde y commit Conventional (preferiblemente `test:` + `feat:` o un único `feat:` con sus tests).

## Estructura del repositorio (monorepo pnpm)

```
apps/desktop/            Electron: main/, core-host/ (utilityProcess), preload/, renderer/ (React)
packages/core/           dominio puro: draft/, match/, competition/, roster/, market/, meta/,
                         career/, scouting/, training/, morale/, narrative/, history/, rng/, facts/
packages/contracts/      comandos, hechos y DTOs de vista compartidos (tipos + esquemas Zod de IPC)
packages/content/        esquemas de contenido, dataset ficticio mínimo, cargador y validación
packages/persistence/    SQLite: migraciones, repositorio de hechos, proyecciones, versionado de carreras
packages/i18n/           catálogos ES/EN (ICU, p. ej. i18next o FormatJS)
packages/ui-kit/         tokens del estilo visual elegido, componentes base, tablas
tools/data-pipeline/     snapshot de Leaguepedia → JSON con procedencia; sync de Data Dragon
docs/                    decisions/ (ADR), plans/, glossary.md, handoffs/
```

Tooling: pnpm workspaces, TypeScript estricto, Vite (renderer) más electron-vite o equivalente, Vitest, fast-check, Playwright (el `_electron` para E2E), Biome u oxlint junto con `tsc --noEmit`, lefthook, mise para fijar las versiones de Node y pnpm, `just` o scripts de pnpm con un solo `verify` (lint + typecheck + tests). AGENTS.md y CLAUDE.md llevarán los comandos y las reglas del núcleo.

## Arquitectura de flujo

Renderer (React) → `window.api.send(Command)` → main → utilityProcess (core + persistence) → valida el comando, ejecuta el núcleo, persiste estado y hechos en una sola transacción → emite `Fact[]` y las vistas actualizadas → renderer. El draft y el timeline de partida se presentan como reproducción de hechos, lo que permite saltar animaciones sin alterar el estado. La capa PixiJS se suscribe a los mismos hechos que el DOM.

## Fases

Cada fase termina con un hito verificable y un commit o PR fusionado en `main`. Las fases 0 y 1 son bloqueantes; desde la 4, algunas pueden avanzar en paralelo según dependencias.

### Fase 0 — Cimientos ✅ (terminada el 20-11-2026: planes 01 y 02, issues #12–#18 y #38–#45)
- Monorepo, tooling, `verify`, CI en GitHub Actions (Linux en cada push; matriz con Windows solo en `main` y en tags), AGENTS.md, glosario de dominio (draft, pick, ban, fearless, split, serie…), plantilla de ADR, LICENSE MIT/Apache y aviso de Riot.
- GitHub (pendiente al existir `package.json` y el CI): `.github/dependabot.yml` (npm y github-actions, semanal y agrupado), un workflow de auto-merge para los PRs patch/minor de Dependabot con el CI en verde, y añadir el check `verify` como obligatorio en el ruleset `protect-main`. Ya configurado: solo squash, borrado de ramas al fusionar, alertas y security updates de Dependabot, ruleset (sin borrado, sin force-push, historial lineal), labels, milestones por fase y plantillas.
- Estilo visual elegido: **Caja** ([ADR 0002](../decisions/0002-estilo-visual.md)), con barra lateral izquierda de navegación → tokens en `packages/ui-kit`.
- **Salida:** `pnpm verify` en verde en CI; app Electron vacía que arranca en Windows y en Arch Wayland; ADR 0002 aceptado.

### Fase 1 — Spikes de validación (go/no-go del stack) ✅ (terminada el 20-11-2026: plan 03, issues #73–#78; **go**, [ADR 0003](../decisions/0003-go-no-go-fase1.md))
- **S1+S2:** secuencia *ban → cuenta atrás → lock-in* con el estilo elegido (DOM + Motion + PixiJS) y una tabla de 500 jugadores navegable con teclado; pedir al agente un retoque de ritmo.
- **S3:** mini-núcleo (draft legal + serie simulada) con guardado interrumpido y reapertura; golden test idéntico en Windows y Linux en CI.
- **S7+S8 reducido:** NSIS y AppImage en máquinas limpias; draft ficticio sin red; descarga de Data Dragon interrumpida y reanudada.
- **Salida:** se cumplen los criterios de descarte del ADR 0001, o se activa el plan B (A · Godot) con un ADR nuevo. El código de los spikes se tira o se rehace limpio.

### Fase 2 — Hito 1: Draft rápido completo (vertical slice)
- Reglas de draft (fases de pick y ban, lados, fearless, series Bo1/Bo3/Bo5, elección de lado del perdedor).
- IA de draft explicable (utility AI con desglose por factor; personalidades como vectores de pesos; dificultad como ruido derivado del RNG).
- Simulación de partida v1 (timeline por fases: líneas, objetivos, peleas, cierre; pivote estratégico) y pantalla de resultado con estadísticas básicas.
- Pantalla de draft broadcast completa, timeline animado e i18n ES/EN.
- Contenido: dataset ficticio y modo LoL real con la caché de Data Dragon.
- **Salida:** jugar una serie Bo5 fearless contra la IA de principio a fin; golden tests de draft y partida; E2E Playwright del flujo.

### Fase 3 — Pipeline de contenido real
- `tools/data-pipeline`: snapshot de Leaguepedia (equipos, plantillas y ligas top de 2026) en JSON versionado, con atribución CC BY-SA; sync de Data Dragon por parche; atributos de jugadores derivados de estadísticas (Oracle's Elixir o gol.gg cuando estén disponibles).
- Gestión de la caché de assets (integridad, reanudación, versión).
- **Salida:** `content_version` reproducible y un comando que regenera el snapshot.

### Fase 3.5 — Simulación por composiciones
- Decisión del usuario del 23-11-2026; diseño en el [plan 08](../archive/plans/08-simulacion-de-partida.md) (#326, #320).
- Estadísticas por rol con oro por jugador; nota común por rol; identidades de composición y sus cruces; la composición decide las jugadas (cazada, asedio con poke, dive bajo torre, presión en banda, invasión).
- Ventaja de oro relativa con saturación por full build; early, mid y late viables.
- Nivel, objetos simplificados y ultis con enfriamientos reales (#338, #339); head2head en la partida (#337).
- **Salida:** bandas Monte Carlo del plan 08 en verde y goldens con `SIM_VERSION` subida.

### Fase 4 — Competición
- Formatos: liga, grupos, Swiss propio (restricciones de región, sin revanchas) y eliminatorias simple y doble; calendario y ligas top; First Stand, MSI y Worlds.
- **Formatos como datos, configurables al crear la carrera** (decisión del 22-11-2026): por defecto, el formato real de la temporada de cada competición (p. ej. tres splits con round robin y playoffs de doble eliminación; Swiss en Worlds). Al crear la carrera, el usuario puede cambiar por competición: número de splits, vueltas del round robin, Bo1/Bo3/Bo5 por fase, grupos o Swiss, eliminación simple o doble y plazas internacionales por región. Queda fijo durante la carrera salvo para temporadas futuras. Los mismos bloques sirven al modo Torneo.
- Modo **Torneo** (IDEA §6) como primer consumidor.
- **Sección «Competición» (petición del usuario, 22-11-2026):**
  - temporada actual de todas las ligas, no solo la propia;
  - clasificación de cada split;
  - calendario y resultados;
  - cuadros visuales de los playoffs (simple o doble eliminación) y de los internacionales (grupos, Swiss y eliminatorias);
  - página de cada equipo: plantilla, racha y forma, partidos y estadísticas.
- **Todas las partidas con el mismo motor** (decisión del 22-11-2026): las de otras regiones y equipos se juegan con el draft de la IA y la simulación por minuto, pero sin animación. Así sus picks, resultados y estadísticas son reales y alimentan el meta y el historial. La partida solo se ve animada si el usuario la abre. El presupuesto de tiempo de esta fase lo comprueba. Si no se cumple, se optimiza el motor antes que inventar un modo «rápido» que falsee los datos.
- **Salida:** simular un año competitivo completo IA contra IA de forma determinista y en un tiempo acotado (presupuesto a fijar en su plan).

### Fase 5 — Carrera v1
- Elección de equipo, avance de calendario, bucle diario (IDEA §4), objetivos de directiva (sin despido), guardado y carga con migraciones y versionado de carreras.
- **Gestor de carreras:** carreras ilimitadas (un SQLite por carrera, cada una con su propio equipo), pantalla de cargar y crear carrera, autoguardado, modo ironman opcional, backups rotativos con restauración, y exportar e importar el fichero de una carrera.
- Proyecciones: clasificación, estadísticas, palmarés y head-to-head.
- Pantallas densas: plantilla, calendario, clasificación y perfil de jugador o equipo.
- **Ficha de jugador en todas partes (petición del usuario, 22-11-2026):** cualquier sitio donde salga un jugador lleva a su ficha. Esto incluye el mercado, la plantilla, el draft, los roles, los resultados, las noticias y el historial.
  - **Ficha rápida:** al pasar el ratón o con clic derecho, con nivel, rol, nacionalidad, los 20 atributos y sus campeones principales con su maestría.
  - **Perfil completo:** con un clic, en su propia pantalla, con atributos, estadísticas, maestrías, contrato, trayectoria y palmarés.
  - **Una sola pieza:** es el mismo componente en todas las pantallas, con la misma pista visible de que se puede abrir (como la ficha de campeón, #318).
- **Salida:** jugar un split completo y playoffs; cerrar y reabrir la carrera con un resultado idéntico al de continuar sin cerrar.

### Fase 6 — Jugadores, mercado y temporadas
- Evolución por edad y forma, pools de campeones, contratos, renovaciones, agentes libres, academias, **regens**, offseason y bucle de varias temporadas.
- **Segundas divisiones y leyendas (23-11-2026):** jugadores de LCK CL, LDL, ERL, NACL y Circuito Desafiante en el snapshot (plan 11), que sirven también de liga de academias; **leyendas** históricas como agentes libres al empezar la carrera, con atributos que mezclan su prime y su edad actual ([IDEA §8](../../IDEA.md#8-novedades-respecto-a-draftsim)).
- **Staff** (plan 29): head coach, assistant coach, analistas, coaches por posición y psicólogo, con mercado y contratos. Cada rol mejora un solo sistema y su efecto se ve en el desglose. El usuario es el manager: draftea él (con sugerencias del assistant coach) o delega en el head coach.
- **Nacionalidad e idioma:** el dato y la bandera llegan con los datos reales (plan 11); el efecto en la química, con el plan 21, y las plazas de importados, con el plan 17.
- **Finanzas** (plan 30): ingresos, gastos, sueldos, primas, traspasos y buyouts, reglas salariales por liga y presupuesto de la directiva.
- **Salida:** 10 temporadas simuladas con distribuciones de edad, nivel, fichajes **y saldo de los clubes** dentro de bandas Monte Carlo acordadas (ningún club IA se arruina ni acumula dinero sin límite).
- **Mercado vivo (petición del usuario, 23-11-2026):** los clubes de la IA también fichan. Hacen ofertas por jugadores de otros equipos, incluidos los del usuario, pagan buyouts y negocian renovaciones según sus necesidades de plantilla, su presupuesto y su ambición.
  - **Ofertas al usuario:** las que le llegan las puede aceptar, rechazar o contraofertar. Pagar el buyout fuerza la salida del jugador.
  - **Movimientos entre clubes de la IA:** se ven en las noticias y en el mercado.
- **Propuesta del usuario para el plan 17 (21-11-2026):** ventanas de fichajes durante la temporada (entre fases) y en la offseason. En la lista del mercado, al pulsar un jugador su fila se despliega hacia abajo con la ficha (los 20 atributos), sus estadísticas y las acciones: hacer una oferta, seguirle o pedir un informe de scouting. Alternativa a valorar: un panel lateral fijo. Se decide al redactar el plan.

### Fase 7 — Profundidad de gestión
- Meta y parches entre splits (tiers dinámicos, notas de parche generadas).
- **Petición del usuario (22-11-2026), parches y maestría:**
  - **Parches:** cada cierto tiempo, un parche sube o baja el tier de algunos campeones y cambia sus counters y sinergias. Las notas del parche explican qué cambió.
  - **Cómo evoluciona el meta:**
    - **Meta que emerge:** el tier de cada campeón sale de las partidas simuladas de la propia carrera (presencia y % de victorias, por región y global). Cada región tiene su tendencia y los internacionales las mezclan.
    - **Parches:** como Riot, nerfean lo que domina (mucha presencia o % de victorias alto) y mejoran lo olvidado. La IA de draft reacciona al tier nuevo.
  - **Meta propio de cada carrera:** cada carrera parte de la tier list del contenido con el que empezó, y sus parches salen de su propia semilla. Dos carreras acaban con metas distintas; el draft rápido usa la tier list actual del contenido.
  - **Maestría:** cada jugador tiene una maestría de 0 a 100 con cada campeón. Sube jugando partidas oficiales y scrims, y entrenándolo (plan 20), con coste de oportunidad: pocos campeones por semana. Baja despacio si no se juega.
  - **Límites de la maestría:** el techo depende de su rol y su versatilidad. Un parche fuerte o un rework puede bajarla.
  - **Efecto y dónde se ve:** pesa en la partida y en la IA de draft (comfort picks), y se ve en el perfil del jugador, en el draft y en la ficha de campeón.
- **Propuesta del usuario (21-11-2026):** dirigir la partida como coach más allá del «Plan de partida» del plan 09: pausas tácticas en momentos clave (p. ej. minutos 15 y 25) para cambiar de plan (el «pivote estratégico»), ejecutadas mejor o peor según el shotcalling; y palancas nuevas (línea a la que se juega, invadir o defender la jungla, splitpush o agruparse), cada una con su efecto en la simulación y su calibración.
- Scouting e información imperfecta: de rivales y **búsqueda de talento** (lista abierta más ojeadores por región, únicos que descubren regens; [IDEA §8](../../IDEA.md#8-novedades-respecto-a-draftsim)).
- Entrenamiento con coste de oportunidad (elegir qué atributos de cada jugador mejorar) y **scrims** ([IDEA §8](../../IDEA.md#8-novedades-respecto-a-draftsim)).
- Moral, química y vestuario.
- **Composiciones contra el rival (#320):** pasa a la Fase 3.5 (simulación por composiciones).
- **Salida:** cada sistema influye en resultados de forma explicable (visible en el desglose) y probada con tests de propiedades.

### Fase 8 — Narrativa e historial
- Noticias, titulares, prensa (ink si hace falta), rivalidades y premios (MVP, All-Pro).
- **Historial completo:** palmarés por año y competición, historial de partidos de cualquier equipo, head-to-head, Hall of Fame y récords, Title Playground, y perfiles de jugadores y equipos con sus movimientos.
- **Salida:** las historias se generan solo a partir de hechos; golden tests de narrativa por semilla.

### Fase 9 — Presentación avanzada
- Minimapa animado 2D (PixiJS) que reproduce los hechos de partida, celebraciones, pulido broadcast del draft y sonido.
- **Propuesta del usuario para el plan 23 (21-11-2026):** inventario de objetos **visual** en el timeline, el minimapa y el resultado. Cada jugador acumula oro durante la partida y compra componentes, objetos y botas según su campeón; la build sale de un flujo de RNG propio y **no cambia la simulación**. Requisitos: oro por jugador durante la partida (en eventos o snapshots), objetos de Data Dragon en el modo real y objetos inventados en el ficticio. Los objetos como mecánica quedan descartados; solo se valorarían «picos de objeto» abstractos si la calibración o los playtests lo piden.
- **Petición del usuario (22-11-2026):** el minimapa refleja el estado del mapa por equipo (torres, inhibidores, nexo y objetivos), el mismo que muestra el panel por equipo de «Partida en curso» (#310).
- **Salida:** presupuestos de fluidez (60 fps en el PC gaming medio) en Windows y Arch Wayland.

### Fase 10 — Expansión de alcance
- Ligas menores y ascensos, modo **Sandbox/Realidades** (edición de meta y plantillas, simulación IA contra IA).
- **Salida:** subir desde una liga menor hasta una liga top en una carrera.

### Fase 10b — Tutorial guiado (al final)
- **Petición del usuario (22-11-2026):** tutorial guiado del juego, al final del desarrollo, cuando las pantallas estén estables. Recorre el draft rápido, la ficha de campeón, la partida y la carrera, y se puede repetir desde Ajustes.
- **Librería candidata:** [Driver.js](https://driverjs.com/) (MIT, sin dependencias, sin framework, funciona sin red). React Joyride (MIT) es la alternativa; Shepherd.js (AGPL o comercial) e Intro.js (GPL o comercial) quedan descartadas por licencia. Se confirma con Context7 y se añade a `docs/libraries.md` en su plan.

### Fase 11 — Distribución
- electron-builder (NSIS, AppImage, tar.gz) y un workflow que publica en el repo público `riftlegends-releases` con notas en inglés, guía de SmartScreen y aviso de Riot.
- **Actualizador dentro de la app** (`electron-updater` sobre el repo de releases): botón «Buscar actualizaciones» en Ajustes, comprobación opcional al arrancar, descarga diferencial en segundo plano, «Reiniciar para actualizar», canal estable o beta, y migración de las carreras guardadas al arrancar la versión nueva.
- **Salida:** release etiquetada instalable desde cero en Windows y Linux, con migración de una carrera de la versión anterior.

## Índice de planes específicos (`docs/plans/NN-*.md`)

Cada plan se crea al empezar su fase con `to-spec` o `dev-workflow`, y se trocea en tickets con `to-tickets`. La referencia de funcionalidades heredadas de DraftSim está en el [inventario de DraftSim](../research/draftsim-inventario.md).

| Nº | Plan | Fase |
|---|---|---|
| 01 | Cimientos del monorepo, tooling y CI | 0 |
| 02 | Estilo visual y `ui-kit` (ADR 0002) | 0 |
| 03 | Spikes S1+S2, S3 y S7+S8 | 1 |
| 04 | [Contratos de IPC, comandos y hechos](../archive/plans/04-contratos-ipc.md) (hecho) | 2 |
| 05 | [RNG, determinismo y golden tests](05-rng-determinismo.md) | 2 |
| 06 | [Reglas de draft y series (fearless)](../archive/plans/06-reglas-de-draft.md) (hecho) | 2 |
| 07 | [IA de draft explicable y personalidades](../archive/plans/07-ia-de-draft.md) (hecho) | 2 |
| 08 | [Simulación de partida v1 y timeline](../archive/plans/08-simulacion-de-partida.md) (hecho) · [Ampliación de estadísticas y composiciones](../archive/plans/08-simulacion-de-partida.md#ampliación-23-11-estadísticas-por-rol-y-composiciones-326-320) (propuesta) | 2–3 |
| 09 | [Draft rápido en la app: draft broadcast, partida y resultados](../archive/plans/09-draft-rapido-en-la-app.md) (hecho) | 2 |
| 10 | [Contenido: dataset ficticio, iconos y caché de Data Dragon](../archive/plans/10-contenido.md) (hecho) | 2–3 |
| 11 | [Datos reales: Leaguepedia, campeones reales y atributos de jugadores](11-datos-reales.md) | 3 |
| 12 | Formatos de competición y Swiss propio | 4 |
| 13 | Persistencia, hechos, proyecciones y migraciones | 5 |
| 14 | Carrera: calendario, bucle diario y directiva | 5 |
| 15 | Pantallas densas y navegación por teclado | 5 |
| 16 | Jugadores, evolución y regens | 6 |
| 17 | Mercado, contratos y offseason | 6 |
| 18 | Meta y parches | 7 |
| 19 | Scouting e información imperfecta | 7 |
| 20 | Entrenamiento y scrims | 7 |
| 21 | Moral y química | 7 |
| 22 | Narrativa, noticias y premios | 8 |
| 23 | Minimapa y presentación avanzada | 9 |
| 24 | Ligas menores y Sandbox | 10 |
| 25 | Empaquetado y repo de releases | 11 |
| 26 | i18n ES/EN y accesibilidad (transversal) | 0–11 |
| 27 | Historial: palmarés, partidos, Hall of Fame, récords y perfiles | 8 |
| 28 | Gestor de carreras: múltiples partidas, autoguardado, ironman, backups y export/import | 5 |
| 29 | Staff: contratación, roles y draft delegado | 6 |
| 30 | Finanzas: ingresos, gastos, contratos y buyouts | 6 |

## Riesgos y dependencias clave

- La Fase 1 depende del **estilo visual elegido** (Fase 0).
- Los contratos de IPC (04) y el RNG (05) se fijan antes de cualquier sistema de dominio.
- La persistencia (13) llega en la Fase 5, pero el esquema de hechos se diseña ya en la Fase 2 para no migrar pronto.
- **Carreras aisladas de los datos nuevos (decisión del 22-11-2026):** cada carrera guarda una copia del contenido con el que empezó y su `content_version`. Las actualizaciones del snapshot real (workflow semanal) solo llegan a las carreras nuevas y al draft rápido; una carrera en curso nunca cambia ni se corrompe al actualizar el juego. El plan 13 lo convierte en tests (cargar una carrera tras cambiar el contenido empaquetado da el mismo mundo).
- Riesgos residuales del ADR 0001: PI y nombre, coste del draft broadcast, gráficos en Linux, divergencia de carreras y SmartScreen.

## Verificación de este plan

- Copiado a `docs/plans/00-plan-general.md` y commit en `docs/stack-decision`.
- Cada fase define su salida como un criterio comprobable (test, E2E o prueba manual en Windows y Arch Wayland) y cada plan específico la refina.
- Revisión periódica: al terminar cada fase se actualiza este documento (estado, desviaciones y ADR nuevos).
