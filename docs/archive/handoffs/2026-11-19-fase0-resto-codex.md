# Handoff: Fase 0, issues #15–#18 (delegado a Codex en dos sesiones)

- Estado: hecho
- Fecha: 2026-11-19

| Sesión | Issues | Ramas (apiladas) | Worktree | Modelo y effort (elegidos por el usuario) |
| --- | --- | --- | --- | --- |
| A | #15 app Electron segura, #16 CI | `feat/15-electron-shell` → `ci/16-github-actions` | `/home/phobos/Projects/riftlegends-f0a` | `gpt-6.2-astra`, high |
| B | #17 Dependabot, #18 documentación de desarrollo | `chore/17-dependabot` → `docs/18-dev-guide` | `/home/phobos/Projects/riftlegends-f0b` | `gpt-6.2-sol`, medium |

- Encargos, eventos e informes: `/tmp/claude-1000/-home-phobos-Projects-riftlegends/b906b42a-82c2-495f-9773-221333b9b365/scratchpad/f0{a,b}_prompt.md`, `f0{a,b}_events.jsonl` y `f0{a,b}_report.json`; notas para los PR en `f0{a,b}_pr_notes.md`.
- Retorno: commits locales sin push. Claude revisa, ejecuta `pnpm verify` y `pnpm e2e`, publica un PR por issue (`Closes #NN`) y fusiona en orden (#15, #16 y después #17 y #18, rebasando cada rama sobre `main`). Tras fusionar #16, añadir `verify` como check obligatorio en el ruleset `protect-main`.
- Si se corta: `git -C <worktree> status --short` y `git -C <worktree> log --oneline -5`; retomar con `codex exec resume <thread_id del primer evento>` desde el worktree.

## Cierre

- Sesión A (`01a1f5a6-b53f-7442-b91f-b8335478b41d`, verificada como `gpt-6.2-astra` high): PR #32 (#15) y PR #33 (#16). El primer CI falló porque los E2E no arrancaban en Ubuntu (Codex enlazaba el `chrome-sandbox` de Google Chrome). Claude lo corrigió dando setuid al `chrome-sandbox` de Electron. `verify` y `verify-windows` pasan en `main`, E2E incluidos.
- Sesión B (`01a1f5a6-bcea-7d71-92b3-3252aca562d5`, verificada como `gpt-6.2-sol` medium): PR #34 (#17) y PR #35 (#18). Claude añadió los comandos `dev` y `e2e` a la documentación.
- `verify` es ahora un check obligatorio en el ruleset `protect-main`.
- Pendiente de observar: el primer PR de Dependabot (lockfile de pnpm 12 y auto-merge).
