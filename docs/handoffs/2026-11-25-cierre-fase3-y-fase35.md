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
PR #577 (#572) aprobado y en la cola (`queue-577.log`).
| #486 componente de cuadro (eliminatorias) | Opus medium | `../riftlegends-486`, feat/486-bracket-view | main; sin conectar a la ruta hasta que entre #483 |

#482: PR #579; el usuario decidió (26-11) fearless de la competición (hard por defecto, configurable) para todas las series de la temporada, temporizador de Ajustes en la serie del usuario y sin abandonar; resto aprobado. El subagente lo está aplicando. #577 fusionado. #484, #485 y #487 esperan a #483 (misma ruta).
PR #580 (#578) aprobado y en la cola (`queue-580.log`).
PR #579 (#482) con las decisiones aplicadas, aprobado y en la cola (`queue-579.log`).

Estado 26-11 ~04:00: fusionados #580 (#578) y #579 (#482). Cola vacía.
| #489 tournament.create y pantalla de torneo | Opus medium | `../riftlegends-489`, feat/489-tournament-setup | main |
Siguen: #528 (Sonnet), #483 (Opus, avisado de #579), #486 (Opus). Stryker a las 05:00: con agentes trabajando puede ir lento; revisar `~/.cache/rift-tmp/stryker.log`.

Estado 26-11 ~05:00:
- PR #582 (#483): el usuario pide **diseño más bonito** y arreglar el **logo de CBLOL** (falta en la caché de ligas); el subagente Opus lo está haciendo. Resto de decisiones pendientes de visto bueno tras ver el nuevo diseño.
- PR #581 (#486): aprobado con cambio: logo real y nombre corto en cada tarjeta, nombre completo en tooltip; subagente Opus aplicándolo.
- Issues nuevos: #583 (nombres reales de fase ES/EN), #584 (rendimiento del año IA contra IA; subagente Sonnet en `../riftlegends-584`, perf/584-season-speed, sin tocar `packages/core/match` por #528).
- Siguen: #528 (Sonnet), #489 (Opus).

