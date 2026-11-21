# Plan 07 — IA de draft explicable y personalidades

- **Estado:** propuesto (21-11-2026). Redactado por Claude con las decisiones del usuario (al final) y el [estudio de la IA de DraftSim](../research/draftsim-ia-draft.md).
- **Fase:** 2 · Draft rápido completo ([plan general](00-plan-general.md)).
- **Objetivo:** que cada equipo de la IA haga picks y bans creíbles, distintos según su personalidad y su coach, y que cada decisión se pueda explicar con puntos. Es determinista: la misma semilla da el mismo draft.

## Contexto

- **Plan 06:** reglas, disponibilidad y series. La IA solo elige entre lo que `availability` deja libre.
- **Plan 05:** puntuación en enteros o punto fijo (escala 10.000) y RNG por ámbito. Sin `Math` ni `exp`: la elección al azar usa una tabla de pesos enteros.
- **Plan 10:** trae el dataset ficticio. Este plan fija **qué datos lee la IA** (`AiContent`); los tests usan un fixture pequeño.
- **Scouting (plan 19):** hasta entonces, la IA ve los pools rivales según su dificultad. Después solo verá lo que su equipo sepa.

## Lista de tests

### Componentes de un pick

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| A1 | **Meta:** a igual resto, un tier más alto puntúa más en su posición | Campeón sin la posición: no puntúa meta |
| A2 | **Comfort:** main > secundario > desconocido > pick débil del jugador de esa posición | Dos plantillas valoran distinto el mismo campeón |
| A3 | **Sinergia:** un combo con un pick propio suma; romper un combo rival suma en bans | Combo con un campeón ya baneado: no suma |
| A4 | **Composición:** cubrir un hueco (tanque, engage, carry, peel) y equilibrar AD/AP suma | Tercer campeón AP: resta |
| A5 | **Matchup:** un counter a un pick rival de la misma posición suma | Counter a otra posición: no suma (fallo de DraftSim) |
| A6 | **Flex:** mantener posiciones abiertas suma solo si la plantilla las cubre | Flex que deja un rol imposible: no suma |
| A7 | **Identidad:** desde dos picks, reforzar el plan del equipo suma | |

### Bans y serie

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| B1 | **Objetivo:** banear el comfort de un rival fuerte suma según su nivel | En fácil no conoce los pools rivales |
| B2 | **Amenaza:** banear lo que castiga la composición propia suma, más en la fase 2 | |
| B3 | **Reserva fearless:** guardar un campeón S para otro game resta al usarlo pronto | Desaparece si el game puede cerrar o eliminar la serie |
| B4 | **Lado:** azul valora flex en la primera fase; rojo valora el counter en el último pick | |

### Elección y dificultad

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| C1 | Siempre elige un campeón legal | Propiedad: miles de drafts IA contra IA sin rechazos |
| C2 | Elige entre los N mejores con pesos enteros por temperatura | En difícil, casi siempre el primero; en fácil, más variedad |
| C3 | La misma semilla da la misma decisión | Golden de una Bo5 IA contra IA |
| C4 | La dificultad sale del coach: rating < 2,5 fácil, < 4 normal, resto difícil | Sin coach: la dificultad de la partida |
| C5 | **Mirar adelante (normal y difícil):** penaliza un pick si la réplica rival probable lo castiga, con el orden real | Turno doble del rival (fallo de DraftSim) |
| C6 | **Lectura del rival:** en normal y difícil usa los pools rivales para banear y anticipar | |

### Personalidades

| # | Comportamiento |
| --- | --- |
| D1 | Cada personalidad cambia la elección en el escenario que la define (p. ej. comfort elige el main frente a un pick meta) |
| D2 | `balanced` aplica todos los pesos ×1 |

### Explicación

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| E1 | Cada decisión emite `ai.decided` con los puntos por componente, que suman el total | Componentes a 0 no aparecen |
| E2 | Trae 3 alternativas con su total y su probabilidad de salir | Con un solo candidato, sin alternativas |
| E3 | La réplica prevista aparece por separado, no mezclada con el azar (fallo de DraftSim) | |

## Diseño

### Cómo decide

1. **Candidatos:** los campeones libres para el equipo (plan 06).
2. **Componentes:** cada uno da puntos enteros (punto fijo) y una etiqueta para explicarlo.
3. **Personalidad:** multiplica cada componente por su peso.
4. **Mirar adelante** (normal y difícil): ajusta los 5 mejores con la réplica rival probable.
5. **Elección:** pesos enteros entre los N mejores, sacados de una tabla fija según la distancia al primero y la temperatura. Sorteo con el ámbito de RNG `ai`.
6. **Hecho:** `ai.decided` antes del `draft.banned` o `draft.picked`.

### Dificultad

| Dificultad | N picks / bans | Temperatura | Mira adelante | Lee pools rivales | Comodín |
| --- | --- | --- | --- | --- | --- |
| Fácil | 5 / 5 | alta | no | no | sí |
| Normal | 3 / 3 | media | 1 réplica | sí | sí |
| Difícil | 2 / 2 | baja | 1 réplica y la respuesta propia | sí | no |

