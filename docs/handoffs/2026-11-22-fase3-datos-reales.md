# Handoff · Fase 3, datos reales

Estado: en curso (actualizado el 23-11 por la tarde)

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

## En curso

| Issue | Rama / worktree | Estado | Cómo seguir |
| --- | --- | --- | --- |
| #319 pantalla de Campeones | `feat/319-champions-screen`, `../riftlegends-319` | Codex gpt-6.2-astra high, cortado por límite; reanudación programada a las 22:50 | `~/.cache/rift-tmp/codex/319-report.json` o `319-events2.jsonl`; revisar, capturas, PR |
| #360 fotos de jugadores | `feat/360-player-photos`, `../riftlegends-360` | Codex gpt-6.2-sol high, igual | Igual. Codex no tiene red: lanzar después el comando que regenera `photos.json` |

Para reanudar a mano: `~/.cache/rift-tmp/codex/resume.sh NN MODELO EFFORT` (usa el `thread_id` guardado en `NN.thread`).

## Siguiente (por orden)

1. Cerrar la Fase 3: #319, #360, #340 (rasgos desde los datos del juego), #297 (partir módulos) y #253 (calibración real, E2E real, modo real por defecto y créditos).
2. Subir el tiempo límite del test que parsea el contenido real (`packages/core/content/real.test.ts`): pasa de 5 s con la máquina cargada.
3. Fase 3.5, en el orden de dependencias de sus issues.

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
