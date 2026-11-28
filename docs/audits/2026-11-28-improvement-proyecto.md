# Auditoría: mantenibilidad (todo el proyecto)

- **Fecha:** 2026-11-28
- **Autor:** Claude (Fable 5.2) con tres revisores de solo lectura (Opus 5.5): arquitectura, calidad del código y tests. Documentación y proceso, revisados aparte.
- **Alcance:** `main` en 7728a9c0. Todo el monorepo, el CI y la documentación. No se ejecutaron tests, builds ni Stryker: la evidencia sale de leer el código, de los logs locales y del CI.
- **Veredicto:** mantenible. Las capas están bien separadas, los módulos son pequeños y las reglas se vigilan con tests. Hay un fallo real, dos decisiones de diseño que conviene tomar antes de la Fase 5 y deuda barata de arreglar.

## Hallazgos

Ordenados por impacto dividido por esfuerzo (S, M o L).

| # | Gravedad | Hallazgo | Dónde | Esfuerzo | Estado |
| --- | --- | --- | --- | --- | --- |
| 1 | Alta | La serie del usuario se vuelve a simular con la IA al leer su detalle | `packages/core/competition/season-records.ts:57` | S | abierto, #649 |
| 2 | Alta | Stryker no se puede ejecutar desde `main` | `vitest.stryker.config.ts:7` | S | abierto, #650 |
| 3 | Alta | `pnpm verify` nunca sale en verde en local | `vitest.config.ts:4-62` | M | abierto, #651 |
| 4 | Media | Los identificadores de disputa no tienen registro ni test de unicidad | `packages/core/match/loop.ts:77` | S | abierto, #652 |
| 5 | Media | Las bandas de «fallo esperado» pasan con cualquier error | `packages/core/match/calibration/calibration.test.ts:156` | S | abierto, #653 |
| 6 | Media | Fórmulas duplicadas: tiempo de muerte y división entera | `tools/data-pipeline/timelines.ts:115`, `packages/core/match/economy.ts:13` | S | abierto, #654 y #655 |
| 7 | Media | Los tests de la temporada viven en la app y su digest es un hash a mano | `apps/desktop/src/core-host/season-replay.test.ts:21` | S-M | abierto, #656 |
| 8 | Alta | El enrutado del host y la relectura de series no aguantan la carrera | `apps/desktop/src/core-host/host.ts:118-194` | M | abierto, #657 (plan 13) |
| 9 | Media | Conocimiento del proyecto fuera de `main` o desfasado | `docs/decisions/README.md:110` | M | abierto, #658 y #659 |
| 10 | Baja | Duplicación en la interfaz y en los arneses de test | `apps/desktop/src/renderer/competition/swiss/swiss-rounds.tsx:373` | S-M | abierto, #660 a #663 |

## Detalle

### 1. La serie del usuario se vuelve a simular con la IA

`recordSeries` guarda la serie del usuario igual que las de la IA: `fixture`, `seed` y `fearless` (`season-play.ts:97`). Al pedir su detalle, `replay` (`season-records.ts:57`) llama a `playSeasonSeries`, que usa `aiTurn` en los dos lados. `series.summary` y `match.view` con `series` pueden devolver mapas y MVP que el usuario no jugó. Se ve en la pantalla de campeón del torneo y al abrir la serie desde el calendario.

Verificado leyendo el código; falta el test rojo. `season-human.test.ts:163` solo comprueba `ok: true`.

**Arreglo:** el registro de una serie humana guarda sus comandos y `replay` los repite. La decisión de fondo (guardar el detalle o volver a simular) va en el plan 13: volver a simular choca con el ADR 0001.

### 2. Stryker no se puede ejecutar desde `main`

- `vitest.stryker.config.ts` incluye la calibración y `risk.test.ts` y no incluye los tests de competición de `core-host`, que son los únicos que mueven `seasonDispatcher`.
- El 29 % de los mutantes son estáticos y se llevan el 91 % del tiempo (estimación de 30 a 47 h). Salen de tests que juegan sus partidas al cargar el fichero: `calibration.test.ts:99`, `grubs.test.ts:15` y `map.test.ts:9`.
- El último run válido de `mutation.yml` es del 22-11.

**Arreglo:** llevar a `main` el include y los exclude, y calcular esas partidas dentro del test, memoizadas. No cambia muestras ni bandas.

### 3. `pnpm verify` nunca sale en verde en local

De 9 logs locales revisados, ninguno pasó: entre 1 y 146 fallos, casi todos `Test timed out in 5000ms`. En el CI la misma suite pasa en 147 s. Los tests rápidos, la calibración Monte Carlo y los de pantalla con el núcleo real corren en una sola pasada con 7 workers, y 29 ficheros DOM que usan el núcleo real suman 143 de los 160 s de tests DOM.

**Arreglo:** separar un proyecto rápido y otro lento con menos workers, en jobs paralelos del CI. La guarda de `title` nativo, que compila el monorepo entero dentro de Vitest, pasa a un paso de lint.

