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
- **Calidad de los tests:** mutation testing con Stryker sobre `packages/core` al cerrar cada fase (umbral a fijar en el plan 05); la cobertura se informa, pero no es el objetivo.
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

### Fase 4 — Competición
- Formatos: liga, grupos, Swiss propio (restricciones de región, sin revanchas) y eliminatorias simple y doble; calendario y ligas top; First Stand, MSI y Worlds.
- Modo **Torneo** (IDEA §6) como primer consumidor.
- **Salida:** simular un año competitivo completo IA contra IA de forma determinista y en un tiempo acotado (presupuesto a fijar en su plan).

### Fase 5 — Carrera v1
- Elección de equipo, avance de calendario, bucle diario (IDEA §4), objetivos de directiva (sin despido), guardado y carga con migraciones y versionado de carreras.
- **Gestor de carreras:** carreras ilimitadas (un SQLite por carrera, cada una con su propio equipo), pantalla de cargar y crear carrera, autoguardado, modo ironman opcional, backups rotativos con restauración, y exportar e importar el fichero de una carrera.
- Proyecciones: clasificación, estadísticas, palmarés y head-to-head.
- Pantallas densas: plantilla, calendario, clasificación y perfil de jugador o equipo.
- **Salida:** jugar un split completo y playoffs; cerrar y reabrir la carrera con un resultado idéntico al de continuar sin cerrar.

### Fase 6 — Jugadores, mercado y temporadas
- Evolución por edad y forma, pools de campeones, contratos, renovaciones, agentes libres, academias, **regens**, offseason y bucle de varias temporadas.
- **Salida:** 10 temporadas simuladas con distribuciones de edad, nivel y fichajes dentro de bandas Monte Carlo acordadas.

### Fase 7 — Profundidad de gestión
- Meta y parches entre splits (tiers dinámicos, notas de parche generadas).
- Scouting e información imperfecta.
- Entrenamiento con coste de oportunidad.
- Moral, química y vestuario.
- **Salida:** cada sistema influye en resultados de forma explicable (visible en el desglose) y probada con tests de propiedades.

### Fase 8 — Narrativa e historial
- Noticias, titulares, prensa (ink si hace falta), rivalidades y premios (MVP, All-Pro).
- **Historial completo:** palmarés por año y competición, historial de partidos de cualquier equipo, head-to-head, Hall of Fame y récords, Title Playground, y perfiles de jugadores y equipos con sus movimientos.
- **Salida:** las historias se generan solo a partir de hechos; golden tests de narrativa por semilla.

### Fase 9 — Presentación avanzada
- Minimapa animado 2D (PixiJS) que reproduce los hechos de partida, celebraciones, pulido broadcast del draft y sonido.
- **Salida:** presupuestos de fluidez (60 fps en el PC gaming medio) en Windows y Arch Wayland.

### Fase 10 — Expansión de alcance
- Ligas menores y ascensos, modo **Sandbox/Realidades** (edición de meta y plantillas, simulación IA contra IA).
- **Salida:** subir desde una liga menor hasta una liga top en una carrera.

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
| 04 | Contratos de IPC, comandos y hechos | 2 |
| 05 | RNG, determinismo y golden tests | 2 |
| 06 | Reglas de draft y series (fearless) | 2 |
| 07 | IA de draft explicable y personalidades | 2 |
| 08 | Simulación de partida v1 y timeline | 2 |
| 09 | Pantalla de draft broadcast | 2 |
| 10 | Esquemas de contenido, dataset ficticio y caché de Data Dragon | 2–3 |
| 11 | Pipeline de datos de Leaguepedia y atributos de jugadores | 3 |
| 12 | Formatos de competición y Swiss propio | 4 |
| 13 | Persistencia, hechos, proyecciones y migraciones | 5 |
| 14 | Carrera: calendario, bucle diario y directiva | 5 |
| 15 | Pantallas densas y navegación por teclado | 5 |
| 16 | Jugadores, evolución y regens | 6 |
| 17 | Mercado, contratos y offseason | 6 |
| 18 | Meta y parches | 7 |
| 19 | Scouting e información imperfecta | 7 |
| 20 | Entrenamiento | 7 |
| 21 | Moral y química | 7 |
| 22 | Narrativa, noticias y premios | 8 |
| 23 | Minimapa y presentación avanzada | 9 |
| 24 | Ligas menores y Sandbox | 10 |
| 25 | Empaquetado y repo de releases | 11 |
| 26 | i18n ES/EN y accesibilidad (transversal) | 0–11 |
| 27 | Historial: palmarés, partidos, Hall of Fame, récords y perfiles | 8 |
| 28 | Gestor de carreras: múltiples partidas, autoguardado, ironman, backups y export/import | 5 |

## Riesgos y dependencias clave

- La Fase 1 depende del **estilo visual elegido** (Fase 0).
- Los contratos de IPC (04) y el RNG (05) se fijan antes de cualquier sistema de dominio.
- La persistencia (13) llega en la Fase 5, pero el esquema de hechos se diseña ya en la Fase 2 para no migrar pronto.
- Riesgos residuales del ADR 0001: PI y nombre, coste del draft broadcast, gráficos en Linux, divergencia de carreras y SmartScreen.

## Verificación de este plan

- Copiado a `docs/plans/00-plan-general.md` y commit en `docs/stack-decision`.
- Cada fase define su salida como un criterio comprobable (test, E2E o prueba manual en Windows y Arch Wayland) y cada plan específico la refina.
- Revisión periódica: al terminar cada fase se actualiza este documento (estado, desviaciones y ADR nuevos).
