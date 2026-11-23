# Handoff · Fase 3, datos reales

Estado: en curso (actualizado el 23-11 de madrugada)

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

## En curso

| Issue | Rama / PR | Estado | Cómo seguir |
| --- | --- | --- | --- |
| #300 nacionalidad | PR #324 | Capturas subidas, CI en marcha | Fusionar si está en verde |
| #333 fichajes IA (docs) | PR #333 | CI en marcha | Fusionar |
| #305 elección dividida | `feat/305-split-side-choice`, `../riftlegends-305` | Codex gpt-6.2-astra high (desde el 23-11 ~4:20) | Leer `~/.cache/rift-tmp/codex/305-report.json`; revisar, `verify`/`e2e`, push, PR, capturas |
| #321 counters, sinergias y tier para todos | `feat/321-champion-coverage`, `../riftlegends-321` | Codex gpt-6.2-sol high | Igual, con `321-report.json`. Comprobar la calibración K1–K5 |

Si Codex se corta, `tail -1 ~/.cache/rift-tmp/codex/NN-events.jsonl` dice por qué. Se retoma con `cd ../riftlegends-NN && codex exec resume <thread_id> ...` (el `thread_id` va en la primera línea de los eventos) o con un subagente de Claude desde el worktree.

## Siguiente (por orden)

1. **#315:** tooltip Caja único para toda la app y guarda contra `title=`.
2. **#318:** ficha de campeón (con pista visible de clic derecho). Después, **#319**: pantalla de Campeones con tier list por rol. Dependen de #321.
3. **#326:** bajas, daño y nota realistas por rol y tipo de campeón (bandas sacadas del snapshot), junto con **#320**: composiciones contra las resistencias del rival. Necesitan una sección de diseño en el plan 08.
4. **#297:** partir los módulos grandes. **#253:** calibración con contenido real, E2E en modo real y créditos; cierra el plan 11.

## Cómo trabajar

## Cómo trabajar

- **Delegación:** Codex (gpt-6.2-sol medium para lógica y datos; gpt-6.2-astra high para lo visual) con la skill `cross-delegate`, un worktree por issue y `TMPDIR=/home/phobos/.cache/rift-tmp`, porque `/tmp` se llena. Si Codex está sin uso, subagentes de Claude (Sonnet medium; Opus medium para lo visual) sin límite de cuántos a la vez; no ofrecer Codex mientras esté sin uso.
- **Repo público** desde el 22-11 (Actions gratis).
- **Revisión:** revisar siempre antes de fusionar. Los PR en paralelo chocan en `package.json`, `docs/decisions/README.md`, `tools/data-pipeline/README.md` y los JSON de `packages/core/content/real/`. Fusionar uno a uno y rebasar.
- **Capturas:** se regeneran en el CI («Visual baselines»), se descargan con `gh run download RUN -n visual-baselines` y se revisan a mano.
- **Reglas de UI del usuario:** iconos y nunca glifos; nada de «Δ» ni números con signo, salvo + y − en el oro; campeones no disponibles en gris con raya diagonal; desplegables con estilo Caja.
- **Datos:** no se falsean cabeceras de navegador; nunca se publican nombres reales de jugadores (huellas); los logos nunca van al repo.
- **Comprobaciones:** `mise exec -- pnpm verify` (`VITEST_MAX_WORKERS=2` si la máquina va cargada) y `mise exec -- pnpm e2e`.

- **Codex primero:** el usuario prefiere delegar en Codex hasta agotar su uso; después, subagentes de Claude (Opus medium para lo visual y Sonnet medium para el resto). Codex no tiene red: las descargas de Leaguepedia o CommunityDragon las lanza Claude.
- **PR que tocan las mismas pantallas:** fusionarlos de uno en uno. Al rebasar, en las capturas en conflicto se toma la de `main` y se regeneran con «Visual baselines».
- **Test de rendimiento del tablero:** si falla de forma puntual, relanzarlo. Si se repite, investigar sin relajarlo (#329).
