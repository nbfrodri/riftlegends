# Rift Legends: guía para agentes

Juego de gestión de esports de LoL para Windows y Linux. Antes de trabajar, lee [IDEA.md](IDEA.md), el [ADR 0001](docs/decisions/0001-stack-tecnologico.md) y el [plan general](docs/plans/00-plan-general.md).

## App de escritorio

Es una **app de escritorio instalable** (Electron) que funciona sin conexión, no una web: sin servidor, sin rutas por URL y con las fuentes empaquetadas. Las reglas completas están en [docs/libraries.md](docs/libraries.md#app-de-escritorio-no-web).

## Librerías

- Usa **solo** las librerías de [docs/libraries.md](docs/libraries.md). Si añades una nueva, actualiza el catálogo en el mismo PR y explica el motivo.
- Antes de usar la API de una librería, consulta su documentación actual con **Context7** (`resolve-library-id` y después `query-docs`).

## Idioma

- Código, identificadores, nombres de ramas y mensajes de commit: **inglés**.
- Documentación, ADR, planes, issues y PR: **español** (el repo es privado).
- Textos de la UI: siempre en los catálogos i18n (ES y EN).

## Flujo de trabajo: plan → issues → tablero → PR

1. **Plan específico.** Cada sistema o función tiene su plan en `docs/plans/NN-nombre.md` (índice en el plan general). Empieza por la **lista de tests** (comportamientos y casos límite) y después el diseño.
2. **Troceado en issues.** Al aprobar un plan, se trocea en issues con la plantilla **"Tarea de plan"**: un issue por entregable pequeño y verificable, con su label `area:*`, el milestone de su fase y el test que lo cierra. Todos van al tablero:
   ```sh
   gh issue create --title "draft: validate fearless pick legality" \
     --label "type:task,area:draft" --milestone "Fase 2 — Draft rápido completo" \
     --project "Rift Legends" --body-file - <<'MD'
   ### Plan
   docs/plans/06-reglas-de-draft.md

   ### Objetivo
   ...

   ### Test que la cierra
   ...

   ### Notas y dependencias
   ...
   MD
   ```
   Siempre con `--title` y `--body-file` (o `--body`), porque `--template` solo funciona en modo interactivo y el comando se queda esperando. El cuerpo repite las secciones de la plantilla web "Tarea de plan". Con `--project` el issue entra en el tablero y el workflow del tablero le pone el estado *Todo*.
3. **Coger un issue.** El agente (Claude o Codex) se lo asigna, lo mueve a *In Progress* y crea su rama desde `main` (`feat/<nn>-slug`, `fix/<nn>-slug`, `docs/...`, `chore/...`):
   ```sh
   gh issue edit NN --add-assignee @me
   ITEM=$(gh project item-list 1 --owner nbfrodri --format json --jq '.items[]|select(.content.number==NN)|.id')
   gh project item-edit --project-id PVT_kwHOApPh984BsY9x --id "$ITEM" \
     --field-id PVTSSF_lAHOApPh984BsY9xzhqnVrM --single-select-option-id 47fc9ee4
   ```
4. **Trabajar con TDD** (ver más abajo) y hacer commits Conventional en la rama.
5. **PR.** Se abre contra `main` con la plantilla de PR y `Closes #NN` en la descripción. Al fusionar con squash, el issue se cierra y la tarjeta pasa sola a *Done*. Los PR de un mismo plan se pueden encadenar, pero cada uno cierra su issue.

### Ramas y versiones

- **Trunk-based:** solo existe `main`, más ramas cortas por issue. No hay ramas `develop` ni de entorno, porque es una app de escritorio sin servidores.
- **Preproducción:** pre-releases `vX.Y.Z-beta.N`, publicadas como *pre-release* en el repo público de releases (canal beta).
- **Producción:** releases `vX.Y.Z`. Los tags son anotados, siguen el formato que exige el hook de tack y no se mueven una vez publicados.
- Una rama `release/X.Y` solo se crea si hay que parchear una versión antigua.

Nada entra en `main` sin PR: el ruleset `protect-main` exige PR, solo admite squash, obliga a un historial lineal y prohíbe el force-push.

## TDD obligatorio

- Ciclo red → green → refactor: no se escribe código de producción sin ver antes fallar un test por la razón esperada.
- Núcleo, contratos, contenido y persistencia: tests unitarios y de propiedades (fast-check), golden tests por semilla y SQLite real en los tests de integración.
- UI: tests de comportamiento de componentes antes de implementar, y un E2E con Playwright `_electron` para cada flujo de hito.
- Bugs: primero un test de regresión que reproduzca el fallo.
- Excepción: los spikes desechables de la Fase 1.

## Reglas del núcleo (`packages/core`)

- Sin DOM, Electron, `fs`, reloj ni `Math.random`. Solo el PRNG con nombre y semillas derivadas por hash.
- Enteros o punto fijo en las rutas que deciden resultados.
- Las decisiones de la IA y los resultados simulados devuelven un desglose explicable.
- Módulos pequeños (alrededor de 300 líneas como máximo, salvo motivo).

## Verificación

`pnpm verify` (lint + typecheck + tests) debe estar en verde antes de abrir un PR. Este comando se crea en la Fase 0; hasta entonces, el trabajo es solo de documentación.

## Legal

No se commitean assets de Riot (imágenes, sonidos, logos): se descargan en tiempo de ejecución. Los datos de la comunidad se usan con su atribución.
