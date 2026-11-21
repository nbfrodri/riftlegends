# Plan 06 — Reglas de draft y series (fearless)

- **Estado:** hecho (21-11-2026; PR #141–#145 y #146). Redactado por Claude con las cuatro decisiones del usuario (al final).
- **Fase:** 2 · Draft rápido completo ([plan general](../../plans/00-plan-general.md)).
- **Objetivo:** el núcleo aplica las reglas de un draft profesional y de una serie Bo1, Bo3 o Bo5 con fearless. Solo reglas: quién actúa, qué campeones quedan libres y cuándo termina cada game y la serie. La IA (plan 07), la simulación (plan 08) y la pantalla (plan 09) se apoyan en esto.

## Contexto

- **Plan 04:** comandos, hechos y consultas sobre el despachador. Este plan añade el catálogo `draft`.
- **Plan 05:** el sorteo de lado y el pick por tiempo agotado usan un ámbito propio del RNG.
- **Contenido:** los campeones son ids opacos. La serie recibe el pool al empezar; el dataset llega con el plan 10.
- **Resultado de cada game:** hasta que exista el plan 08, lo envía un comando `game.finish`. Después lo emitirá la simulación.

## Lista de tests

### Orden del draft

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| O1 | Las 20 acciones siguen el orden profesional (abajo) | Toda la secuencia, acción por acción |
| O2 | Una acción del equipo al que no le toca se rechaza con `not-your-turn` | Pick en fase de bans y ban en fase de picks → `wrong-action` |
| O3 | Un ban puede ser vacío | Un pick vacío se rechaza |
| O4 | Tras el último pick, cada equipo asigna sus 5 campeones a los 5 roles | Rol repetido, campeón ajeno o faltante → `invalid-roles` |

### Disponibilidad y fearless

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| F1 | En un game no se puede elegir ni banear un campeón ya baneado o elegido | El mismo campeón en ambos equipos |
| F2 | **Hard:** un campeón elegido en un game anterior no lo puede elegir nadie | También en el último game posible (no se libera) |
| F3 | **Soft:** solo lo bloquea para el equipo que lo eligió | El rival sí puede elegirlo |
| F4 | **Sin fearless:** cada game empieza con todo el pool | |
| F5 | Los bans no bloquean en fearless | Un campeón baneado en el game 1 se puede elegir en el 2 |
| F6 | Un campeón bloqueado por fearless se puede banear | Ban de un campeón ya bloqueado (permitido, aunque no sirva) |
| F7 | La consulta de disponibilidad da cada campeón con su motivo | `free`, `banned`, `picked`, `fearless` y de qué equipo |
| F8 | La serie no empieza si el pool no alcanza para el peor caso | Bo5 hard necesita 5 × 10 picks + 10 bans → `pool-too-small` |

### Series y lados

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| S1 | Bo1, Bo3 y Bo5 terminan al llegar a 1, 2 y 3 victorias | 3-0 en Bo5: no hay games 4 y 5 |
| S2 | Game 1: el mejor sembrado elige lado; sin siembra, sorteo con el RNG | Mismo resultado con la misma semilla |
| S3 | Desde el game 2 elige lado el que perdió el anterior | No empieza el draft hasta elegir lado |
| S4 | Tras el final de la serie se rechaza cualquier comando con `series-over` | |

### Tiempo agotado (opcional, apagado por defecto)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| T1 | `draft.timeout` en un ban registra un ban vacío | |
| T2 | `draft.timeout` en un pick elige un campeón libre con el RNG | Mismo campeón con la misma semilla; nunca uno bloqueado |
| T3 | Con el temporizador apagado, `draft.timeout` se rechaza | |

### Globales

| # | Comportamiento |
| --- | --- |
| P1 | Propiedad: cualquier secuencia de comandos legales termina en una serie válida (10 picks distintos por game, fearless respetado en toda la serie) |
| P2 | Propiedad: un comando rechazado no cambia nada (N2 del plan 04) |
| P3 | Golden: una Bo5 hard fearless con semilla fija produce siempre el mismo log de hechos |

## Diseño

### Orden profesional

| Fase | Acciones |
| --- | --- |
| Bans 1 | Azul, Rojo, Azul, Rojo, Azul, Rojo |
| Picks 1 | Azul · Rojo, Rojo · Azul, Azul · Rojo |
| Bans 2 | Rojo, Azul, Rojo, Azul |
| Picks 2 | Rojo · Azul, Azul · Rojo |
| Roles | Cada equipo asigna sus picks a top, jungle, mid, bot y support |

El orden es una tabla de datos en `packages/core/draft/order.ts`, no lógica repartida.

### Comandos, hechos y consulta

| Comando | Hecho que emite |
| --- | --- |
| `series.start` `{ teams, seeds?, format, fearless, timer, pool }` | `series.started`, y `side.chosen` si hay sorteo |
| `side.choose` `{ team, side }` | `side.chosen`, `game.started` |
| `draft.ban` `{ team, champion \| null }` | `draft.banned` |
| `draft.pick` `{ team, champion }` | `draft.picked` |
| `draft.timeout` `{}` | `draft.banned` o `draft.picked` con `timeout: true` |
| `draft.roles` `{ team, roles }` | `draft.rolesAssigned` |
| `game.finish` `{ winner }` (provisional, hasta el plan 08) | `game.finished`, y `series.finished` si acaba |

- **Consulta `draft.view`:** game y marcador, fase, a quién le toca, bans y picks por lado, y la disponibilidad de cada campeón (F7).
- **Errores nuevos** (con sus claves `errors.*` en ES y EN): `not-your-turn`, `wrong-action`, `champion-unavailable`, `invalid-roles`, `pool-too-small`, `series-over` y `timer-off`.
- **El núcleo no tiene reloj:** el temporizador vive en la UI, que envía `draft.timeout` al agotarse.
- **Ámbito de RNG nuevo:** `draft` (sorteo de lado y pick por tiempo agotado), registrado con un número fijo (G7).

### Dónde vive cada cosa

| Pieza | Ubicación |
| --- | --- |
| Esquemas de comandos, hechos y vista | `packages/contracts/draft/` |
| Reglas puras | `packages/core/draft/` (`order.ts`, `availability.ts`, `series.ts`) |
| Handlers del despachador | `packages/core/draft/handlers.ts` |
| Goldens | `packages/core/goldens/draft/` |

## Troceado en issues (Tarea de plan · milestone «Fase 2 — Draft rápido completo»)

| Orden | Issue | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | Contratos del catálogo `draft` y errores nuevos (ES/EN) | `type:task`, `area:core` | Tests de esquema de cada comando y hecho |
| 2 | Orden del draft y asignación de roles | `type:task`, `area:draft` | O1–O4 |
| 3 | Disponibilidad y fearless (hard, soft, sin) | `type:task`, `area:draft` | F1–F8 |
| 4 | Serie: formatos, lados y final | `type:task`, `area:draft` | S1–S4 |
| 5 | Tiempo agotado con RNG | `type:task`, `area:draft` | T1–T3 |
| 6 | Propiedades y golden de una Bo5 | `type:test`, `area:draft` | P1–P3 |

2 y 3 pueden ir en paralelo tras 1; 4 depende de 2 y 3; 5 depende de 2; 6 cierra el plan.

## Riesgos

- **Reglas pro cambiantes:** Riot ajusta fearless y lados entre temporadas. Las variantes son configuración de la serie; añadir otra no rompe las existentes.
- **Pool ficticio pequeño:** el dataset del plan 10 debe tener campeones de sobra para una Bo5 hard (F8 lo protege).

## Decisiones del usuario (21-11-2026)

1. Fearless **hard por defecto y configurable** por serie: hard, soft o sin fearless.
2. En el último game posible **no se liberan** los campeones.
3. Lados **como en pro**: game 1 el mejor sembrado (o sorteo); después elige el perdedor.
4. Temporizador **opcional, apagado por defecto**, de 30 s por acción.
