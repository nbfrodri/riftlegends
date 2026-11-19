# Rift Legends

Juego de gestión de esports de League of Legends para escritorio (**Windows y Linux**). Diriges un equipo profesional: preparas los drafts, gestionas la plantilla y compites temporada tras temporada. Es un fan project gratuito y no oficial ([aviso legal](NOTICE.md)).

> **Estado:** preproducción. El stack está decidido y la Fase 0 (cimientos) todavía no ha empezado, así que aún no hay código ejecutable.

## Stack

Electron · TypeScript · React 19 · SQLite · Motion · PixiJS. El motivo de cada elección está en el [ADR 0001](docs/decisions/0001-stack-tecnologico.md).

## Documentación

| Documento | Para qué |
| --- | --- |
| [IDEA.md](IDEA.md) | Visión del juego, pilares, bucles y sistemas |
| [docs/](docs/README.md) | Índice de decisiones, planes e investigación |
| [Plan general](docs/plans/00-plan-general.md) | Fases, hitos e índice de planes específicos |
| [AGENTS.md](AGENTS.md) | Reglas y flujo de trabajo (agentes y personas) |

## Cómo se trabaja

Cada plan específico se trocea en issues, que van al [tablero](https://github.com/users/nbfrodri/projects/1). Cada issue se resuelve en su rama con **TDD** y se cierra con un PR (`Closes #NN`) que se fusiona en `main` con squash. El detalle está en [AGENTS.md](AGENTS.md).

## Inicio rápido

Pendiente de la Fase 0. Los comandos (`pnpm install`, `pnpm dev`, `pnpm verify`) se documentarán aquí cuando existan.

## Licencia

El código se distribuye bajo [MIT](LICENSE-MIT) o [Apache-2.0](LICENSE-APACHE), a elección de quien lo use. Los nombres, imágenes y demás propiedad intelectual de League of Legends pertenecen a Riot Games y no están cubiertos por estas licencias (ver [NOTICE.md](NOTICE.md)).
