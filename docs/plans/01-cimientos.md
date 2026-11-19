# Plan 01 — Cimientos del monorepo, tooling y CI

- **Estado:** aprobado (19-11-2026)
- **Fase:** 0 · Cimientos ([plan general](00-plan-general.md))
- **Objetivo:** un monorepo donde `pnpm verify` compruebe lint, tipos y tests, una app Electron vacía y segura que arranque en Windows y en Arch Wayland, y un CI que bloquee los PR rotos. Sin lógica de juego.

## Fuera de alcance

Empaquetado e instaladores (spike S7, Fase 1), `utilityProcess` del núcleo y contratos IPC (plan 04), PRNG (plan 05), `ui-kit`, tokens de Caja y barra lateral (plan 02), i18n (plan 26). En este plan solo se crean los paquetes que se usan; el resto llega con su propio plan (YAGNI).

## Tests primero (criterios de aceptación)

Cada comportamiento empieza como un test que falla.

| # | Comportamiento | Test | Tipo |
| --- | --- | --- | --- |
| T1 | La app arranca y muestra una ventana titulada «Rift Legends» | `apps/desktop/e2e/launch.spec.ts`: Playwright `_electron.launch`, espera la primera ventana y comprueba el título | E2E |
| T2 | El renderer no tiene acceso a Node | E2E: `typeof require`, `typeof process` y `typeof module` son `undefined` en la ventana | E2E |
| T3 | La ventana usa `contextIsolation: true`, `sandbox: true` y `nodeIntegration: false` | Unit: `createMainWindowOptions()` devuelve esa configuración | Unit |
| T4 | El preload expone una API mínima y tipada: `window.riftlegends.ping()` responde `"pong"` desde el proceso main | E2E: ida y vuelta por IPC | E2E |
| T5 | El renderer no puede navegar fuera de la app ni abrir ventanas nuevas | Unit sobre los handlers `will-navigate` y `setWindowOpenHandler`, que bloquean cualquier URL externa | Unit |
| T6 | `packages/core` rechaza `Math.random`, `Date`, `node:*`, `electron` y el DOM | `packages/core/test/boundaries.test.ts`: ejecuta Biome sobre `fixtures/forbidden.ts` y espera un error por cada regla | Unit |
| T7 | `pnpm verify` falla si falla lint, tipos o tests | Prueba manual una vez (romper cada uno) y anotar el resultado en el PR; después lo vigila CI | Manual + CI |
| T8 | CI ejecuta `verify` y los E2E en Linux en cada PR, y además en Windows en `main` | El PR de este plan pasa el workflow; la matriz de Windows corre al fusionar | CI |

Verificación manual adicional: `pnpm dev` abre la app en Arch Wayland (Hyprland) nativo, sin XWayland, y en Windows. Se anota en el PR.

## Diseño

### Estructura inicial

```
package.json            # scripts: dev, verify, lint, typecheck, test, e2e; "packageManager": "pnpm@12.21.0"
pnpm-workspace.yaml     # apps/*, packages/*
mise.toml               # node 26.13 (LTS), pnpm 12.21
tsconfig.base.json      # strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes, verbatimModuleSyntax
biome.json              # lint + formato (tabs; reglas restringidas solo en packages/core)
vitest.config.ts        # projects: apps/desktop, packages/core
lefthook.yml            # pre-commit: biome check sobre los ficheros staged
apps/desktop/           # electron-vite: src/main, src/preload, src/renderer (React 19), e2e/
packages/core/          # dominio puro: de momento solo index.ts, el fixture y el test de fronteras
.github/workflows/ci.yml
.github/dependabot.yml
.github/workflows/dependabot-auto-merge.yml
```

### Decisiones

- **Node 26 LTS** para el tooling, fijado con mise y con `packageManager`. Electron 45 trae su propio Node 24, y el código del núcleo no depende de la versión de Node.
- **Biome** como único linter y formateador. En `packages/core`, las reglas `noRestrictedGlobals` (`Math`, `Date`, `window`, `document`) y `noRestrictedImports` (`node:*`, `electron`, `react`) dan error. Si Biome no puede expresar alguna, se cubre con el test T6 de otra forma y se anota.
- **Vitest con `projects`**: un solo `pnpm test` para todo el monorepo. Playwright solo para los E2E de `apps/desktop`.
- **`pnpm verify`** = `biome ci` + `tsc -b` + `vitest run`. Los E2E se ejecutan aparte (`pnpm e2e`) porque necesitan la app compilada, y en CI ambos son obligatorios.
- **Seguridad de Electron desde el primer día:** las opciones de T3, una CSP estricta en el `index.html` del renderer, navegación bloqueada (T5) y un preload que solo expone `ping`. El canal del núcleo llega en el plan 04.
- **Wayland:** Electron 45 usa Wayland nativo cuando lo detecta. Si en Hyprland no lo hace, se añade `--ozone-platform-hint=auto` y se documenta.
- **CI (`ci.yml`):** el job `verify` (Ubuntu) corre en cada PR y en `main`: `pnpm install --frozen-lockfile`, `pnpm verify` y `pnpm e2e` bajo `xvfb-run`. El job `verify-windows` solo corre en `main` y en tags, para ahorrar minutos del repo privado. Caché de pnpm.
- **Ruleset:** después de fusionar el PR de CI, se añade el check `verify` como obligatorio en `protect-main`.
- **Dependabot:** npm y github-actions, semanal y agrupado (minor y patch juntos). El auto-merge solo actúa sobre PR de Dependabot de tipo patch o minor y espera al check `verify`.

## Troceado en issues (Tarea de plan · milestone «Fase 0 — Cimientos»)

| Orden | Issue | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | Base del monorepo: pnpm workspace, mise, tsconfig base y Biome | `type:chore`, `area:infra` | `pnpm lint` y `pnpm typecheck` en verde sobre el esqueleto |
| 2 | `packages/core`: esqueleto y reglas de frontera | `type:task`, `area:infra` | T6 |
| 3 | Vitest projects, `pnpm verify` y lefthook | `type:chore`, `area:infra` | T7 |
| 4 | `apps/desktop`: Electron segura con electron-vite y React | `type:task`, `area:ui` | T1–T5 y la prueba manual en Wayland y Windows |
| 5 | CI de GitHub Actions y check obligatorio | `type:chore`, `area:infra` | T8 |
| 6 | Dependabot y auto-merge | `type:chore`, `area:infra` | Primer PR de Dependabot fusionado solo con `verify` en verde |
| 7 | Documentación de desarrollo: glosario, inicio rápido y comandos en AGENTS.md | `type:docs` | Enlaces revisados; `pnpm install && pnpm verify` funciona en un clon limpio |

Dependencias: 1 → 2 y 3 → 4 → 5 → 6. El 7 puede ir en paralelo desde el 3.

## Riesgos

- **Playwright con Electron 45:** si `_electron` falla con esa versión, se fija la versión de Playwright compatible y se anota.
- **Rendimiento de `tsc -b`:** si crece, se valora `tsgo` (TypeScript 7 nativo) en un plan aparte.
- **Minutos de Actions en Windows:** se vigilan desde la pestaña de uso de GitHub tras las primeras semanas.