El **comodín** amplía el grupo a 7 con poca probabilidad: da sorpresas sin romper la lógica.

### Personalidades

| Personalidad | Idea | Pesos |
| --- | --- | --- |
| Equilibrada | Sin sesgo | Todo ×1 |
| Meta | Lo más fuerte del parche | ↑ meta, ↓ comfort; menos azar |
| Comfort | Lo que dominan sus jugadores | ↑↑ comfort, ↑ ban objetivo |
| Counterpick | Responder al rival; guarda picks para el final | ↑ matchup, ↑ mirar adelante, ↑ bans |
| Pocket picks | Sorprender con lo que domina un jugador y poco visto | ↑ comfort fuera de meta; más azar y comodín |
| Arquitecto | Composición y combos | ↑ sinergia, ↑ identidad |
| Presión temprana | Prioridad de líneas y primeros objetivos | ↑ fase temprana, ↑ prioridad |
| Escalado | Aguantar hasta los picos del carry | ↑ fase tardía, ↑ peel, ↑ ban de amenaza contra dive |
| Flex | Esconder las posiciones hasta el final | ↑ flex respaldado por la plantilla |
| Ban a la estrella | Quitar sus picks al mejor jugador rival | ↑ ban objetivo por nivel del jugador |
| Agotador de pools | En fearless, dejar al rival sin alternativas | ↑ negación de comfort por escasez, ↑ anticipación |
| Laterales | 1-3-1 y presión en una línea | ↑ identidad de splitpush, ↑ ban de amenaza contra engage |

La personalidad del **coach** manda sobre la del equipo, como en DraftSim. Los pesos exactos se calibran con tests D1 y se guardan como datos.

### Comandos, hechos y contenido

| Pieza | Forma |
| --- | --- |
| `series.start` | Añade por equipo `ai?: { personality, coachRating? }`; sin `ai`, el equipo lo juega una persona |
| `draft.ai` `{}` | La IA del equipo al que le toca hace su acción (ban, pick, roles o lado) |
| `ai.decided` | `{ game, step, team, action, champion, total, components: [{ key, points }], alternatives: [{ champion, total, chance }], reply? }` |
| `AiContent` | Campeones (posiciones y tier por posición, daño, arquetipos, fase de poder), matchups y sinergias con intensidad, identidades, y jugadores (posición, nivel, mains, secundarios y picks débiles) |
| Ámbito RNG | `ai` = 3, con ids (game, paso) |

Cada decisión cambia los goldens de draft: el primer PR que la usa sube `SIM_VERSION`.

### Dónde vive cada cosa

| Pieza | Ubicación |
| --- | --- |
| Componentes | `packages/core/ai/components/` (un fichero por grupo) |
| Personalidades y dificultad | `packages/core/ai/profiles.ts` (datos) |
| Elección y explicación | `packages/core/ai/choose.ts` |
| Fixture de contenido | `packages/core/ai/fixtures/` |

## Troceado en issues (Tarea de plan · milestone «Fase 2 — Draft rápido completo»)

| Orden | Issue | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | Contratos: IA en `series.start`, `draft.ai`, `ai.decided` y `AiContent` | `type:task`, `area:core` | Tests de esquema |
| 2 | Fixture de contenido para la IA (unos 40 campeones y 2 plantillas) | `type:task`, `area:draft` | Valida contra `AiContent` |
| 3 | Componentes de pick | `type:task`, `area:draft` | A1–A7 |
| 4 | Componentes de ban y de serie | `type:task`, `area:draft` | B1–B4 |
| 5 | Elección, dificultad, coach y explicación | `type:task`, `area:draft` | C1–C4, C6, E1, E2 |
| 6 | Mirar adelante con el orden real | `type:task`, `area:draft` | C5, E3 |
| 7 | Personalidades | `type:task`, `area:draft` | D1, D2 |
| 8 | `draft.ai` en el dispatcher y golden IA contra IA | `type:test`, `area:draft` | C1, C3 |

2 depende de 1; 3 y 4 pueden ir en paralelo tras 2; 5 tras 3 y 4; 6 y 7 tras 5; 8 cierra el plan.

## Riesgos

- **Calibración:** que las personalidades se noten sin resultar absurdas. Los tests D1 fijan un escenario por personalidad; los pesos son datos y se pueden retocar sin tocar código.
- **Coste:** mirar adelante multiplica las evaluaciones. Se limita a los 5 mejores candidatos y a una réplica.
- **Contenido:** la IA vale lo que valgan sus datos. El plan 10 debe cubrir la lista de `AiContent`.

## Decisiones del usuario (21-11-2026)

1. La dificultad combina los cuatro mecanismos: margen de error, lectura del rival, mirar adelante y fuerza del coach.
2. Personalidades: meta, comfort, counterpick y pocket picks, y otras más (propuestas arriba, pendientes de aprobar).
3. Explicación: los 3 motivos principales al pasar el ratón; el desglose completo en el resumen del draft.
