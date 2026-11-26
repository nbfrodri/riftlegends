# Handoff · Cierre de la Fase 3 y Fase 3.5

Estado: en curso (25-11, 23:30). Fusionados hoy en esta sesión: #561, #534, #563, #564, #565, #567, #569 (arregla #557; #570 abierto hasta ver varias ejecuciones de `verify-windows` en verde), #571 (arregla #536). En la cola solo queda #566. Abiertos: #570, #572 (partida desborda 36 px con nombres largos). Stryker sigue programado a las 05:00 del 26-11. Sustituye a [2026-11-22-fase3-datos-reales.md](2026-11-22-fase3-datos-reales.md).

Decisiones en el [registro](../decisions/README.md). Reglas del usuario: respuestas en español, claras y breves; **TDD estricto** (commit de test en rojo y después el de implementación); **nada de `git stash`** ni force-push; **títulos de PR en inglés** (Conventional; el squash los usa como commit) y cuerpo en español; visto bueno del usuario antes de fusionar, con capturas (vídeo si hay animación); vigilar el CI de cada PR y de `main` tras cada fusión; máximo 4–5 subagentes (Sonnet medium lógica, Opus medium visual); Codex `gpt-6.2-sol` medium para tareas sin red.

## Cómo se fusiona

- `~/.cache/rift-ship/queue.sh WAIT_PID "PR RAMA WORKTREE" …`: espera al PID, fusiona `origin/main` en la rama (sin rebase), regenera capturas en el CI, espera el CI del PR, hace squash, limpia worktree y rama, y comprueba el CI de `main`. Log en `~/.cache/rift-tmp/queue-<PR>.log` (`grep -E "^[0-9]+ (MERGED|main|CI|CONFL)|STOP"`).
- Si sale `CONFLICTS`: fusionar `origin/main` a mano en el worktree, resolver, commit y volver a encolar al final.
- La GraphQL de GitHub falló a ratos el 25-11: crear issues y PR con `gh api` (REST).

## Cola de fusión (aprobados por el usuario), en orden

#542 (timelines, K19–K22) → #556 (pantalla de carga espera a toda la caché) → #561 (logo CBLOL) → #534 (nombres largos y tabla centrada) → #563 (edad del jugador) → #564 (cerrar lectura de la IA) → #565 (causas traducidas) → #566 (jugadores de relleno y nacionalidades; puede chocar con #563 en las consultas de nacionalidad y `players.json`: si sale CONFLICTS, resolver a mano, regenerar el snapshot con el pipeline y volver a encolar) → #567 (ficha con barras) → #569 (candado de la caché en Windows, #557; #570 pendiente de ver `verify-windows` en `main`) → #571 (momento clave entero, #536) → #566 (reencolado como `queue-566c.log` tras un fallo de formato; resuelto el choque con #563: consulta con `Page` y `Birthdate`, fechas por redirección, snapshot regenerado) → después abrir el PR de #568. Comprobar el CI de `main` tras cada uno.

## Trabajo en marcha

| Qué | Dónde | Estado |
| --- | --- | --- |
| #558 ficha con barras (opción A) | PR #567, aprobado y en la cola | — |
| #559 edad del jugador | PR #563, aprobado y en la cola | — |
| #562 relleno y nacionalidades | PR #566, aprobado y en la cola | — |
| #557 cuelgues de caché en Windows | PR #569, aprobado y en la cola | — |
| #536 momento clave cortado | PR #571, aprobado y en la cola; #572 (partida desborda 36 px con nombres largos) abierto | — |
| #568 plantillas de lolesports | PR #575 aprobado, en la cola tras #574 | — |
| #546 cerrar «Lectura de la IA» con clic fuera | PR #564, aprobado y en la cola | — |
| #550 causas sin traducir | PR #565, aprobado y en la cola | — |

Si un subagente se perdió con el `/clear`, su trabajo está en su worktree: revisar `git log origin/main..HEAD` y `git status`, y terminarlo.
Para Codex: leer `r<N>.json`, comprobar con `tack codex-used <thread_id>` (primera línea de `e<N>.jsonl`), revisar que haya commit de test separado, fusionar `main`, push, PR por REST y capturas.

## Programado

