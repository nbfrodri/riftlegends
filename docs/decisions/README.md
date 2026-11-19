# Registro de decisiones

Resumen de las decisiones **vigentes**, para empezar cualquier sesión sin volver a preguntar. Cada fila enlaza a su fuente de verdad. Se actualiza en el mismo PR que toma o cambia una decisión; las sustituidas se tachan y se indica su reemplazo.

## Producto y alcance

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | Juego de gestión de esports de LoL para **escritorio** (Windows y Linux), no web. DraftSim solo aporta ideas, no código | [IDEA.md](../../IDEA.md), [inventario de DraftSim](../research/draftsim-inventario.md) |
| 2026-11-19 | **Contenido real de LoL** asumiendo el riesgo; el nombre "Rift Legends" se mantiene; sin assets de Riot en el repo ni en los binarios (descarga en tiempo de ejecución) | [ADR 0001](0001-stack-tecnologico.md), [NOTICE.md](../../NOTICE.md) |
| 2026-11-19 | Primer hito: **draft rápido completo** contra la IA. Primero las ligas top y después las menores. Jugadores reales con regens. Sin despido ni draft local para dos jugadores por ahora. Timeline de partida y después minimapa | [IDEA.md §12](../../IDEA.md), [plan general](../plans/00-plan-general.md) |
| 2026-11-19 | **Carreras ilimitadas**, autoguardado, ironman opcional, backups y export/import. Historial completo (palmarés, partidos, Hall of Fame, perfiles) | Planes 27 y 28 del [plan general](../plans/00-plan-general.md) |
| 2026-11-19 | Interfaz con **i18n ES/EN** desde el inicio. PC gaming medio como objetivo. Pruebas en Arch Wayland y Windows | [ADR 0001](0001-stack-tecnologico.md) |

## Técnica

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | **Electron + núcleo TypeScript + React**; plan B Godot + C# si el draft broadcast sale caro | [ADR 0001](0001-stack-tecnologico.md) |
| 2026-11-19 | Núcleo puro y determinista en un `utilityProcess`; SQLite por carrera con hechos append-only; sin event sourcing integral | [ADR 0001](0001-stack-tecnologico.md) |
| 2026-11-19 | **TDD obligatorio** (los spikes desechables quedan exentos) | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | Catálogo obligatorio de librerías: shadcn/ui sobre Base UI con Tailwind v4, TanStack, Motion + PixiJS (sin GSAP), Lucide + game-icons e i18next. Context7 para consultar su documentación | [libraries.md](../libraries.md) |
| 2026-11-19 | Actualización desde la app con `electron-updater` (botón, canal estable o beta) | [ADR 0001](0001-stack-tecnologico.md) |

## Estilo visual

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | Ventana **sin marco** con barra de título propia; **solo tema oscuro**; i18n ES/EN con selector en Ajustes; tests visuales con capturas en el CI de Linux | [plan 02](../plans/02-ui-kit-shell.md) |
| 2026-11-19 | El botón **minimizar se oculta** en compositores Wayland en mosaico que no lo soportan (Hyprland, sway, river y niri); en el resto se muestra | PR #54 |
| 2026-11-19 | Estilo **Caja** (Frecuencia con Unbounded + Archivo), **barra lateral izquierda** fija y plegable, e icono **Corte · Puntera** | [ADR 0002](0002-estilo-visual.md), [design/](../../design/README.md) |

## Repositorio y proceso

| Fecha | Decisión | Fuente |
| --- | --- | --- |
| 2026-11-19 | Repo principal **privado** (código en inglés, documentación en español) y **repo público solo para releases** | [ADR 0001](0001-stack-tecnologico.md) |
| 2026-11-19 | Licencia dual MIT o Apache-2.0; publicar sin firma de código (SignPath si el repo se hace público) | [README](../../README.md) |
| 2026-11-19 | **Trunk-based**: solo `main` y ramas cortas por issue; beta = `vX.Y.Z-beta.N`; estable = `vX.Y.Z` | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | Flujo **plan → issues "Tarea de plan" → tablero → rama → PR con `Closes #NN`**; solo squash; `main` protegida (PR obligatorio sin aprobaciones, historial lineal y sin force-push) | [AGENTS.md](../../AGENTS.md) |
| 2026-11-19 | CI de GitHub Actions: `verify` (Ubuntu, en cada PR, **obligatorio** en `protect-main`) y `verify-windows` (en `main` y en tags). Dependabot semanal con auto-merge de patch y minor | [ci.yml](../../.github/workflows/ci.yml), [plan 01](../archive/plans/01-cimientos.md) |
| 2026-11-19 | El diseño visual y el trabajo mecánico se delegan en **Codex**; el usuario elige modelo y effort entre las opciones que se le presentan | [AGENTS.md](../../AGENTS.md) |
