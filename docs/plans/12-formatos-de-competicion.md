# Plan 12 — Formatos de competición y Swiss propio

- **Estado:** aprobado (24-11-2026) con las [decisiones del usuario](#5-decisiones-del-usuario-24-11-2026).
- **Fase:** 4 · Competición ([plan general](00-plan-general.md#fase-4--competición)).

## 1. Objetivo y alcance

El núcleo genera y juega una **temporada competitiva completa** (seis ligas, First Stand, MSI y Worlds) a partir de **formatos descritos como datos**. Por defecto, los reales de 2026. Todas las series se juegan con el mismo motor que el draft rápido (IA de draft y simulación por minuto), de forma determinista.

| Entra en este plan (Fase 4) | Queda fuera |
| --- | --- |
| Esquema de formatos en `packages/contracts` y su validación | Pantalla de crear carrera y bucle diario (plan 14) |
| Round robin, grupos, Swiss propio, eliminatoria simple y doble | Persistencia en SQLite y proyecciones (plan 13): la temporada vive en memoria, como el draft rápido |
| Clasificación y desempates con su explicación | Segundas divisiones y academias (Fase 6) |
| Encadenado de fases, sembrado y plazas internacionales | Ascensos, descensos y serie de promoción (plan 24): el esquema los admite sin conceptos nuevos (ver [diseño](#ascensos-y-descensos)) |
| Calendario de la temporada (días enteros, sin reloj) | Sección «Competición» y modo Torneo en la UI: plan aparte de la Fase 4 (decisión 1) |
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
| RR4 | En liga y Swiss, la prioridad del game 1 se sortea con el RNG de la competición (decisión 8) | Misma semilla, mismo sorteo |
| G1 | El reparto en grupos sigue el sembrado en serpiente | 10 equipos en 2 grupos; 14 en grupos de 8 y 6 |
| G2 | En internacionales, dos equipos de la misma región no caen en el mismo grupo si hay alternativa | Una región con más equipos que grupos: se reparte lo menos posible |
| G3 | Cruce entre grupos (LCK Cup): cada equipo juega solo contra el otro grupo | |
| G4 | La Super Week pone una serie Bo5 por equipo al final de los cruces y da dos puntos al grupo que gana cada serie | Los puntos pueden cambiar qué grupo gana aunque pierda más series |

### Clasificación y desempates (`core/competition/standings.ts`, `tiebreak.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| D1 | El orden sale de los criterios de la competición, en su orden | Series ganadas; después diferencia de games |
| D2 | Enfrentamiento directo entre empatados con una minitabla | Empate a tres: se aplica a los tres, no por parejas |
| D3 | Si un criterio separa solo a parte de los empatados, el resto vuelve a empezar desde el primer criterio | 4 empatados que quedan 1 + 3 |
| D4 | Si el empate decide una plaza de corte (clasificación o eliminación), se programa una serie de desempate con el Bo del formato: Bo3 por defecto, el del reglamento en los reales (decisión 2) | Empate que no toca ningún corte: no se juega, deciden los criterios y el sorteo. Empate a tres en un corte: desempates entre parejas según el formato |
| D5 | Último recurso: sorteo con el RNG de la competición | Misma semilla, mismo orden |
| D6 | Cada posición lleva su explicación: criterio decisivo y valores | «Empate a 6-3; gana G2 por enfrentamiento directo (2-0)» |
| D7 | Propiedad: la clasificación es un orden total y una permutación de los participantes | Con cualquier resultado |
| D8 | LEC desempata en el orden documentado en la tabla de reglamentos | Primer split sin historial, victorias de distinto peso y duración, Bo3 en el corte y sorteo |

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
| B6 | Cuadro fijo por sembrado, sin elección de rival (los internacionales con sorteo, en la [§6](#6-sorteos-reales-de-los-internacionales-27-11-2026)); el mejor sembrado tiene la prioridad del game 1 (decisiones 3 y 8) | Cruce entre equipos con el mismo sembrado en grupos distintos: lo decide la clasificación de origen |

### Encadenado, sembrado y plazas (`core/competition/season.ts`, `qualification.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| Q1 | Una fase toma sus equipos y su sembrado de la clasificación de otra | Grupos Legend/Rise de LCK según Rounds 1-2 |
| Q2 | Las plazas internacionales se asignan con la regla de cada liga | Campeón de split, ganador de Road to MSI, puntos de temporada |
| Q3 | Si un equipo ya tiene plaza por otra vía, la plaza pasa al siguiente según la regla de cascada | El campeón de split 1 también gana split 2 |
| Q4 | El sembrado internacional usa bombos por región y posición | Plazas personalizadas: los bombos se recalculan |
| Q5 | Una fase con equipos pendientes («ganador de R1-S2») se resuelve al terminar la fase anterior | |
| Q6 | LCK Cup da tres plazas directas según las tablas de grupo | Los dos primeros del ganador y el primero del perdedor, aunque la tabla conjunta dé otro orden |

### Calendario (`core/competition/calendar.ts`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| C1 | Cada serie tiene un día; ningún equipo juega dos series el mismo día | |
| C2 | Las fases respetan sus dependencias. Los equipos clasificados no juegan series de liga durante la ventana del internacional | Los grupos independientes de un internacional pueden jugar en paralelo |
| C3 | Con los formatos reales, cada fase empieza en la semana real de 2026 (fechas del snapshot) | Margen de ±1 semana |
| C4 | Un formato personalizado más largo se ajusta con más series por día (4 en total) dentro de su ventana. La temporada nunca se alarga (decisión 4) | Si aún no cabe, `format-too-long`, con una sugerencia para quitar una vuelta o reducir el número de equipos |

### Formatos reales (`tools/data-pipeline` y `content/real/formats`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| R1 | Cada formato real reproduce el snapshot de 2026: equipos, series por fase y Bo por ronda | Las seis ligas y First Stand, MSI y Worlds (decisión 6) |
| R2 | Los datos sin confirmar llevan `verified: false` y la validación los lista | Desempates de un reglamento aún sin comprobar |
| R3 | Cada formato real se adapta a los equipos de su liga en el juego (decisión 7) | LEC Versus con 10 equipos en vez de 12 |

### Globales

| # | Comportamiento |
| --- | --- |
| P1 | Golden: un año completo IA contra IA con semilla fija produce siempre el mismo log de hechos |
| P2 | Las series de la temporada usan los hechos `series.*` y `match.*` de siempre (mismo motor que el draft rápido) |
| P3 | Un comando rechazado no cambia nada (N2 del plan 04) |
| P4 | Los formatos quedan copiados en el hecho que crea la temporada: cambiar el contenido empaquetado no cambia una temporada empezada |
| P5 | Presupuesto: un año completo IA contra IA en ≤ 60 s en el Arch del usuario; en el CI, un split con un límite proporcional (decisión 5) |
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
SingleElim = { size, byes, bestOf: BestOf[] }
DoubleElim = { size, upper: BestOf[], lower: BestOf[], drop: (number | null)[][], lowerSeeds: number[], reset: boolean }
Criterion  = "seriesWins" | "gameDiff" | "headToHead" | "gameWins" | { tiebreakerSeries: BestOf } | "draw"
Slot       = { to: CompetitionId, rule: "stageWinner" | "standing" | "points", cascade: ... }
```

- **Validación:** Zod en `packages/contracts/competition/`; las reglas que cruzan fases (V3–V5) se comprueban en el núcleo con errores nuevos.
- **Esquema implementado (#418)** en `format.ts`; difiere de la forma orientativa en:
  - Cada `play` lleva `size` (equipos que juega), para validar Swiss, grupos y cuadros sin conocer la temporada. Se omite `byes`: se deduce de `size`.
  - `Criterion` son cadenas (`tiebreakerSeries` incluido); el Bo del desempate es `tiebreakerBestOf` de la competición (Bo3 por defecto).
  - `Source` y `play` se distinguen por `kind` y `type`. La ventana añade `maxSeriesPerDay` (1–4, por defecto 4) y `DoubleElim` añade `grandFinal`.
  - `validateFormat` comprueba un formato por sí solo (V2) y responde `invalid-format` con la ruta. `format-too-long` lo emite el calendario (entregable 7).
- **Personalización al crear la carrera:** el usuario edita estos mismos campos (splits, vueltas, Bo por fase, grupos o Swiss, simple o doble eliminación, plazas por región). La pantalla es del plan 14; este plan valida el resultado.
- **Swiss implementado (#422)** en `swiss.ts` (`pairSwissRound`, `swissStandings`): exige un número par de equipos. Ronda 1: cuatro bombos iguales por sembrado (1 contra 4, 2 contra 3; si el número no es múltiplo de 4, mitad superior contra inferior), sorteo y sin la misma región. Después, sorteo dentro de cada grupo de igual balance, sin revanchas (como el Swiss de Worlds). El sorteo usa un flujo propio del ámbito `competition`: se baraja y una búsqueda con vuelta atrás completa el emparejamiento. Si no hay emparejamiento se relaja, por este orden, la región (solo cuenta en la ronda 1), la revancha y, como último recurso, el balance; `relaxed` registra lo que rompe el resultado. Con 16 equipos a 3-3 los grupos son siempre pares, así que el balance nunca se cruza y pasan exactamente 8. Cada serie lleva su Bo, la prioridad del game 1 (sorteo) y el motivo (`pots`, `same-record`, `cross-record`).
- **Clasificación implementada (#421)** en `standings.ts` (`computeStandings`) y `tiebreak.ts` (`orderTies`). Cada criterio separa a los empatados; si solo separa a parte, cada grupo restante vuelve al primer criterio (la minitable de `headToHead` se recalcula solo con ellos). `tiebreakerSeries` solo actúa si el grupo cruza un corte (`cuts` = equipos que pasan): devuelve en `pending` las series entre todas las parejas del grupo que faltan y deja a los empatados en orden de sembrado con explicación `none`; cuando están jugadas (`tiebreakerResults`) decide por series ganadas entre ellos. El sorteo final (`draw`, siempre al final aunque la lista no lo nombre) usa el ámbito `competition` con una ronda reservada (`0xfffffffe`) y la posición del grupo. Cada fila lleva `explanation` con el criterio, los empatados y sus valores.
- **Encadenado (#424).** `buildStageGraph` comprueba tamaños, referencias, ciclos y que cada plaza declarada se use una vez. `resolveStage` devuelve las fases cuyos resultados faltan o los equipos en orden de sembrado. Una fase puede combinar equipos directos, puestos de una tabla final, ganadores o perdedores de una serie y plazas internacionales. Los play-in en escalera se componen de fases de una serie. `ranked` reparte la tabla por tramos contiguos para Legend y Rise.
- **Plazas (#424).** Cada liga declara las reglas por torneo en orden de prioridad: ganador de fase, clasificación o puntos acumulados hasta una fase. El núcleo explica qué regla y puesto asignaron cada plaza y qué equipos ya se habían clasificado. Los empates a puntos se ordenan por sembrado de liga e identificador. `next` baja por la tabla y `vacant` conserva el hueco. Los formatos pueden usar todas las plazas o seleccionar puestos concretos de cada liga.
- **Bombos (#424).** Para el campo completo, se ordenan las plazas por puesto en su liga y después por orden de ligas en la temporada. Cambiar los cupos recompone los bombos. Una fase que mezcla plazas y resultados puede declarar su propio orden. Se baraja dentro de cada bombo y se devuelve el origen, orden previo, bombo y sembrado de cada equipo. Los grupos con `avoidSameLeague` conservan el reparto de bombos y buscan una distribución sin cruces de liga o región. Si no existe, registran que se relajó la restricción. El Swiss aplica la restricción en la ronda 1 cuando `avoid` incluye `region`.
- **Internacionales 2026 (#424).** La composición de grupos y play-in se infiere del snapshot local. First Stand cruza el ganador de cada grupo GSL contra el segundo del otro. El ganador del play-in se suma a siete plazas directas en MSI y a quince en Worlds. Los ocho primeros del Swiss pasan a los cuartos. Los formatos conservan `verified: false` hasta comprobar las reglas de sembrado con los reglamentos.
- **Bloqueo:** el formato se copia en el hecho `season.created`. Solo se puede cambiar el de la temporada siguiente (V6, P4).

### Módulos del núcleo (`packages/core/competition/`)

| Módulo | Responsabilidad |
| --- | --- |
| `round-robin.ts` | Método del círculo: jornadas y descansos |
| `groups.ts` | Reparto en grupos (serpiente, cruce, separación por región) |
| `swiss.ts` | Emparejamiento por balance con restricciones y búsqueda con vuelta atrás |
| `bracket.ts` | Cuadros simple y doble, byes y caída al cuadro inferior |
| `standings.ts` y `tiebreak.ts` | Clasificación, criterios y explicación |
| `stage-graph.ts` | Valida dependencias, tamaños y plazas declaradas |
| `qualification.ts` | Plazas internacionales y cascada |
| `stage-draw.ts` | Bombos y reparto en grupos |
| `calendar.ts` | Días de cada serie dentro de la ventana de su fase |
| `season.ts` | Resuelve los equipos de cada fase desde los resultados y las plazas |
| `handlers.ts` | Comandos, hechos y consultas en el despachador |

Reglas del núcleo: sin reloj ni `Math.random`, solo enteros, módulos de unas 300 líneas como máximo.

### Comandos, hechos y consultas

| Comando | Hechos |
| --- | --- |
| `season.create` `{ year, competitions, teams, seed }` | `season.created` (copia de los formatos y su `content_version`) |
| `season.playDay` `{ day }` | Por cada serie: `series.started` … `series.finished` (los de siempre) y `competition.seriesRecorded`; al cerrar una fase, `competition.stageFinished` con la clasificación y su explicación; `competition.qualified` por cada plaza; `competition.paired` con cada ronda Swiss |

- **Consultas:** `competition.standings`, `competition.bracket`, `competition.schedule` y `competition.qualified`. Son proyecciones de los hechos; el plan 13 las guardará.
- **Idempotencia:** por `expectedPosition`, como el resto de comandos.
- `season.playDay` espera el próximo día con series. Los desempates usan el calendario de la fase y conservan las fechas ya jugadas. Los formatos nuevos se aceptan al crear un año posterior tras terminar el actual.
- **Partidas de otros equipos:** draft de la IA de cada coach y `match.play`, sin animación (decisión del 22-11-2026). La serie del usuario sigue el flujo del draft rápido.
- **RNG:** dos ámbitos nuevos, `competition` (sorteos de Swiss, bombos y desempate final) y `schedule` (reparto en días), con id por competición, temporada, fase y ronda. Los ids de texto se convierten en el índice de la competición dentro de la temporada, no en un hash. `competition = 6` ya está en el registro (#420). La prioridad del game 1 en liga usa su propia semilla por serie. Los bombos usan la ronda reservada `0xfffffffd`. Sin bombos, los grupos se reparten según el sembrado.

### Calendario

- El **día 0 es el 1 de enero** del año de la temporada. `startWeek × 7` da el primer día de la ventana y el final es exclusivo. El último día disponible es el 31 de diciembre, también en años bisiestos. Las semanas de los internacionales del snapshot ya usan el 1 de enero como origen.
- `matchDays` limita cuántos días usa una fase en cada semana. El calendario elige esos días dentro de la ventana. Cada día admite hasta **4 series por competición** (decisión del 25-11; antes eran 4 entre todas) y cada fase puede fijar un tope menor. Ningún equipo juega dos series el mismo día.
- `buildCalendar` usa el grafo de fases para comprobar el formato completo antes de crear la temporada. Espera a las fases que aportan resultados y respeta el orden de las fases de liga. En eliminatorias reserva las series pendientes después de las que las alimentan. En Swiss reserva cada ronda hasta conocer sus emparejamientos.
- Las ligas reservan para los equipos clasificados todo el intervalo entre el comienzo de la primera ventana y el final de la última del internacional, incluidos los descansos. Mientras queden plazas por resolver, la comprobación previa contempla a los posibles clasificados.
- Cada serie indica su primer día permitido por la ventana y sus dependencias, y el primer día descartado por cada motivo. El calendario prueba otros días si una asignación deja sin sitio a otra serie. Si el formato sigue sin caber, devuelve `format-too-long` (C4). La conexión con `season.create` corresponde al entregable de comandos.

### Cuadros (`bracket.ts`, #423)

- `buildSingleElim` y `buildDoubleElim` devuelven la estructura (partidos que apuntan a un sembrado, al ganador o al perdedor de otro); `resolveBracket` pone los equipos según los resultados y calcula la prioridad del game 1 (mejor sembrado, con sus dos sembrados como explicación). `seedEntrants` ordena por sembrado y, a igualdad, por la clasificación de origen.
- **Byes:** el cuadro se completa hasta la potencia de dos; los sembrados que faltan dan el paso directo a sus rivales (con 6, pasan el 1 y el 2; con 10, del 1 al 6).
- **Caídas (decisión 24-11-2026):** `drop[r][m]` es la ronda inferior (desde 0) a la que cae el perdedor de la serie `m` de la ronda superior `r`; `null` = eliminado. `lowerSeeds[k]` es cuántos sembrados entran directos en la ronda inferior `k` (los peores en las primeras rondas); `size` cuenta todos los equipos y el cuadro superior usa los demás. Cada ronda inferior junta supervivientes, caídos y entrantes. Si hay grupos mezclados (o caídos de varias rondas), se cruzan el primero con el último (sin revanchas inmediatas); un solo grupo se empareja por orden. Con un número impar, el primero pasa sin jugar. Una ronda inferior sin partidos, un `drop` a una ronda que no existe o un cuadro inferior que no termina con un solo equipo es un formato inválido.
- Ejemplos de `drop`: 4 → `[[0,0],[1]]`; 8 → `[[0,0,0,0],[1,1],[3]]`; LCK, LCS Summer y CBLOL (6, los perdedores de la ronda 2 caen a rondas distintas) → `[[0,0],[1,2],[3]]`; LCP (6, la ronda 1 queda eliminada) → `[[null,null],[0,0],[1]]`; LEC Spring/Summer y LCS Spring (4 arriba, sembrados 5-6 abajo) → `[[0,0],[2]]` con `lowerSeeds [2,0,0]`; LPL Grand Finals (6 + 2 de Knight's Road) → `[[0,0],[1,1],[3]]` con `[2,0,0,0]`; LCK Road to MSI → `[[3]]` con `[2,1,1,0]`. Un test por cada uno comprueba que construye y termina con un campeón.
- **Final:** `grandFinal: null` la omite (grupos GSL): el ganador del cuadro superior es primero y el del inferior, segundo. Sin reset, el ganador de la final es el campeón; con `reset`, si gana el del cuadro inferior se juega una segunda final (`RS`), y si no, se omite.

#### Estudio de los cuadros reales (24-11-2026)

Fuente: partidas de Leaguepedia (Cargo `MatchSchedule`) de 2026, reconstruyendo quién jugó contra quién y adónde fue cada perdedor. **No se han leído los reglamentos**: los emparejamientos exactos y el sembrado siguen `(?)`.

| Cuadro (2026) | Forma real | ¿Lo expresaba el modelo anterior (`drop` por ronda)? |
| --- | --- | --- |
| LPL split 1 y 2 (tras play-in), LEC Versus, MSI (cuadro) | Doble eliminación estándar de 8, sin reset (gana el inferior en la final de MSI y LPL GF) | Sí: `[0,1,3]` |
| Play-in de MSI y Worlds | Doble eliminación de 4; la final solo ordena a los dos que pasan | Sí: `[0,1]` |
| Worlds (cuartos), First Stand (semis) | Eliminatoria simple de 8 y de 4, todo Bo5 | Sí |
| LCK Playoffs y Cup, LCS Summer, CBLOL split 1 y 2 | 6 equipos: 1.º y 2.º con bye; perdedores de la ronda 1 → inferior 1; **los dos perdedores de la ronda 2 caen a rondas inferiores distintas** (2 y 3); perdedor de la final → inferior 4 | No (un `drop` por ronda) |
| LCP split 1 y 2 | 6 equipos: **los perdedores de la ronda 1 quedan eliminados**; los de la ronda 2 → inferior 1; perdedor de la final → inferior 2 | No (no hay «eliminado») |
| LEC Spring y Summer, LCS Spring | 6 equipos: 4 en el cuadro superior y **los sembrados 5 y 6 entran directos al cuadro inferior 1** contra los perdedores de la ronda 1 | No (no hay entrantes al inferior) |
| LPL Grand Finals | Superior de 6 + **2 ganadores de Knight's Road que entran en la inferior 1**; después como el de 8 | No (entrantes) |
| LCK Road to MSI (King of the Hill) | Superior de 2 (una serie); sembrados 5-6, 4 y 3 entran a la inferior en las rondas 1, 2 y 3; perdedor de la final superior → inferior 4 | No (entrantes en varias rondas) |
| Play-in de LPL y LCK Cup | Tres rondas donde los ganadores de la ronda 1 pasan al cuadro principal y los perdedores se cruzan con los ganadores de la 2 | Fuera de `bracket.ts`: es otra fase (escalera) |

Ningún cuadro de 2026 usa reset. Las 4 versiones de 6 equipos (LCK, LCP, LEC, LCS) son distintas entre sí.

**Resultado:** el modelo adoptado (`drop` por serie y `lowerSeeds`) cubre los cuadros. El encadenado de #424 permite componer los play-in en escalera de LPL y LCK Cup con fases de una serie.

Pendiente al verificar reglamentos: el cruce exacto en cada ronda inferior (primero con último o por orden) y quién cae adónde dentro de una ronda.

### Desempates

Cada competición tiene su **lista de criterios** (dato, no código). Por defecto, el modelo de Riot: series ganadas, diferencia de games, enfrentamiento directo y, si el empate toca un corte, serie de desempate (Bo3 por defecto, configurable a Bo1 o Bo5); si no, sorteo. El orden exacto de cada liga sale de su reglamento y se marca `verified` al comprobarlo.

### Ascensos y descensos

No se implementan aquí (plan 24), pero el esquema ya los cubre: la serie de promoción es una fase `SingleElim` de tamaño 2 cuyos equipos salen de dos `standing` de competiciones distintas (penúltimo de primera y subcampeón de segunda), y el ascenso directo es una plaza con regla `standing` hacia la temporada siguiente. No hace falta reservar campos nuevos.

### Formatos reales de 2026: de dónde salen

**El snapshot de Leaguepedia no trae las reglas del formato**, solo los torneos con fechas y las partidas. Por eso:

1. **Formatos de liga.** `pnpm data:league-formats` genera `packages/core/content/real/formats/<liga>.json` a partir de las definiciones del pipeline y el snapshot local. Cada fichero atribuye el contenido a Leaguepedia bajo CC BY-SA 3.0.
2. **Comprobación automática (R1).** Un test del pipeline compara los equipos, las series por fase y el Bo por ronda, deducido de las victorias máximas. Para las excepciones documentadas comprueba el dato histórico y la adaptación.
3. **Internacionales (#427):** `pnpm data:internationals` trae de Leaguepedia los torneos y las series de First Stand, MSI y Worlds 2026 (`internationals.json`) y genera sus formatos en `content/real/formats/`. Se comprueban como las ligas (R1) reproduciendo cada serie real contra el formato. Estructura (todo Bo5 salvo el Swiss):

   | Evento | Fases |
   | --- | --- |
   | First Stand | 2 grupos de 4 en doble eliminación GSL (`grandFinal: null`: 5 series, sin final) → semifinales y final |
   | MSI | Play-in de 4 en doble eliminación con final → cuadro de 8 en doble eliminación (7 directos + el ganador del play-in), `drop [[0,0,0,0],[1,1],[3]]`, sin reset |
   | Worlds | Play-in de 4 en doble eliminación (pasa 1) → Swiss de 16 a 3 victorias o 3 derrotas (Bo1; Bo3 si la serie clasifica o elimina) → cuartos, semis y final de 8 |

   El generador incluye las referencias de plazas, las fases previas y los bombos de Worlds del #424. Las reglas de sembrado siguen pendientes de confirmación en el reglamento.

#### Ligas de 2026 en el juego (#426)

| Liga | Splits | Fases y Bo | Adaptación o regla provisional |
| --- | --- | --- | --- |
| LCK · 10 | Cup, Rounds 1–2 y 3–4 | Cup: grupos cruzados → play-in Bo3/Bo3/Bo5 → doble de 6 Bo5. Rounds 1–2: doble vuelta Bo3 → Road to MSI en escalera Bo5. Rounds 3–4: Legend/Rise a doble vuelta Bo3 → play-in y doble de 6 Bo5. | El corte de verano usa la tabla de Legend/Rise. El snapshot solo conserva un game de Dplus Kia–Gen.G en la semana 10. Se trata como Bo3. |
| LPL · 14 | Splits 1–3 y Grand Finals | Split 1: grupos 6/4/4 a doble vuelta Bo3 → dos escaleras Bo5 → doble de 8 Bo5. Split 2: grupos 8/6 a dos y una vuelta Bo3 → cuatro cruces y doble de 8 Bo5. Split 3: grupos 8/4 a doble vuelta Bo3 → Knight’s Road y doble de 8 Bo5. | Grupos iniciales históricos. El split 2 usa puestos del split 1. El split 3 usa los ocho del cuadro anterior y los cuatro perdedores del play-in. Los cruces de ascenso y las semillas de escalera son provisionales. El desempate observado queda sujeto al corte. El cuarto puesto de Grand Finals sustituye la cuarta vía a Worlds, que dio plaza a TES en el snapshot. |
| LEC · 10 | Versus, Spring y Summer | Versus: una vuelta Bo1 y doble de 8 con Bo3 en las primeras dos rondas de ambos cuadros y Bo5 después. Spring y Summer: una vuelta Bo3 y doble de 6 Bo5, con dos equipos que entran por abajo. | Versus pasa de 66 a 45 series al quitar a Karmine Corp Blue y Los Ratones. |
| LCP · 8 | Splits 1–3 | Splits 1 y 2: una vuelta Bo3 y doble de 6 Bo5. Split 3: Swiss Bo3, con Bo5 en series decisivas → tres cruces de sembrado Bo5 → doble de 4 Bo5. | Swiss genérico a 3 victorias o derrotas. Reserva hasta tres series en ronda 5 para una observada. La selección para los cruces se aproxima con la tabla Swiss. El cruce inferior ordena puestos fuera de playoffs. |
| LCS · 8 | Lock-In, Spring y Summer | Lock-In: Swiss de tres rondas Bo3 → Last Chance Bo1 → doble de 6 Bo5. Spring y Summer: una vuelta Bo3 y doble de 6 Bo5. | Last Chance usa los puestos 6.º y 7.º del Swiss del juego. En Lock-In y Spring entran dos equipos directamente por abajo. |
| CBLOL · 8 | Cup, splits 1 y 2 | Cup: una vuelta Bo1 → play-in Bo3 y Last Chance Bo5 → doble de 6, primeras dos rondas superiores Bo3 y resto Bo5. Splits 1 y 2: una vuelta Bo3 → doble de 6 Bo5. | El primer billete del play-in se asigna al ganador de 5.º contra 6.º. |

Se conservan los cupos del #424 en orden LCK, LPL, LEC, LCP, LCS y CBLOL. First Stand usa 2/2/1/1/1/1, MSI 2/2/2/2/2/1 y Worlds 4/4/3/3/3/2. Las plazas bajan por la clasificación de la fase que las decide. Se aplica el desempate Bo3 en cortes y el cuadro fijo por sembrado. Los desempates, el sembrado exacto y las vías oficiales que dependen de puntos siguen pendientes. Los JSON los marcan con `verified: false` y guardan los motivos.

**Verificación contra los reglamentos (25-11-2026, #427 R2).** Los reglamentos oficiales de 2026 de casi todas las ligas no se pudieron leer (están en sitios dinámicos o en documentos no publicados). Solo el LCK tiene reglamento oficial accesible, y es el de 2025. Solo First Stand pasa a `verified: true` (27-11, #427); MSI y Worlds siguen en `false` por los puntos que se indican.

| Competición | Regla confirmada | Fuente | Qué cambió |
| --- | --- | --- | --- |
| LCK | Orden: victorias, diferencia de sets, enfrentamiento directo; si sigue el empate, el reglamento juega **un solo game** (Bo1). Reglamento de 2025, no el de 2026 | [Reglamento LCK 2025, §2.8](https://cdn.sanity.io/files/dsfx7636/news/9636bd54a1e986ee7f617fad68a680c5cee2d4d4.docx) | `lck.json`: se codifica el orden y se quita el sorteo final. **El usuario decidió (25-11) mantener el Bo3** en lugar del Bo1 del reglamento (`tiebreakerBestOf` 3) |
| LCK Cup | Super Week en Bo5, con 2 puntos de grupo. El resto se juega en Bo3 y vale un punto. Directos a playoffs: 1.º y 2.º del grupo ganador y 1.º del perdedor | [Formato LCK 2026](https://lolesports.com/ko-KR/news/2026-lck-format-explainer) | Implementado en #535. R1 compara los cinco Bo5 con la Week 3 del snapshot. El juego siembra los cruces y usa un sorteo si los grupos igualan en puntos. El play-in sigue los cruces observados. |
| LCP | Swiss de split 3: Bo3 y Bo5 en la tercera victoria o derrota; seeding Bo5; clasifican los 2 primeros de playoffs y el líder de puntos (desempate: playoffs, luego Swiss) | [LCP split 3](https://lolesports.com/en-SG/news/lcp-2026-split-3-everything-you-need-to-know) | Ya coincidía. Se anota que el tercer cupo de Worlds es por puntos y se aproxima con el tercero de playoffs |
| MSI | 11 equipos en el play-in (2 de LCK, LCS, LCP, LEC y LPL; 1 de CBLOL), play-in Bo5 de 4 en doble eliminación, cuadro de 8. Los byes dependen de First Stand | [MSI y Worlds](https://lolesports.com/en-US/news/msi-and-worlds-updates) | Ya coincidía. El motivo ahora dice qué falta (sembrado, quién salta el play-in) |
| Worlds | 19 equipos (3 de LCK, LCS, LCP, LEC y LPL; 2 de CBLOL; campeón de MSI y una plaza de la región subcampeona) y play-in Bo5 de 4 | [MSI y Worlds](https://lolesports.com/en-US/news/msi-and-worlds-updates) | Ya coincidía (4/4/3/3/3/2). Faltan los Bo del Swiss y de los cuartos, el sembrado y los desempates |
| First Stand | Dos grupos de doble eliminación y Bo5 en todo | [Cobertura de Dot Esports](https://dotesports.com/league-of-legends/news/league-of-legends-esports-first-stand-2026-format-changes-first-selection) (secundaria) | Motivo más concreto |
| LEC | Tras igualar en victorias, enfrentamiento directo, puestos de splits anteriores, fuerza de victoria, tiempo de victoria y sorteo | [Bo3.gg](https://bo3.gg/lol/news/riot-games-changed-the-rules-of-the-lec-summer-split-right-in-the-middle-of-the-season) (secundaria, 2025) | Implementado en #535. Se usan las tablas de fase regular, de la más reciente a la más antigua. La fuerza suma las series ganadas por los rivales vencidos. El tiempo suma los segundos de los mapas ganados en series ganadas y se omite si faltan duraciones. En un corte, si los criterios dejan un empate, se juega Bo3 antes del sorteo. |
| First Stand | Dos grupos GSL de 4 (misma región nunca junta; grupo A: LPL1, LEC1, LCP1, LCK2; B: LCK1, LCS1, CBLOL1, LPL2), Bo5 en todo y semifinales cruzadas (A1–B2, B1–A2) y final. **Verificado** | [Wikipedia](https://en.wikipedia.org/wiki/2026_First_Stand_Tournament), [lolesports](https://lolesports.com/en-US/news/msi-and-worlds-updates) | `first-stand.json` pasa a `verified: true`. El reparto en grupos es un sorteo real y aquí va fijo por región. El GSL no tiene desempates |
| MSI (#427) | Play-in GSL de 4 en Bo5 (2º de LCK, LCS, LCP y LEC) y cuadro de 8 en doble eliminación Bo5 con gran final Bo5; entran directos los primeros de las seis regiones y el segundo de la región mejor clasificada en First Stand | [lolesports](https://lolesports.com/en-US/news/msi-and-worlds-updates), [Wikipedia](https://en.wikipedia.org/wiki/2026_Mid-Season_Invitational) | Estructura ya coincidía; sigue `verified: false`: la región que salta el play-in está fijada en LPL en vez de leerse de First Stand, el cuadro real sale de un sorteo por cuatro niveles (1–4, 2–3, misma región en lados opuestos) y el juego usa cuadro fijo por sembrado; no hay desempates ni reset publicados |
| Worlds (#427) | Play-in de 4 en doble eliminación Bo5 con sorteo libre (pasa 1); Swiss de 16, 5 rondas a 3 victorias o derrotas (Bo1; Bo3 si clasifica o elimina), ronda 1 por bombos (1–4 y 2–3) sin misma región, sin revanchas; eliminatoria Bo5 | [Primer de lolesports](https://lolesports.com/en-US/news/worlds-2026-primer) | Estructura ya coincidía; sigue `verified: false`: los desempates del Swiss no están publicados y los cuartos son un sorteo (3-0 contra 3-2, el resto al azar) que el juego sustituye por cuadro fijo por puesto del Swiss |
| LPL, LCS, CBLOL | Reglamentos oficiales de 2026 pendientes | — | Se conservan los criterios provisionales. |

Los detalles de cálculo de LEC y el desempate entre grupos de la LCK Cup quedan provisionales hasta confirmarlos en el reglamento.

**Calendario.** Con el tope de 4 series diarias por competición, cada fase empieza en su semana real de 2026. El test C3 exige una diferencia de 7 días como máximo entre el primer día de cada fase y el real. Los mayores desvíos medidos son 6 días en LCK, 6 en LPL, 4 en LEC, 2 en LCP, 4 en LCS y 4 en CBLOL.

Volumen de un año real: unas **2.400 partidas** de liga en el snapshot, más unas 200 internacionales. El test de calibración simula del orden de miles de partidas en unos 5 s (sin la IA de draft), así que un año entero debería caber en menos de un minuto; el entregable 11 lo mide.

## 4. Entregables (un issue por fila · milestone «Fase 4 — Competición»)

| Orden | Entregable | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | Contratos `competition`: esquema de formatos, comandos, hechos y errores ES/EN | `type:task`, `area:core` | V2, V7 y tests de esquema |
| 2 | Round robin, grupos y sorteo de prioridad | `type:task`, `area:competition` | RR1–RR4, G1–G3 |
| 3 | Clasificación y desempates con explicación | `type:task`, `area:competition` | D1–D7 |
| 4 | Swiss propio | `type:task`, `area:competition` | S1–S8 |
| 5 | Eliminatoria simple y doble | `type:task`, `area:competition` | B1–B6 |
| 6 | Encadenado de fases, sembrado y plazas internacionales | `type:task`, `area:competition` | Q1–Q5, V3–V5 |
| 7 | Calendario de la temporada | `type:task`, `area:competition` | C1–C4 |
| 8 | Formatos reales de las seis ligas, adaptados a sus equipos, y comprobación con el snapshot | `type:task`, `area:content` | V1, R1, R3, C3 |
| 9 | First Stand, MSI y Worlds 2026: el pipeline trae sus torneos de Leaguepedia, y sus formatos | `type:task`, `area:data-pipeline` | V1, R1, R2, Q4 |
| 10 | Temporada en el despachador: crear, jugar día a día con el mismo motor y consultas (#428) | `type:task`, `area:competition` | P2–P4, P6, V6 |
| 11 | Golden y presupuesto de un año IA contra IA | `type:test`, `area:competition` | P1, P5 |

2–5 van en paralelo tras 1; 6 depende de 2–5; 7 de 6; 8 y 9 de 1 (los datos) y de 6 (la validación cruzada); 10 de 6 y 7; 11 cierra el plan.

## 5. Decisiones del usuario (24-11-2026)

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Sección «Competición» y modo Torneo | Plan aparte dentro de la Fase 4, no en este |
| 2 | Empate en un corte (clasificar o quedar fuera) | Serie de desempate con Bo configurable por formato (Bo1, Bo3 o Bo5); **Bo3 por defecto** en los personalizados y el del reglamento en los reales. Fuera de los cortes, criterios y después sorteo |
| 3 | Elección de rival en playoffs (LCK, LPL) | **No.** Cuadro fijo por sembrado. En MSI y Worlds lo sustituyen los sorteos reales ([§6](#6-sorteos-reales-de-los-internacionales-27-11-2026), decisión del usuario del 27-11) |
| 4 | Formato personalizado que no cabe en el calendario | Más series por día, hasta 4 en total. Si aún no cabe, se rechaza al crear la carrera con una sugerencia para quitar una vuelta o reducir el número de equipos. La temporada nunca se alarga |
| 5 | Presupuesto de un año IA contra IA | ≤ 60 s en el Arch del usuario; en el CI, un split con un límite proporcional |
| 6 | Formatos internacionales | El pipeline trae sus páginas de Leaguepedia y se comprueban como las ligas |
| 7 | Invitados de un solo split | Cada formato se adapta ahora a los equipos de su liga; los invitados de segunda división llegan en la Fase 6 |
| 8 | Prioridad del game 1 | El mejor sembrado en eliminatorias; sorteo en liga y Swiss |

## 6. Sorteos reales de los internacionales (27-11-2026)

**Decisión del usuario (27-11):** MSI y Worlds simulan sus **sorteos reales** en lugar del cuadro fijo por sembrado. La decisión 3 sigue para las ligas (sin elección de rival y cuadro fijo). Fuentes de las reglas: [primer de Worlds 2026](https://lolesports.com/en-US/news/worlds-2026-primer) y [MSI y Worlds](https://lolesports.com/en-US/news/msi-and-worlds-updates), resumidas en #620.

| Fase | Sorteo real | Restricciones |
| --- | --- | --- |
| MSI, cuadro de 8 | Cuatro niveles de 2 equipos; nivel 1 contra 4 y 2 contra 3 | Misma región en mitades opuestas del cuadro |
| Worlds, play-in de 4 | Sorteo libre | Ninguna |
| Worlds, cuartos | Los 3-0 contra los 3-2; el resto, al azar | Sin revancha del Swiss |
| First Stand, grupos | Bombos con el sorteo de grupos actual | Misma región nunca en el mismo grupo |

Entregables: [#626](https://github.com/nbfrodri/riftlegends/issues/626) (núcleo), [#627](https://github.com/nbfrodri/riftlegends/issues/627) (formatos y pipeline) [#628](https://github.com/nbfrodri/riftlegends/issues/628) (hub) y [#631](https://github.com/nbfrodri/riftlegends/issues/631) (grupos de First Stand).

### Lista de tests

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| SO1 | Misma semilla, mismo sorteo; con otra semilla puede cambiar | Propiedad con fast-check sobre semillas |
| SO2 | El sorteo usa su propio ámbito RNG (`stageDraw`): no mueve ningún otro flujo (Swiss, desempates, prioridad, calendario) | Una temporada sin sorteo de cuadro da los mismos hechos que antes, salvo `SIM_VERSION` |
| SO3 | Cada equipo de un nivel de `meet` juega contra uno del nivel que le toca; los que sobran se cruzan al azar | MSI 1–4 y 2–3; Worlds: los dos 3-0 contra dos 3-2 y el 3-2 sobrante contra un 3-1 |
| SO4 | `regionHalf`: dos equipos de la misma región caen en mitades opuestas del cuadro | MSI con LPL1 y LPL2. Tres equipos de una región en un cuadro de 4: se relaja |
| SO5 | `region`: dos equipos de la misma región no se cruzan en la primera ronda | |
| SO6 | `rematch`: dos equipos que ya jugaron en otra fase de la misma competición no se cruzan en la primera ronda | Worlds: rivales del Swiss nunca en cuartos si hay otro sorteo posible |
| SO7 | Sorteo imposible: se quitan las restricciones en el orden de `avoid` y el hecho las lista en `relaxed`. Los niveles y `meet` nunca se relajan | Caso construido: un 3-0 que ya jugó contra los tres 3-2 |
| SO8 | Propiedad: con cualquier resultado previo siempre hay sorteo y cada equipo aparece una sola vez | Cuadros de 4 y 8; doble y simple eliminación |
| SO9 | El sorteo solo reordena el sembrado: `bracket.ts` no cambia. En cada cruce, el mejor nivel (a igual nivel, el mejor puesto de origen) es el mejor sembrado y tiene la prioridad del game 1 | Cruce de dos 3-1 |
| SO10 | Sin sorteo de cuadro en el formato, el cuadro fijo por sembrado de siempre | Ligas y torneos personalizados que no lo activan |
| SO11 | Validación: los niveles cubren cada puesto de 1 a `size` una vez; `meet` usa niveles que existen y el primero no es mayor que el segundo; solo en eliminatorias de tamaño potencia de dos. Si no, `invalid-format` con la ruta | Niveles que se solapan; `meet` repetido |
| SO12 | Un torneo creado desde el preset de MSI o Worlds hereda el sorteo, también con plazas editadas | `tournament.create` |
| SO13 | R1 del pipeline acepta el cuadro real de 2026 si cumple niveles y restricciones, en vez de exigir el cruce por sembrado | Un cruce real que rompe las reglas hace fallar R1 |
| SO14 | Hecho `competition.drawn` (fase, nivel de cada equipo, cruces y `relaxed`) el día en que termina la última fase de la que depende, antes de su primera serie | Consultar una serie ya jugada (`series.summary` con `series`) da el mismo detalle |
| SO15 | El hub muestra el sorteo antes de la primera serie: cruces, nivel de cada equipo y, si se relajó algo, el motivo en palabras. El lector lo lee como frases («Cuartos: Gen.G, 3-0, contra Team Liquid, 3-2») | ES y EN, sin «·» |
| SO16 | Play-in de Worlds: un solo nivel de 4 y sin `meet`, emparejamiento libre | |
| SO17 | First Stand: los grupos salen del sorteo por bombos que ya existe (`pots`, `avoidSameLeague`); misma semilla, mismos grupos y sin dos equipos de la misma región en un grupo | R1 acepta los grupos reales de 2026 |

### Diseño

**Formato.** `draw` de la fase pasa a ser una de dos formas:

| Forma | Uso | Campos |
| --- | --- | --- |
| Bombos (la de hoy) | Grupos y ronda 1 del Swiss | `pots`, `avoidSameLeague` |
| Cuadro (nueva) | `singleElim` y `doubleElim` | `tiers`: puestos de la lista de entrada por nivel. `meet`: parejas de niveles que se cruzan. `avoid`: restricciones en el orden en que se relajan (`regionHalf`, `region`, `rematch`) |

```jsonc
// MSI, cuadro
"draw": { "tiers": [[1, 2], [3, 4], [5, 6], [7, 8]], "meet": [[1, 4], [2, 3]], "avoid": ["regionHalf"] }
// Worlds, play-in
"draw": { "tiers": [[1, 2, 3, 4]], "meet": [], "avoid": [] }
// Worlds, cuartos (la entrada es el Swiss del 1 al 8: puestos 1-2 son 3-0, 3-5 son 3-1 y 6-8 son 3-2)
"draw": { "tiers": [[1, 2], [3, 4, 5], [6, 7, 8]], "meet": [[1, 3]], "avoid": ["rematch"] }
```

Los niveles usan puestos y no balances: con 16 equipos a 3-3 los balances de los 8 que pasan son siempre 2, 3 y 3, y un torneo personalizado puede declarar los suyos.

**Cómo se sortea** (`bracket-draw.ts`, llamado desde `resolveStage` en lugar de `seedStage`):

1. Se barajan los equipos con el flujo `stageDraw`.
2. Se forman los cruces de `meet`; los sobrantes se cruzan entre sí.
3. Los cruces se colocan en los huecos de la primera ronda (1-8, 4-5, 2-7, 3-6), que fijan las mitades.
4. Una búsqueda con vuelta atrás exige `avoid`, como el Swiss. Si no hay solución, quita la primera restricción de la lista y repite; `relaxed` guarda lo que el resultado rompe.
5. En cada cruce, el mejor nivel toma el mejor sembrado del hueco. Dentro de cada subcuadro, la mitad con el mejor equipo va primero: los cruces y las mitades no cambian y el mejor nivel conserva la prioridad del game 1 en las rondas siguientes. La lista sembrada pasa al cuadro de siempre.
6. Validación (SO11): solo `singleElim` o `doubleElim` sin `lowerSeeds`, de 2, 4, 8, 16 o 32 equipos; en `meet`, cada nivel una vez y el primero con como mucho tantos equipos como el segundo (o un número par si es el mismo nivel).

**Efectos.**

| Tema | Efecto |
| --- | --- |
| RNG | Ámbito nuevo `stageDraw = 10` en `SCOPES`, con ids (competición, temporada, fase). Los demás flujos no cambian (SO2) |
| `SIM_VERSION` | No sube en #626: ningún formato tiene aún sorteo de cuadro, así que los hechos no cambian. Sube en #627, al añadir el sorteo a MSI y Worlds: su cuadro cambia para la misma semilla y aparece `competition.drawn` |
| Contenido | Los formatos reales cambian en #627. Una temporada empezada no cambia, porque copia sus formatos en el hecho que la crea (P4) |
| Goldens | Los de draft y partida no cambian. El golden del año (#429) se genera después de #626 o se regenera en su PR |
| #428 | Sin cambios de reglas: el sorteo vive en la resolución de la fase, que ya usa el dispatcher |
| Repetir una serie (#481) | Sin cambio: el registro guarda el cruce y la semilla de la serie |
| Hub (#628) | El sorteo se ve en el cuadro de la fase desde que se conocen sus equipos, con el nivel de cada uno, y en una línea por cruce para el lector |

### Decisiones del usuario (27-11-2026)

Aprobadas por el usuario con el PR #629.

| Tema | Decisión |
| --- | --- |
| Grupos de First Stand | Sorteo por bombos con `avoidSameLeague` (#631), en vez del reparto fijo por región |
| Procedimiento | Resultado al azar entre los sorteos válidos, no la extracción equipo a equipo de la ceremonia |
| Torneos personalizados | Solo los presets heredan el sorteo; el editor no lo ofrece por ahora |
| Cuartos de Worlds | Sin restricción de región; solo sin revancha del Swiss. Mitades al azar |
| Niveles del MSI | Siguen el orden de las plazas del formato (LCK1 y LPL1 en el nivel 1, y así hasta LPL2 y el ganador del play-in) hasta que se publique el reglamento de 2026 |
