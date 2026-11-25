# Handoff · Fase 3, datos reales

Estado: en curso (actualizado el 24-11, sesión larga de la madrugada)

Para retomar en una sesión nueva. Decisiones en el [registro](../decisions/README.md); detalle en el [plan 11](../plans/11-datos-reales.md) y el [plan general](../plans/00-plan-general.md).

## Hecho (22 y 23-11)

- **Plan 11:**
  - modo LoL real en la app (#251);
  - trayectoria en los atributos (#287; máximo 94);
  - temporada automática (#288).
- **Draft:**
  - rendimiento al confirmar (#291, #329);
  - panel de serie (#292);
  - filas fijas por jugador (#294);
  - pool solo con iconos y botones de rol (#308);
  - pantalla de lado alineada (#327).
- **Partida y resultados:**
  - iconos oficiales de estadísticas y objetivos (#293, #312);
  - panel por equipo de estructuras y objetivos (#310).
- **UI:**
  - barras de scroll Caja (#307);
  - vetos con retrato.
- **CI:**
  - capturas estables (#317, #331);
  - datos en bruto de los spikes fuera del repo (#296);
  - el repo pasa a público.
- **Plan general y decisiones:**
  - staff y draft delegado (head coach y assistant coach) y finanzas;
  - nacionalidad e idioma;
  - formatos configurables;
  - elección dividida de lado;
  - meta propio por carrera, con parches y maestría;
  - sección Competición y el mismo motor para todas las partidas;
  - ficha de jugador en todas partes;
  - tutorial con Driver.js al final;
  - fichajes de la IA (PR #333).

## Hecho el 23-11

- **Fusionado:** #305 elección dividida (#336), #321 counters y sinergias (#335), #315 tooltip Caja (#343), #318 ficha de campeón (#342), #365 ficha solo con clic derecho y campeón seleccionado (#369), #368 equipos del último split o de la mayoría de splits (#371), #367 retratos en alta resolución (#373) y #337 pantalla de partida con cara a cara en espejo (#372). Arreglo del test U3 (#359).
- **Diseño:** plan 08 ampliado para la **Fase 3.5** (#341). Scouting, segundas divisiones y leyendas (#344). Ascensos y descensos (#370).
- **Milestone Fase 3.5** con #320, #326, #338, #339, #345–#358, #361–#364, #366 y #374.

## Fusionado el 23-11 por la tarde y noche

#365 ficha solo con clic derecho, #368 equipos de liga (último split o mayoría de splits), #367 retratos en alta resolución, #337 cara a cara en espejo, #378 logos sin reiniciar, #377 eventos con jugador, logo y rol, #380 iconos oficiales sin silueta, #319 pantalla de Campeones con detalle, #376 pulido del draft y reglas de botones de toda la app (sin subrayado, hover y pulsado, sin flechas). Docs: scouting y leyendas (#344), ascensos y descensos (#370).

## Fusionado el 24-11

#389, #392, #393, #395, #397, #404, #405, #406, #409 (`SIM_VERSION` 5), #403 (rasgos de campeón desde CommunityDragon; calibración con contenido real), #413 y #414 (plan 12 aprobado; Fase 4 troceada en #418–#429 y #431).

Y después (24-11, tarde y noche): #415, #416, #412, #439, #441, #444, #446, #449, #411 (`SIM_VERSION` 7), #451, #445, #447 (`SIM_VERSION` 8), #453, #452, #454, #450, #440, #442, #461 (Swiss), #455 (oro relativo, K16, `SIM_VERSION` 9), #462 (paneles arriba), #459 (cuadros simple y doble; cerró #423 a mano), #463 (test intermitente del oro: `-0` frente a `0`), #460 (temporizador a lo ancho del tablero).

## En curso

**Cola de fusión** (`~/.cache/rift-ship/queue.sh PID_A_ESPERAR "PR RAMA WORKTREE" ...`; una sola cola encadenada por PID; ship.sh comprueba el CI de `main` tras cada fusión): #464 → #458 → #465 → #466, todos aprobados.

| PR | Issue | Estado | Falta |
| --- | --- | --- | --- |
| #464 | #421 clasificación y desempates | Aprobado; en la cola | — |
| #458 | #438 encuadre común con menos zoom (1,6× el alto de la fila) | Aprobado; en la cola | — |
| #465 | #448 rasgos de kit y CC en el contenido | Aprobado; en la cola | — |
| #466 | #345 anti-AP/AD solo en línea (2 puntos) | Aprobado; en la cola | — |
| #456 | #436 huecos de veto fijos | Aprobado; subagente añadiendo **animación de veto** y vídeo | Vídeo al usuario |
| #457 | #435 pulso de la vista previa (solo el retrato, sin borde) | Arreglado | **Vídeo** al usuario (script de grabación del agente de #456) |
| #467 | #427 internacionales 2026 (`Refs`), gran final opcional | CI en curso; mirar `risk.test.ts` y `snapshot.test.ts` | Visto bueno |
| — | #443 Base de datos (con fotos de jugadores) | Subagente | Capturas con contenido real |

## Siguiente (por orden)

1. #424 encadenado de fases, bombos y plazas (tras #464), #425 calendario, #426 formatos reales de ligas (valorar con el usuario), #428, #429, #431.
2. Fase 3.5: #352 la IA lee cruces de composición, #364 IA según orden y lado, #348, #366, #410.
3. Propuesta pendiente: issue para calibrar los pesos de la IA de draft con drafts pro reales (el usuario preguntó por la IA; ofrecido, sin respuesta).
4. Cerrar la Fase 3 con #253 (calibración real, E2E real) y Stryker.
5. Revisar capturas inestables: `campeones-lista`, `mercado-filters-1280` y `draft-collapsed` cambian en casi cada fusión.

## Delegaciones en Codex (25-11)

| Tarea | Rama y worktree | Modelo | Eventos e informe | Estado |
| --- | --- | --- | --- | --- |
| #253 calibración real y E2E Bo5 real (cierra Fase 3) | `feat/253-real-calibration`, `../riftlegends-253` | gpt-6.2-sol, medium | `~/.cache/rift-tmp/codex/e253.jsonl`, `r253.json` | Fusionado (#478) |
| #424 encadenado de fases, bombos y plazas | `feat/424-stage-chaining`, `../riftlegends-424` | gpt-6.2-sol, medium | `~/.cache/rift-tmp/codex/e424.jsonl`, `r424.json` | Fusionado (#479) |
| #425 calendario de la temporada | `feat/425-season-calendar`, `../riftlegends-425` | gpt-6.2-sol, medium | `~/.cache/rift-tmp/codex/e425.jsonl`, `r425.json` | En curso; Codex no hace push |

Orden acordado con el usuario (25-11): cerrar Fase 3 (#443, #253, Stryker); Fase 3.5 de uno en uno con la estructura de la Fase 4 (#424, #425, #426, #431) en paralelo; #428 y #429 después de la 3.5.

## Avisos

- **Animaciones:** enseñarlas en vídeo o GIF grabado con Playwright `_electron` (`recordVideo`) y contenido real, nunca con capturas fijas.
- **TDD estricto:** el usuario solo aprueba PR con test visto en rojo antes del código.
- **CI:** revisar siempre el CI de los PR y el de `main` tras cada fusión (`verify-windows` solo corre en `main`).

- **No usar `git stash`:** se comparte entre worktrees y ya mezcló trabajo de dos agentes. Usar commits WIP.
- Con varios agentes a la vez, los tests de UI pasan de 5 s y fallan por tiempo. Repetir aislado; el CI decide.
- Las capturas del CI no tienen caché: salen los iconos de respaldo y el contenido ficticio. Abrirlas al usuario con `xdg-open` antes de fusionar.
- Títulos de PR siempre en inglés (el squash los convierte en el commit).
- **Fusiones en cadena:** `~/.cache/rift-ship/ship.sh` (fuera de `rift-tmp`, que los agentes limpian; PR RAMA WORKTREE` rebasa, regenera capturas, espera el CI, fusiona y limpia; se para ante conflictos que no sean de capturas.
- **Disco:** al fusionar, borrar worktree, rama local y `~/.cache/rift-tmp/vis-NN`; limpiar `rift-tmp` de lo que tenga más de una hora.
- **Fable:** solo con permiso del usuario en cada uso.
- **Carga:** con más de 5 agentes la carga pasa de 25 y los tests pesados fallan por tiempo; máximo 4–5 a la vez.
- **Fusionar:** el usuario da el visto bueno a cada PR (el clasificador bloquea fusionar sin él). Capturas: abrirlas desde el worktree del PR con `setsid xdg-open`.

## Cómo trabajar

- **Delegación:** Codex (gpt-6.2-sol medium para lógica y datos; gpt-6.2-astra high para lo visual) con la skill `cross-delegate`, un worktree por issue y `TMPDIR=/home/phobos/.cache/rift-tmp`, porque `/tmp` se llena. Si Codex está sin uso, subagentes de Claude (Sonnet medium; Opus medium para lo visual), hasta unos 6 a la vez porque la máquina se satura; no ofrecer Codex mientras esté sin uso.
- **Repo público** desde el 22-11 (Actions gratis).
- **Revisión:** revisar siempre antes de fusionar. Los PR en paralelo chocan en `package.json`, `docs/decisions/README.md`, `tools/data-pipeline/README.md` y los JSON de `packages/core/content/real/`. Fusionar uno a uno y rebasar.
- **Capturas:** se regeneran en el CI («Visual baselines»), se descargan con `gh run download RUN -n visual-baselines` y se revisan a mano.
- **Reglas de UI del usuario:** iconos y nunca glifos; nada de «Δ» ni números con signo, salvo + y − en el oro; campeones no disponibles en gris con raya diagonal; desplegables con estilo Caja.
- **Datos:** no se falsean cabeceras de navegador; nunca se publican nombres reales de jugadores (huellas); los logos nunca van al repo.
- **Comprobaciones:** `mise exec -- pnpm verify` (`VITEST_MAX_WORKERS=2` si la máquina va cargada) y `mise exec -- pnpm e2e`.

- **Codex primero:** el usuario prefiere delegar en Codex hasta agotar su uso; después, subagentes de Claude (Opus medium para lo visual y Sonnet medium para el resto). Codex no tiene red: las descargas de Leaguepedia o CommunityDragon las lanza Claude.
- **PR que tocan las mismas pantallas:** fusionarlos de uno en uno. Al rebasar, en las capturas en conflicto se toma la de `main` y se regeneran con «Visual baselines».
- **Test de rendimiento del tablero:** si falla de forma puntual, relanzarlo. Si se repite, investigar sin relajarlo (#329).
