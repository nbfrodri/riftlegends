# Handoff: Fase 1, spikes (plan 03)

- Estado: en curso
- Fecha: 2026-11-20
- El código de cada spike es **desechable**: queda en su rama `spike/*` como referencia y no se fusiona. A `main` solo pasan las evidencias, en `docs/research/spikes-2026-11/`.

| Spike | Issue | Rama | Dónde | Quién (elegido por el usuario) | Estado |
| --- | --- | --- | --- | --- | --- |
| S1 draft broadcast (T1) | #73 | `spike/73-broadcast-draft` (subida) | `/home/phobos/Projects/riftlegends-s1` | Codex `gpt-6.2-astra`, high | ⚠️ cortado por límite de Codex (vuelve a las 16:59): escena y medidor en el commit `19db294`; **faltan las medidas y el informe**. Retomar con `cd /home/phobos/Projects/riftlegends-s1 && codex exec resume 01a1f8bc-8f54-7b23-be73-1543fc2b58a7 -m gpt-6.2-astra -c model_reasoning_effort='"high"' "Continúa S1: ejecuta las medidas de T1 y escribe el informe" </dev/null` |
| T3 retoque cronometrado | #73 | sobre la rama de S1 | — | Subagente `sonnet`, medium | tras S1 |
| S2 tabla de 500 (T2) | #74 | `spike/74-dense-table` (subida) | — | Subagente `sonnet`, high | ✅ hecho: sin virtualizar NO cumple (36–45 FPS); virtualizada cumple (60 FPS). Decisión: virtualizar (#91). Informe en main |
| S3 núcleo determinista (T4) | #75 | `spike/75-deterministic-core` | `/home/phobos/Projects/riftlegends-s3` | Codex `gpt-6.2-astra`, high | ✅ T4 en verde en Ubuntu y Windows (run 44730369177); informe en main |
| S3/S7 empaquetado y guardado (T5, T6) | #76 | — | — | (preguntar) | tras S3 |
| S8 descarga reanudable (T7) | #77 | — | — | (preguntar) | tras #76 |
| ADR 0003 go/no-go | #78 | — | — | Claude | al final |

- Encargos y eventos de Codex: `/tmp/claude-1000/-home-phobos-Projects-riftlegends/b906b42a-82c2-495f-9773-221333b9b365/scratchpad/s{1,3}_prompt.md`, `s{1,3}_events.jsonl` y `s{1,3}_report.json`.
- S3 añade un workflow temporal `spike-goldens.yml` (pushes a `spike/**`, Ubuntu + Windows): Claude hace push de la rama para ejecutarlo.
- Al integrar cada spike: revisar el informe, hacer push de la rama `spike/*` (como referencia) y llevar a `main` **solo** el informe (y sus CSV) en un PR `docs(research): …`.
- Si se corta: `git -C <worktree> log --oneline -5` y `status`; retomar con `codex exec resume <thread_id>` desde el worktree.

## Estado (20-11, tarde)

- **Session ids de Codex** (para `codex exec resume`, ejecutado desde su worktree): S1 `01a1f8bc-8f54-7b23-be73-1543fc2b58a7`, S3 `01a1f8bc-8f1c-7613-bdce-6737f161027f`. Codex estaba cerca de su límite de uso.
- **S3:** dos commits en `spike/75-deterministic-core` (núcleo + informe de T4). Falta hacer push de la rama para que `spike-goldens.yml` compare los goldens en Ubuntu y Windows.
- **S1:** escena montada (Motion 14.13.0, PixiJS 8.23.0), midiendo; los cambios están en el worktree sin commit todavía.
- **Dato a tener en cuenta en el ADR 0003:** el equipo de medición tiene una **GPU integrada Intel Iris Xe (i915)** y un panel a 60 Hz, por debajo del «PC gaming medio» objetivo. Si T1 o T2 fallan por FPS, interpretar el resultado con eso antes de activar el plan B (por ejemplo, repetir en una GPU dedicada).
