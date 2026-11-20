# Handoff: Fase 1, spikes (plan 03)

- Estado: cerrado (Fase 1 resuelta en el ADR 0003)
- Fecha: 2026-11-20
- El código de cada spike es **desechable**: queda en su rama `spike/*` como referencia y no se fusiona. A `main` solo pasan las evidencias, en `docs/research/spikes-2026-11/`.

| Spike | Issue | Rama (referencia, no se fusiona) | Quién | Estado |
| --- | --- | --- | --- | --- |
| S1 draft broadcast (T1) | #73 | `spike/73-broadcast-draft` | Codex `gpt-6.2-astra`, high | ✅ T1 en verde en `power-saver` y `balanced` (Iris Xe). Informe en main (#93) |
| T3 retoque cronometrado | #73 | sobre la rama de S1 | Subagente `sonnet`, medium | ✅ ≈90 s, 1 revisión; vídeos aceptados por el usuario |
| S2 tabla de 500 (T2) | #74 | `spike/74-dense-table` | Subagente `sonnet`, high | ✅ cumple virtualizada; decisión: virtualizar (#91). Informe en main (#92) |
| S3 núcleo determinista (T4) | #75 | `spike/75-deterministic-core` | Codex `gpt-6.2-astra`, high | ✅ Ubuntu y Windows (run 44730369177). Informe en main (#90) |
| S3/S7 empaquetado y guardado (T5, T6) | #76 | `spike/76-packaging-save` | Codex `gpt-6.2-astra`, high | ✅ Arch y Windows en CI; ⏳ checklist manual en máquinas limpias y SmartScreen |
| S8 descarga reanudable (T7) | #77 | `spike/77-resumable-download` | Subagente `sonnet`, medium | ✅ Arch (4 escenarios) y Windows en CI |
| ADR 0003 go/no-go | #78 | — | Claude | ✅ **Go**: se confirma Electron ([ADR 0003](../../decisions/0003-go-no-go-fase1.md)) |

- Encargos y eventos de Codex: `/tmp/claude-1000/-home-phobos-Projects-riftlegends/b906b42a-82c2-495f-9773-221333b9b365/scratchpad/s{1,3}_prompt.md`, `s{1,3}_events.jsonl` y `s{1,3}_report.json`.
- S3 añade un workflow temporal `spike-goldens.yml` (pushes a `spike/**`, Ubuntu + Windows): Claude hace push de la rama para ejecutarlo.
- Al integrar cada spike: revisar el informe, hacer push de la rama `spike/*` (como referencia) y llevar a `main` **solo** el informe (y sus CSV) en un PR `docs(research): …`.
- Si se corta: `git -C <worktree> log --oneline -5` y `status`; retomar con `codex exec resume <thread_id>` desde el worktree.

## Cierre (20-11, noche)

- **Go**: [ADR 0003](../../decisions/0003-go-no-go-fase1.md). La Fase 2 puede empezar.
- **Pendiente para el usuario antes de la primera release pública:** la checklist manual de T6 en un Windows y un Arch limpios (incluido el aviso de SmartScreen) y T1 a mano en un Windows con GPU. Los instaladores NSIS A y B están en el artefacto `nsis-and-evidence-*` del workflow *Spike packaging* de `spike/77-resumable-download` (se conservan 7 días; si caducan, relanzar el workflow).
- **Medición de T1:** al conectar el cargador, el sistema vuelve a poner `power-saver` por su cuenta. Comprueba `powerprofilesctl get` antes de medir.
- **Ramas `spike/*`:** se conservan como referencia hasta que los planes 04 y 05 y el de persistencia hayan aprovechado sus vectores, su esquema y su descargador. Después se archivan como tags `archive/spike-*` y se borran las ramas. Los worktrees locales ya se han quitado.
- **Codex** llegó a su límite de uso el 20-11; el usuario pidió no usarlo más ese día.