### 4. Identificadores de disputa sin registro

Los IDs que alimentan `deriveSeed(…, contest.id)` son literales sueltos en `contests/lane.ts`, `objectives.ts`, `structures.ts`, `fights.ts` y `conversion.ts`. `SCOPES` sí tiene registro y test; las disputas no. Dos PR en paralelo pueden elegir el mismo número y compartir tiradas sin que nada falle.

### 5. Bandas de «fallo esperado»

K23 a K27 y K11 agrupan de 2 a 4 `expect` en un `test.fails`, que da verde con cualquier error. Un campo renombrado da `NaN` y sigue contando como fallo esperado.

### 6. Fórmulas duplicadas

- El pipeline escribe a mano la tabla del tiempo de muerte (`timelines.ts:115-141`) y el núcleo la lee de `rules.json`. Las bandas K19 a K22 miden «vivo» con una y la simulación decide con la otra.
- La división entera y el redondeo están reescritos en 8 módulos del núcleo sin `assertSafeInteger`.

### 7. Tests de la temporada

Unas 1.900 líneas de `apps/desktop/src/core-host/season*.test.ts` son los únicos tests del dispatcher de la temporada. Quedan fuera de Stryker y del job `core-windows`. El digest de la temporada real es un sha256 escrito a mano que no dice qué hecho cambió.

### 8. Enrutado del host y carrera

`host.ts` reparte los mensajes por prefijo, por `params` y por `claims`, con un estado y una posición por módulo. Con mercado, staff y finanzas, cada sistema sería otro módulo sin atomicidad entre ellos. Propuesta para el plan 13: un módulo `career` con un solo estado, un mapa kind → módulo con test de dueño único y un dispatcher tipado por catálogo.

### 9. Conocimiento fuera de `main`

- El registro de decisiones pesa 97 KB en 212 filas y se carga en cada sesión. Dice `FULL_TEAM_BOOST` 150 % y el código vale 145 (`match/contests/fights.ts:19`).
- El handoff vivo está en la rama `docs/handoff-2026-11-24`, sin fusionar.
- La cola de merge y el script de Stryker están en `~/.cache`.
- El plan 08 está archivado pero se sigue editando.

### 10. Duplicación en la interfaz

- El título de página está copiado en 10 `h1` y hay 4 constantes `page` casi iguales (#660).
- La casilla de serie y el cálculo del ganador están en cuadro, Swiss y calendario (#661).
- Los paneles de filtros de Mercado y Base de datos se repiten, y la guarda del cursor castiga extraer clases (#662).
- El árbol de providers de los tests está en 5 arneses, y `seasonFact` en 7 ficheros (#663).

## Más hallazgos

| Hallazgo | Dónde | Estado |
| --- | --- | --- |
| «Jugar día» queda activo un instante de más y el E2E E1 lo esquiva con un `catch` | `apps/desktop/e2e/tournament.spec.ts:84` | abierto, #664 |
| Las capturas visuales cambian con cada cambio de simulación | `apps/desktop/e2e/visual/` | sin issue |
| El sorteo nuevo tiene poca cobertura de mutación (`stage-draw.ts`, 50 %) | `packages/core/competition/stage-draw.ts` | sin issue |
| Unas 140 aserciones sobre clases de Tailwind en tests | `apps/desktop/test/face-to-face.test.tsx:194` | sin issue |
| El pipeline importa internos del núcleo sin declararlo | `tools/data-pipeline/league-format-check.ts:2` | sin issue |
| `match` depende de `ai/content-index` y hay un ciclo `ai` ↔ `draft` | `packages/core/match/state.ts:9` | sin issue |
| 81 constantes de equilibrio repartidas en 24 módulos, además de `rules.json` | `packages/core/match/contests/edge.ts:41` | sin issue |

## Qué está bien

- **Capas:** el renderer no importa el núcleo y habla con él por IPC. El núcleo no conoce Electron ni React, y lo vigila `core/test/boundaries.test.ts`.
- **Tipos:** en producción, 0 `@ts-ignore`, 0 `!` y 2 `any` justificados.
- **Tamaño:** solo un fichero del núcleo supera las 300 líneas, con excepción justificada.
- **Determinismo:** registro `SCOPES` con test, goldens con cabecera de versión y punto fijo.
- **Dispatcher** puro e idempotente por `expectedPosition`: buena base para SQLite.
- **Reutilización:** Torneo usa el mismo hub, avance y serie que Competición.
- **Provisional declarado:** solo 2 `TODO`; los `test.fails` coinciden con decisiones del registro.
- **CI:** unos 12 minutos por PR; Playwright sin reintentos.

## No cubierto

- No se midió la cobertura de líneas ni se ejecutó ninguna suite.
- Los tiempos locales salen de logs hechos con la máquina cargada.
- El informe de mutación usado cubre solo `packages/core/competition`.
- No se revisaron rendimiento, seguridad ni diseño visual.