- **Stryker** completo sobre `packages/core` a las **05:00 del 26-11** (`systemctl --user list-timers rift-stryker-night*`, script `~/.cache/rift-tmp/stryker-night.sh`, log `~/.cache/rift-tmp/stryker.log`). Umbral 70 %. Con el resultado, PR desde `../riftlegends-stryker-fix` (sube límites de 2 tests pesados y excluye las calibraciones de Stryker) + nota en el plan 05. Cierra la Fase 3.

## Pendiente de decidir

- Ninguno. (El usuario aprobó usar la plantilla de lolesports como reserva y desempate de titulares: issue **#568**, después de #566; anotarlo en el registro en ese PR.)

## Siguiente

1. **Fase 3:** #536 («Momento clave» cortado, tras #534), #557 (tests de caché que se cuelgan en Windows), #538 cerrado por #541. Con Stryker ≥ 70 % se cierra la fase.
2. **Fase 3.5, de uno en uno:** #525 (refactor de `state.ts`, `face-to-face.tsx`, `team-column.tsx` + guarda de 300 líneas) → #528 → #529 → #530 → #531 (tiempos de muerte, plan en la sección #523 del plan 08) → #339, #374 → #540 (K23–K27 y bajas por partida) → resto (#356, #362, #363, #410, #320, #350, #351, #354, #355, #326, #338, #357, #358).
3. **Fase 4:** #428, #429 tras la 3.5; luego el plan 31 (#481–#491).
4. Abrir el PR de este handoff (rama `docs/handoff-2026-11-24`, incluye el cambio de `AGENTS.md` sobre títulos de PR en inglés) cuando la cola esté vacía.

## Delegaciones en Codex (25-11)

| Tarea | Rama | Estado |
| --- | --- | --- |
| #426 formatos de liga | feat/426-league-formats | terminado por un subagente; fusionado (#518) |
| #366 multikills | feat/366-multikills-kda | fusionado (#520) |
| #524 nombres en diferencias por rol | fix/524-role-gaps-fit | en la cola (#534) |
| #508 eventos funcionales | feat/508-match-events | fusionado (#547) |
| test Q4 lento | test/snapshot-q4-speed | fusionado (#541) |
| #535 reglas LEC y LCK Cup | feat/535-lec-lck-cup-rules | fusionado (#543) |
| #546, #550 | ver arriba | en curso |
| #525 refactor (gpt-6.2-sol medium, verificado con `tack codex-used`) | refactor/525-split-modules en `../riftlegends-525` | PR #573 abierto, verify en verde; capturas idénticas a main; **aprobado** y en la cola tras #575 (`queue-573.log`) |
| #428 temporada en el dispatcher | PR #574; 3 decisiones **aprobadas por el usuario** (fila en el registro, 26-11); en la cola (`queue-574.log`) | — |

## Subagentes en marcha (26-11, madrugada)

| Issue | Modelo | Worktree y rama | Base |
| --- | --- | --- | --- |
| #572 partida desborda con nombres largos | Opus medium | `../riftlegends-572`, fix/572-match-fit | main |
| #481 consultas de vista de competición | Sonnet medium | `../riftlegends-481`, feat/481-competition-views | rama de #574; PR solo tras fusionar #574 |
| #528 tiempos de muerte (Fase 3.5) | Sonnet medium | `../riftlegends-528`, feat/528-death-timers | rama de #573; PR solo tras fusionar #573 |
| #578 columnas de la tabla se mueven al hacer scroll (Base de datos) | Opus medium | `../riftlegends-578`, fix/578-table-columns | main |

Estado 26-11 ~01:00: fusionados #574, #575, #573. En la cola: #576 (#481, decisiones aprobadas por el usuario). PR #577 (#572) esperando visto bueno con capturas `~/.cache/rift-tmp/572-*.png`. #528 puede abrir PR (avisado).
| #482 serie del usuario en la temporada (humanTeam) | Sonnet medium | `../riftlegends-482`, feat/482-human-series | main |
| #483 ruta /competicion y controles de avance | Opus medium | `../riftlegends-483`, feat/483-competition-route | main |

Estado 26-11 ~02:00: fusionado también #576 (#481). Cola vacía. #429 espera al final de la 3.5 (su golden cambia con cada `SIM_VERSION`).
