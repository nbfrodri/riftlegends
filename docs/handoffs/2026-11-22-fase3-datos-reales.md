# Handoff · Fase 3, datos reales

Estado: en curso

Para retomar en una sesión nueva. Decisiones en el [registro](../decisions/README.md); detalle en el [plan 11](../plans/11-datos-reales.md). La Fase 2 está cerrada (Stryker 90,32 %, [handoff anterior](2026-11-21-fase2-draft.md)).

## Hecho el 22-11

- **Plan 11:** foto de datos de Leaguepedia 2026 (#248). Campeones reales desde CommunityDragon (#265, #249). Jugadores y equipos reales (#250), sin duplicados (#281) y con atributos y sembrado creíbles (#280).
- **Logos:** desde la API pública de lolesports.com, autorizado por el usuario (#252, #284).
- **Workflow semanal** que abre un PR con la foto nueva (#266). GitHub Actions ya puede crear PR.
- **Arreglos de la app:**
  - #258: fuentes en las capturas.
  - #259: resultados sin scroll.
  - #260: razones del plan de partida.
  - #261: pantalla de elegir lado.
  - #270: nicks de los jugadores ficticios.
  - #275: marcador de la cabecera.
- **Workflow «Visual baselines»:** regenera todas las capturas (`--update-snapshots=all`).

## En curso (worktrees con trabajo sin commitear)

| Issue | Worktree | Estado | Cómo seguir |
| --- | --- | --- | --- |
| #251 modo real en la app | `../riftlegends-251` | Subagente de Claude (Opus) cortado por el límite: 2 commits (núcleo y select agrupado) y unos 20 ficheros sin commitear | Revisar `git status` y `git diff` y terminar desde ahí. Falta además llamar a `syncTeamLogos` con `packages/core/content/real/logos.json` |
| #287 trayectoria en los atributos | `../riftlegends-287` | Subagente de Claude (Sonnet) cortado: 11 ficheros sin commitear sobre el commit viejo `29c4fa3` (#280 sin squash) | Commitear lo útil y `git rebase --onto origin/main 29c4fa3`. Requisito: ventana de años relativa a la temporada, dentro del workflow semanal y con caché de años pasados |

## Siguiente

1. Terminar #251 y #287 (arriba).
2. Issues nuevos, todavía sin empezar, para delegar en Codex (el usuario lo pidió):
   - **#291:** confirmar un pick vuelve a pintar el tablero. `verify-windows` de `main` falla tras #245, #246 y #262 (0,78 del montaje frente al límite de 0,5). Arreglar la causa, sin relajar el test. Codex sol medium.
   - **#292:** mejorar el panel «Serie» y las tarjetas de lado en la pantalla de elegir lado. Codex astra high.
   - **#293:** iconos oficiales de Riot (CommunityDragon) para KDA, oro, súbditos, daño y visión, con caída a los propios. Codex astra high.
   - **#294:** filas fijas por jugador en el tablero de draft, como en las retransmisiones pro. Hoy `slotRoles` deduce el rol del campeón y los huecos cambian de jugador. Codex astra high, después de #293.
3. **#288:** cambio de temporada automático en el pipeline (mezclar con la temporada anterior mientras haya pocas partidas). Va después de #287.
4. **#253:** calibración con contenido real, E2E de una Bo5 en modo real y créditos. Cierra el plan 11.
5. **PR #290** (carreras aisladas de los datos nuevos): fusionar cuando el CI esté en verde.

Revisado el 22-11: el CI de los PR #131, #245, #246 y #262 pasó. Lo que falló fue el CI posterior sobre `main`:
- #131: un E2E del proceso del núcleo que no se ha repetido.
- #245, #246 y #262: el test de rendimiento del tablero en `verify-windows` (va en #291).

## Cómo trabajar

- **Delegación:** Codex (gpt-6.2-sol medium para lógica y datos; gpt-6.2-astra high para lo visual) con la skill `cross-delegate`, un worktree por issue y `TMPDIR=/home/phobos/.cache/rift-tmp`, porque `/tmp` se llena. Si Codex está sin uso, subagentes de Claude (Sonnet medium; Opus medium para lo visual) sin límite de cuántos a la vez; no ofrecer Codex mientras esté sin uso.
- **Revisión:** revisar siempre antes de fusionar. Los PR en paralelo chocan en `package.json`, `docs/decisions/README.md`, `tools/data-pipeline/README.md` y los JSON de `packages/core/content/real/`. Fusionar uno a uno y rebasar.
- **Capturas:** se regeneran en el CI («Visual baselines»), se descargan con `gh run download RUN -n visual-baselines` y se revisan a mano.
- **Reglas de UI del usuario:** iconos y nunca glifos; nada de «Δ» ni números con signo, salvo + y − en el oro; campeones no disponibles en gris con raya diagonal; desplegables con estilo Caja.
- **Datos:** no se falsean cabeceras de navegador; nunca se publican nombres reales de jugadores (huellas); los logos nunca van al repo.
- **Comprobaciones:** `mise exec -- pnpm verify` (`VITEST_MAX_WORKERS=2` si la máquina va cargada) y `mise exec -- pnpm e2e`.

## Delegaciones en Codex (22-11)

Eventos e informes en `~/.cache/rift-tmp/codex/NN-events.jsonl` y `NN-report.json`. Se revisan antes de abrir PR.

| Issue | Rama | Worktree | Modelo | Estado |
| --- | --- | --- | --- | --- |
| #291 | `perf/291-confirm-rerender` | `../riftlegends-291` | Codex sin uso (hasta 23:17) → Claude Sonnet medium | en curso |
| #292 | `feat/292-series-panel` | `../riftlegends-292` | Codex sin uso → Claude Opus medium | en curso |
| #293 | `feat/293-official-stat-icons` | `../riftlegends-293` | Codex sin uso → Claude Opus medium | en curso |
| #251 | `feat/251-real-mode` | `../riftlegends-251` | Codex sin uso → Claude Opus medium | en curso |
| #287 | `feat/287-career-component` | `../riftlegends-287` | Codex sin uso → Claude Sonnet medium | en curso |
| #294 | — | — | gpt-6.2-astra high | espera a #293 |
| #296 | `chore/296-drop-spike-artifacts` | `../riftlegends-296` | Codex sin uso → Claude Sonnet medium | en curso |
| #297 | — | — | — | espera a #287 y #292 |
