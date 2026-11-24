# Plan 12 — Formatos de competición y Swiss propio

- **Estado:** propuesta (24-11-2026), pendiente de aprobación del usuario. Las [preguntas abiertas](#preguntas-abiertas) están al final.
- **Fase:** 4 · Competición ([plan general](00-plan-general.md#fase-4--competición)).

## 1. Objetivo y alcance

El núcleo genera y juega una **temporada competitiva completa** (seis ligas, First Stand, MSI y Worlds) a partir de **formatos descritos como datos**. Por defecto, los reales de 2026. Todas las series se juegan con el mismo motor que el draft rápido (IA de draft y simulación por minuto), de forma determinista.

| Entra en este plan (Fase 4) | Queda fuera |
| --- | --- |
| Esquema de formatos en `packages/contracts` y su validación | Pantalla de crear carrera y bucle diario (plan 14) |
| Round robin, grupos, Swiss propio, eliminatoria simple y doble | Persistencia en SQLite y proyecciones (plan 13): la temporada vive en memoria, como el draft rápido |
| Clasificación y desempates con su explicación | Segundas divisiones y academias (Fase 6) |
| Encadenado de fases, sembrado y plazas internacionales | Ascensos, descensos y serie de promoción (plan 24): el esquema los admite sin conceptos nuevos (ver [diseño](#ascensos-y-descensos)) |
| Calendario de la temporada (días enteros, sin reloj) | Sección «Competición» y modo Torneo en la UI (ver [pregunta 1](#preguntas-abiertas)) |
| Formatos reales de 2026 de las seis ligas y los tres internacionales | Mercado entre fases (plan 17) |
| Un año IA contra IA dentro de un presupuesto de tiempo | |

## 2. Lista de tests

Las letras agrupan por módulo. Cada fila es un test (o varios) que se escribe antes del código.

### Esquema y validación (`packages/contracts/competition`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| V1 | Los formatos reales de 2026 pasan la validación | Todos, ligas e internacionales |
| V2 | Un formato inválido se rechaza con `invalid-format` y la ruta del campo | Bo distinto de 1, 3 o 5; grupo vacío; Swiss con victorias o derrotas para pasar imposibles (más rondas que equipos − 1) |
| V3 | Una fase que pide más equipos de los que le llegan se rechaza (`not-enough-teams`) | Playoffs de 8 tras una liga de 6 |
| V4 | Referencias entre fases sin ciclos ni huecos (`invalid-stage-ref`) | Una fase que se alimenta de sí misma o de una fase posterior |
| V5 | Las plazas internacionales suman el tamaño del internacional (`slots-mismatch`) | El usuario quita una plaza a la LCK y no se la da a nadie |
| V6 | Un formato no se puede cambiar con la temporada empezada (`format-locked`) | El cambio sí se acepta para la temporada siguiente |
| V7 | Los errores nuevos tienen clave `errors.*` en ES y EN | |

### Round robin y grupos (`core/competition/round-robin.ts`, `groups.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| RR1 | Cada pareja se enfrenta exactamente N veces (N vueltas) | 1 y 2 vueltas; 2 a 14 equipos |
| RR2 | Nadie juega dos series el mismo día | |
| RR3 | Con un número impar, un equipo descansa en cada jornada y todos descansan lo mismo | 5 y 7 equipos |
| RR4 | La prioridad del game 1 (equipo «local») se reparte con una diferencia máxima de 1 por equipo | En doble vuelta, la segunda invierte la primera |
| G1 | El reparto en grupos sigue el sembrado en serpiente | 10 equipos en 2 grupos; 14 en grupos de 8 y 6 |
| G2 | En internacionales, dos equipos de la misma región no caen en el mismo grupo si hay alternativa | Una región con más equipos que grupos: se reparte lo menos posible |
| G3 | Cruce entre grupos (LCK Cup): cada equipo juega solo contra el otro grupo | |

### Clasificación y desempates (`core/competition/standings.ts`, `tiebreak.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| D1 | El orden sale de los criterios de la competición, en su orden | Series ganadas; después diferencia de games |
| D2 | Enfrentamiento directo entre empatados con una minitabla | Empate a tres: se aplica a los tres, no por parejas |
| D3 | Si un criterio separa solo a parte de los empatados, el resto vuelve a empezar desde el primer criterio | 4 empatados que quedan 1 + 3 |
| D4 | Si el empate decide una plaza de corte (clasificación o eliminación) y el reglamento lo pide, se programa una partida de desempate | Empate que no toca ningún corte: no se juega (ver [pregunta 2](#preguntas-abiertas)) |
| D5 | Último recurso: sorteo con el RNG de la competición | Misma semilla, mismo orden |
| D6 | Cada posición lleva su explicación: criterio decisivo y valores | «Empate a 6-3; gana G2 por enfrentamiento directo (2-0)» |
| D7 | Propiedad: la clasificación es un orden total y una permutación de los participantes | Con cualquier resultado |

### Swiss propio (`core/competition/swiss.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| S1 | Cada ronda empareja equipos con el mismo balance | Grupos de balance con número impar: baja uno al grupo vecino con el criterio del formato |
| S2 | Nunca hay revancha si existe un emparejamiento sin ella | |
| S3 | En la ronda 1, bombos (1 contra 4, 2 contra 3) y sin cruces de la misma región | |
| S4 | Bo1 en general y Bo3 en las series que clasifican o eliminan | Configurable por formato |
| S5 | Termina al llegar a las victorias o derrotas fijadas; con 16 equipos y 3-3 pasan exactamente 8 | 5 rondas como máximo |
| S6 | Si no hay emparejamiento válido, se relajan restricciones en un orden fijo (primero región, después revancha) y queda registrado en el hecho | Caso construido sin solución estricta |
| S7 | Propiedad: con cualquier secuencia de resultados siempre hay emparejamiento y la fase termina | 8 y 16 equipos |
| S8 | Mismo emparejamiento con la misma semilla; el sorteo usa su propio flujo de RNG | |

### Eliminatorias (`core/competition/bracket.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| B1 | Eliminatoria simple por sembrado (1-8, 4-5, 2-7, 3-6) | 8 equipos |
| B2 | Con un número que no es potencia de dos, los mejores sembrados pasan sin jugar (bye) | 6 y 10 equipos |
| B3 | Doble eliminación: el perdedor cae al cuadro inferior en el hueco que fija el formato | Cuadro de 4, 6 y 8 |
| B4 | La final no se repite si gana el que viene del cuadro inferior (sin reset, como en LoL) | Opción `reset` disponible para el modo Torneo |
| B5 | El Bo de cada ronda sale del formato | Bo3 en las primeras rondas y Bo5 después (LEC Versus) |
| B6 | Elección de rival por el mejor sembrado, si el formato la usa | Ver [pregunta 3](#preguntas-abiertas) |

### Encadenado, sembrado y plazas (`core/competition/season.ts`, `qualification.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| Q1 | Una fase toma sus equipos y su sembrado de la clasificación de otra | Grupos Legend/Rise de LCK según Rounds 1-2 |
| Q2 | Las plazas internacionales se asignan con la regla de cada liga | Campeón de split, ganador de Road to MSI, puntos de temporada |
| Q3 | Si un equipo ya tiene plaza por otra vía, la plaza pasa al siguiente según la regla de cascada | El campeón de split 1 también gana split 2 |
| Q4 | El sembrado internacional usa bombos por región y posición | Plazas personalizadas: los bombos se recalculan |
| Q5 | Una fase con equipos pendientes («ganador de R1-S2») se resuelve al terminar la fase anterior | |

### Calendario (`core/competition/calendar.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| C1 | Cada serie tiene un día; ningún equipo juega dos series el mismo día | |
| C2 | Las fases van en orden y ninguna fase de una liga se solapa con un internacional en el que juegan sus equipos | |
| C3 | Con los formatos reales, cada fase empieza en la semana real de 2026 (fechas del snapshot) | Margen de ±1 semana |
| C4 | Un formato personalizado más largo cabe en su ventana o se rechaza | Ver [pregunta 4](#preguntas-abiertas) |

### Formatos reales (`tools/data-pipeline` y `content/real/formats`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| R1 | Cada formato real de liga reproduce el snapshot de 2026: equipos, series por fase y Bo por ronda | Las seis ligas |
| R2 | Los datos sin confirmar llevan `verified: false` y la validación los lista | Internacionales hasta comprobarlos |

### Globales

| # | Comportamiento |
| --- | --- |
| P1 | Golden: un año completo IA contra IA con semilla fija produce siempre el mismo log de hechos |
| P2 | Las series de la temporada usan los hechos `series.*` y `match.*` de siempre (mismo motor que el draft rápido) |
| P3 | Un comando rechazado no cambia nada (N2 del plan 04) |
| P4 | Los formatos quedan copiados en el hecho que crea la temporada: cambiar el contenido empaquetado no cambia una temporada empezada |
| P5 | Presupuesto: un año completo se simula dentro del tiempo acordado (ver [pregunta 5](#preguntas-abiertas)) |
| P6 | Ámbitos nuevos de RNG registrados con número fijo (G7 del plan 05) |

## 3. Diseño

### Formatos como datos

Un **formato de competición** es una lista ordenada de **fases**. Cada fase dice de dónde salen sus equipos, cómo se juega y qué produce (una clasificación). Las piezas son pocas y se combinan: así se cubren las ligas, los internacionales, el modo Torneo y, más adelante, las segundas divisiones.

```ts
// packages/contracts/competition/format.ts (forma orientativa; Zod)
Competition = { id, kind: "league" | "international", stages: Stage[],
                tiebreak: Criterion[], slots?: Slot[], verified: boolean }
Stage = { id, window: { startWeek, weeks, matchDays }, entrants: Source,
          play: RoundRobin | Groups | Swiss | SingleElim | DoubleElim }
Source = { fixed: TeamId[] } | { standing: StageRef, from, to }
       | { qualified: CompetitionId, slot } | { pots: PotRule }
RoundRobin = { rounds: 1 | 2, bestOf }
Groups     = { count, seeding: "snake" | "cross", inner: RoundRobin }
Swiss      = { wins, losses, bestOf, decisiveBestOf, round1: "pots", avoid: ["region", "rematch"] }
SingleElim = { size, byes, bestOf: BestOf[], opponentChoice: boolean }
DoubleElim = { size, upper: BestOf[], lower: BestOf[], drop: number[], reset: boolean }
Criterion  = "seriesWins" | "gameDiff" | "headToHead" | "gameWins" | "tiebreakerGame" | "draw"
Slot       = { to: CompetitionId, rule: "stageWinner" | "standing" | "points", cascade: ... }
```

- **Validación:** Zod en `packages/contracts/competition/`; las reglas que cruzan fases (V3–V5) se comprueban en el núcleo con errores nuevos.
- **Personalización al crear la carrera:** el usuario edita estos mismos campos (splits, vueltas, Bo por fase, grupos o Swiss, simple o doble eliminación, plazas por región). La pantalla es del plan 14; este plan valida el resultado.
- **Bloqueo:** el formato se copia en el hecho `season.created`. Solo se puede cambiar el de la temporada siguiente (V6, P4).

### Módulos del núcleo (`packages/core/competition/`)

| Módulo | Responsabilidad |
| --- | --- |
| `round-robin.ts` | Método del círculo: jornadas, descansos y prioridad del game 1 |
| `groups.ts` | Reparto en grupos (serpiente, cruce, separación por región) |
| `swiss.ts` | Emparejamiento por balance con restricciones y búsqueda con vuelta atrás |
| `bracket.ts` | Cuadros simple y doble, byes y caída al cuadro inferior |
| `standings.ts` y `tiebreak.ts` | Clasificación, criterios y explicación |
| `qualification.ts` | Plazas internacionales y cascada |
| `calendar.ts` | Días de cada serie dentro de la ventana de su fase |
| `season.ts` | Encadena las fases y decide qué series tocan cada día |
| `handlers.ts` | Comandos, hechos y consultas en el despachador |

Reglas del núcleo: sin reloj ni `Math.random`, solo enteros, módulos de unas 300 líneas como máximo.

### Comandos, hechos y consultas

| Comando | Hechos |
| --- | --- |
| `season.create` `{ year, competitions, teams, seed }` | `season.created` (copia de los formatos y su `content_version`) |
| `season.playDay` `{ day }` | Por cada serie: `series.started` … `series.finished` (los de siempre) y `competition.seriesRecorded`; al cerrar una fase, `competition.stageFinished` con la clasificación y su explicación; `competition.qualified` por cada plaza; `competition.paired` con cada ronda Swiss |

- **Consultas:** `competition.standings`, `competition.bracket`, `competition.schedule` y `competition.qualified`. Son proyecciones de los hechos; el plan 13 las guardará.
- **Idempotencia:** por `expectedPosition`, como el resto de comandos.
- **Partidas de otros equipos:** draft de la IA de cada coach y `match.play`, sin animación (decisión del 22-11-2026). La serie del usuario sigue el flujo del draft rápido.
- **RNG:** dos ámbitos nuevos, `competition` (sorteos de Swiss, grupos y desempate final) y `schedule` (reparto en días), con id por competición, temporada, fase y ronda. Los ids de texto se convierten en el índice de la competición dentro de la temporada, no en un hash.

### Calendario

- El núcleo cuenta **días enteros desde el inicio de la temporada** (sin fechas reales). La UI pone el año y el mes.
- Cada fase tiene una **ventana** (semana de inicio, semanas y días de partido por semana). Con los formatos reales, las ventanas salen de `startsOn` y `endsOn` de cada torneo del snapshot.
- `calendar.ts` reparte las jornadas en los días de partido de la ventana. Las series de eliminatoria quedan con equipos pendientes hasta que termina la serie que los alimenta (Q5).
- Los internacionales tienen su ventana; las ligas no programan series de un equipo clasificado durante ella (C2).

### Desempates

Cada competición tiene su **lista de criterios** (dato, no código). Por defecto, el modelo de Riot: series ganadas, diferencia de games, enfrentamiento directo y, si el empate toca un corte, partida de desempate; si no, sorteo. El orden exacto de cada liga sale de su reglamento y se marca `verified` al comprobarlo.

### Ascensos y descensos

No se implementan aquí (plan 24), pero el esquema ya los cubre: la serie de promoción es una fase `SingleElim` de tamaño 2 cuyos equipos salen de dos `standing` de competiciones distintas (penúltimo de primera y subcampeón de segunda), y el ascenso directo es una plaza con regla `standing` hacia la temporada siguiente. No hace falta reservar campos nuevos.

### Formatos reales de 2026: de dónde salen

**El snapshot de Leaguepedia no trae las reglas del formato**, solo los torneos con fechas y las partidas. Por eso:

1. **Formatos curados a mano** en `packages/core/content/real/formats/<liga>.json`, escritos a partir de las páginas de Leaguepedia y los reglamentos oficiales, con su procedencia.
2. **Comprobación automática (R1):** un test del pipeline compara cada formato curado con el snapshot (equipos, series por fase, Bo por ronda deducido de las victorias máximas). Si Riot cambia el formato, el workflow semanal lo detecta.
3. **Internacionales:** el snapshot actual no los incluye. Se curan con `verified: false` hasta comprobarlos (ver [pregunta 6](#preguntas-abiertas)).

Inferido del snapshot (22-11-2026). Lo marcado con **(?)** hay que verificarlo en el reglamento.

| Liga | Fase | Lo que muestra el snapshot | Formato propuesto |
| --- | --- | --- | --- |
| LCK | Cup (ene–mar) | 10 equipos en 2 grupos; 25 series, cada equipo 5 contra el otro grupo | Grupos cruzados Bo3 (semana 3 en Bo5) → play-in (Bo3, Bo3, Bo5) → playoffs Bo5 (?) |
| LCK | Rounds 1-2 (abr–may) | 90 series, todas las parejas 2 veces | Doble round robin Bo3 |
| LCK | Road to MSI (jun) | 5 series Bo5 en 4 rondas | Doble eliminación de 4 (?) |
| LCK | Rounds 3-4 (jul–ago) | 40 series: 2 grupos de 5, doble vuelta | Grupos Legend/Rise según Rounds 1-2, Bo3 |
| LCK | Play-In y Playoffs (ago–sep) | 3 + 10 series Bo5 | Play-in Bo5 → doble eliminación de 6 Bo5 con elección de rival (?) |
| LPL | Split 1 (ene–mar) | 14 equipos, 54 series Bo3 y un desempate; grupos | Estructura de grupos **(?)**; playoffs con play-in de 3 rondas y cuadro Bo5 |
| LPL | Split 2 (abr–jun) | Grupo de 8 a doble vuelta (56) y grupo de 6 a una vuelta (15) | Grupos por nivel Bo3 → play-in y cuadro Bo5 |
| LPL | Split 3 y Grand Finals (jul–sep) | 12 equipos: grupos de 8 y 4 a doble vuelta (68); Grand Finals con Knight's Road | Grupos Bo3 → Knight's Road y cuadro Bo5 (?) |
| LEC | Versus (ene–mar) | 12 equipos a una vuelta Bo1 (66); playoffs de 14 series | Una vuelta Bo1 → doble eliminación (Bo3 en rondas 1-2, Bo5 después) (?) |
| LEC | Spring y Summer | 10 equipos a una vuelta Bo3 (45); playoffs de 8 series Bo5 | Una vuelta Bo3 → doble eliminación de 6 u 8 Bo5 (?) |
| LCP | Split 1 y 2 | 8 equipos a una vuelta Bo3 (28); playoffs de 8 series Bo5 | Una vuelta Bo3 → doble eliminación Bo5 (?) |
| LCP | Split 3 | Rondas 1-5, Seeding, cuartos, semis y final | Clasificatoria a Worlds; estructura **(?)** |
| LCS | Lock-In | Swiss de 3 rondas Bo3, Last Chance Bo1 y playoffs de 8 series Bo5 | Swiss → última oportunidad → eliminatoria Bo5 (?) |
| LCS | Spring y Summer | 8 equipos a una vuelta Bo3 (28); playoffs de 8 y 10 series Bo5 | Una vuelta Bo3 → doble eliminación Bo5 |
| CBLOL | Cup | 8 equipos a una vuelta Bo1 (28); play-in y playoffs | Una vuelta Bo1 → play-in → doble eliminación (?) |
| CBLOL | Split 1 y 2 | 8 equipos a una vuelta Bo3 (28); playoffs de 10 series Bo5 | Una vuelta Bo3 → doble eliminación de 6 Bo5 |

Internacionales (sin datos en el snapshot; todo **(?)** salvo las plazas de LCS y CBLOL, que vienen de la [investigación de datos](../research/stack-2026-11/research_notes/Stack%20tecnológico%20Rift%20Legends/datos_lol_y_legal.md)):

| Torneo | Plazas | Formato de referencia (2025) |
| --- | --- | --- |
| First Stand (mar) | Campeón del primer split de cada liga; LCS 1 y CBLOL 1 | Grupos Bo3 → eliminatoria Bo5 |
| MSI (jun–jul) | LCK 2, LPL 2, LEC 2, LCP 2, LCS 2 y CBLOL 1 (?) | Play-in de doble eliminación Bo5 → cuadro de doble eliminación Bo5 |
| Worlds (oct–nov) | LCK 4, LPL 4, LEC 3 o 4, LCP 3, LCS 3 y CBLOL 1 (?) | Play-in Bo5 → Swiss de 16 (Bo1, Bo3 en las decisivas, 3-3) → eliminatoria simple de 8 Bo5 |

Volumen de un año real: unas **2.400 partidas** de liga en el snapshot, más unas 200 internacionales. El test de calibración simula del orden de miles de partidas en unos 5 s (sin la IA de draft), así que un año entero debería caber en menos de un minuto; el entregable 11 lo mide.

## 4. Entregables (un issue por fila · milestone «Fase 4 — Competición»)

| Orden | Entregable | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | Contratos `competition`: esquema de formatos, comandos, hechos y errores ES/EN | `type:task`, `area:core` | V2, V7 y tests de esquema |
| 2 | Round robin y grupos | `type:task`, `area:competition` | RR1–RR4, G1–G3 |
| 3 | Clasificación y desempates con explicación | `type:task`, `area:competition` | D1–D7 |
| 4 | Swiss propio | `type:task`, `area:competition` | S1–S8 |
| 5 | Eliminatoria simple y doble | `type:task`, `area:competition` | B1–B6 |
| 6 | Encadenado de fases, sembrado y plazas internacionales | `type:task`, `area:competition` | Q1–Q5, V3–V5 |
| 7 | Calendario de la temporada | `type:task`, `area:competition` | C1–C4 |
| 8 | Formatos reales de las seis ligas y comprobación con el snapshot | `type:task`, `area:content` | V1, R1, C3 |
| 9 | Formatos de First Stand, MSI y Worlds 2026 | `type:task`, `area:content` | V1, R2, Q4 |
| 10 | Temporada en el despachador: crear, jugar día a día con el mismo motor y consultas | `type:task`, `area:competition` | P2–P4, P6, V6 |
| 11 | Golden y presupuesto de un año IA contra IA | `type:test`, `area:competition` | P1, P5 |

2–5 van en paralelo tras 1; 6 depende de 2–5; 7 de 6; 8 y 9 de 1 (los datos) y de 6 (la validación cruzada); 10 de 6 y 7; 11 cierra el plan.

## 5. Preguntas abiertas

| # | Pregunta | Opciones | Recomendación |
| --- | --- | --- | --- |
| 1 | ¿La sección «Competición» y el modo Torneo van en este plan? | (a) Sí, aquí; (b) en un plan aparte de la misma fase (p. ej. plan 31) | **(b)**: este plan ya es grande y la UI depende de las consultas del entregable 10 |
| 2 | Empates en un corte (clasificar o quedar fuera) | (a) Partida de desempate Bo1 como en el reglamento; (b) solo criterios y sorteo | **(a)** solo cuando el empate toca un corte; en el resto, criterios y sorteo. El motor ya juega partidas, así que es barato y más real |
| 3 | Elección de rival en playoffs (LCK, LPL) | (a) Implementarla: la IA elige con una regla explicable (el rival de menor nivel) y el usuario elige cuando le toca; (b) cuadro fijo por sembrado | **(a)**, porque el formato real es el de por defecto; verificar antes que sigue vigente en 2026 |
| 4 | Un formato personalizado no cabe en su ventana | (a) Rechazarlo; (b) más series por día y, si aún no cabe, rechazar; (c) retrasar el resto del calendario | **(b)**: respeta el calendario real y solo molesta en casos extremos |
| 5 | Presupuesto de un año IA contra IA (≈2.600 partidas) | (a) ≤ 30 s; (b) ≤ 60 s; (c) ≤ 2 min, en el PC del usuario | **(b)**, medido en el Arch del usuario; en el CI, un split con un límite proporcional |
| 6 | Verificar los internacionales | (a) Ampliar el pipeline para traer sus torneos de Leaguepedia y aplicarles R1; (b) curarlos a mano sin comprobación | **(a)**: misma fuente y licencia, y el workflow semanal avisa si cambian |
| 7 | Invitados de un solo split (LEC Versus con 12; plaza de tier 2 en LCS y CBLOL), que no están en la liga del juego | (a) Adaptar el formato a los equipos de la liga (Versus con 10); (b) añadir invitados de IA cuando lleguen las segundas divisiones (Fase 6) | **(a)** ahora y **(b)** en la Fase 6 |
| 8 | Prioridad del game 1 en las series de competición | (a) Sorteo, como en el draft rápido; (b) el mejor sembrado en eliminatorias y sorteo en liga y Swiss; (c) el equipo «local» del calendario | **(b)**: es lo que hacen las eliminatorias pro y en liga no hay sembrado claro |
