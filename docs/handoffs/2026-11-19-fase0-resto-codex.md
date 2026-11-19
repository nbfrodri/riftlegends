# Handoff: Fase 0, issues #15–#18 (delegado a Codex en dos sesiones)

- Estado: en curso
- Fecha: 2026-11-19

| Sesión | Issues | Ramas (apiladas) | Worktree | Modelo y effort (elegidos por el usuario) |
| --- | --- | --- | --- | --- |
| A | #15 app Electron segura, #16 CI | `feat/15-electron-shell` → `ci/16-github-actions` | `/home/phobos/Projects/riftlegends-f0a` | `gpt-6.2-astra`, high |
| B | #17 Dependabot, #18 documentación de desarrollo | `chore/17-dependabot` → `docs/18-dev-guide` | `/home/phobos/Projects/riftlegends-f0b` | `gpt-6.2-sol`, medium |

- Encargos, eventos e informes: `/tmp/claude-1000/-home-phobos-Projects-riftlegends/b906b42a-82c2-495f-9773-221333b9b365/scratchpad/f0{a,b}_prompt.md`, `f0{a,b}_events.jsonl` y `f0{a,b}_report.json`; notas para los PR en `f0{a,b}_pr_notes.md`.
- Retorno: commits locales sin push. Claude revisa, ejecuta `pnpm verify` y `pnpm e2e`, publica un PR por issue (`Closes #NN`) y fusiona en orden (#15, #16 y después #17 y #18, rebasando cada rama sobre `main`). Tras fusionar #16, añadir `verify` como check obligatorio en el ruleset `protect-main`.
- Si se corta: `git -C <worktree> status --short` y `git -C <worktree> log --oneline -5`; retomar con `codex exec resume <thread_id del primer evento>` desde el worktree.