Estado 26-11 tarde:
- #581 (#486) aprobado y en la cola (`queue-581.log`).
- PR #587 (#489 torneo): decisiones aprobadas; falta quitar «·» de las plazas («LCK 2.º»), subagente Opus aplicándolo; después encolar (conflicto esperado con #582 en `router.tsx` y `sidebar.tsx`: mantener ambos).
- PR #585 (#528): F13/K4 aligerados a 15 s; arreglando el E2E de #536 que dependía de la simulación vieja.
- PR #582 (#483): rediseño sin punto ni «En juego», sin «·».
- #586 (quitar «·» en toda la app): subagente Opus en `../riftlegends-586`.
- Reglas nuevas del usuario (26-11): sin «·» en textos; nada de estética «AI slop» (puntos de estado, pastillas, brillos); splits «Winter/Spring/Summer Split» en inglés (#583).
- Stryker de las 05:00 abortó (C2 superó 60 s con la máquina cargada). Relanzar con la máquina libre: `~/.cache/rift-tmp/stryker-night.sh`.
- Cola: #581 → #588 (docs: menú principal y carrera separados, aprobado) → #582 (Competición rediseñada, aprobada).
- Riesgo anotado para #584: un día con muchas ligas puede superar el límite de 10 s del puente IPC y reiniciar el núcleo (se pierde la temporada de exhibición).
- Limpieza 26-11: `~/.cache/rift-tmp` de 2,1 GB a 7 MB y ramas locales `worktree-agent-*` fusionadas borradas.
- Cola (26-11 tarde): #588 → #582 → #585 (#528, aprobado) → #590 (#584 primera parte, 2,5× más rápido, aprobado).
- Siguiente en #584 (decisión del usuario): tras fusionar #582, #585 y #590, (1) `season.playDay` por tandas de series con progreso (ninguna llamada > ~1 s; toca los controles de avance de #582) y (2) acelerar la IA sin cambiar resultados (reutilizar la puntuación del rival al mirar adelante y podar). Un año cuesta ~187 s; objetivo ≤ 60 s.
- #589 (centrar iconos del cara a cara): subagente Opus en `../riftlegends-589`.
- Cola añadida: #592 (#589 iconos centrados, aprobado) → #591 (#586 sin «·», aprobado sin el equipo junto al MVP). #588 fusionado.
- #585 (#528) fusionado: `SIM_VERSION` 16. Siguiente de la 3.5: #529 (contar solo a los vivos), subagente Sonnet en `../riftlegends-529`, feat/529-living-contests.
- Cola: #590 → #592 → #591 → #582 (reencolado tras resolver conflicto de catálogos i18n con #581).
- #590 falló en CI porque la huella de `season-replay.test.ts` era anterior a #585; comprobado que `main` y la rama dan la misma huella (`f06d0ab…`), actualizada y reencolado (`queue-590b.log`). Cola: #592 → #591 → #582 → #590.
- Nuevos: #583 en Codex (gpt-6.2-sol medium, `../riftlegends-583`, `r583.json`/`e583.jsonl`, thread 01a21848-9490-7102-8ac3-443aa5b4cc30); #484 y #485 con subagentes Opus desde la rama de #582 (`../riftlegends-484`, `../riftlegends-485`), PR solo cuando #582 esté en `main`.

## Reanudación 26-11 noche (se cerró la terminal)
- En `main`: #581, #588, #592, #585 (`SIM_VERSION` 16), #591, #582. CI de `main` en verde (f75f79a).
- Cola: #590 (`queue-590c.log`), con el CI relanzado; su fallo es el E2E inestable de «Parar» (`competition.spec.ts`), que arregla la parte 2 de #584.
- Subagentes reanudados: #529 (`../riftlegends-529`, implementación a medias sin commitear), #570 (`../riftlegends-570`, rama scratch de tiempos en Windows), #587/#489 (fusionar `main` y verificar).
- #583: Codex (gpt-6.2-sol medium, verificado) dejó dos commits; un subagente Sonnet revisa, fusiona `main`, conecta los nombres a la UI de Competición y abre el PR.
- Esperando visto bueno del usuario: #594 (clasificación) y #595 (calendario), con capturas con logos reales; se encolan #595 primero y #594 después.
- Pendiente: #593 (calendario día/semana/mes) tras #595; parte 2 de #584; Stryker con la máquina libre.
- **`main` en rojo** tras #590: `e2e/competition.spec.ts:10` falla en Linux y Windows (run 45855151096). Cola pausada: #595 → #594 aprobados, encolar cuando `main` esté verde; #587 (#489) aprobado, `main` fusionado y verify local verde, mismo bloqueo. El subagente de #584 parte 2 saca primero un PR pequeño (tandas de series) que lo arregle.
- #596 (#529): el usuario acepta K19 como fallo esperado hasta #530 y pide recalibrar K5, K6 y K16 sin ensanchar bandas; el subagente lo está haciendo.
- PR #597 (#583 nombres de fase, `../riftlegends-583`) aprobado. Orden de cola cuando `main` esté verde: EN COLA (`queue-599b.log`, E2E de «Parar» hecho determinista): #599 (fix de main, tandas de series) → #598 → #595 → #594 → #587 → #597 (último: quita el export de `stageName`, que #594 y #595 usan; habrá que pasarlos a `stageLabel`). #594 y #595 deben pasar a `stageLabel`/`stageText` de `competition/names.ts` al fusionar.
- 26-11 noche: en `main` #599, #598, #595. Cola: #600 (IA 123 → 81 s, huella del año idéntica, aprobado) → #597. #594 y #587 en conflicto (con #595 y #599); sus subagentes los resuelven y luego se reencolan. Follow-up de rendimiento (perf/584-ai-speed-2) en marcha. #593 (calendario día/semana/mes) en marcha. #596 (#529) recalibrado sin ensanchar; arreglando un desborde de «Lado y orden» en el game 5.
- **Stryker** programado para el **27-11 a las 03:00** (`systemctl --user list-timers rift-stryker-night*`, script `~/.cache/rift-tmp/stryker-night.sh`): solo arranca con carga < 2 (espera hasta las 09:00) y solo aplica `stryker-config.patch` (excluye las calibraciones Monte Carlo del Stryker; **sin subir límites de tests**, regla del usuario del 26-11). Log en `~/.cache/rift-tmp/stryker.log`. Con el resultado: PR con el patch y la nota en el plan 05 para cerrar la Fase 3. La rama `test/stryker-timeouts` (`../riftlegends-stryker-fix`) ya no sirve: borrarla.
- #596 (#529, `SIM_VERSION` 17) aprobado y en la cola (`queue-596.log`). Después: #530 (ventana de conversión; arregla K19).
- #597 listo (CI verde) pero va **después** de #596 y #594: su subagente fusionará `main`, pasará la clasificación de #594 a `stageLabel`/`stageText` y recalculará las huellas de la temporada; luego encolar.
- PR #604 (#593 calendario día/semana/mes) aprobado; cola: #594 → #587 → #604 (choque esperado con #594 en el hub) → luego #597 (adaptar #594 y #604 a `stageLabel`).
- PR #603 (#584 parte 2b, año ~73 s, huella idéntica) aprobado y en cola tras #604. Tercer PR de rendimiento (solo IA, perf/584-ai-speed-3) en marcha, con entrega antes de las 02:30 por Stryker.
- #584: año ~88 s con `SIM_VERSION` 17. IA cerca de su suelo (tercer PR descartado). Siguiente: abaratar `edge` de la simulación tras #530.
