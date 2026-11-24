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
| B6 | Cuadro fijo por sembrado, sin elección de rival; el mejor sembrado tiene la prioridad del game 1 (decisiones 3 y 8) | Cruce entre equipos con el mismo sembrado en grupos distintos: lo decide la clasificación de origen |

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
| C4 | Un formato personalizado más largo se ajusta con más series por día (como máximo 4 por día de partido) dentro de su ventana; la temporada nunca se alarga (decisión 4) | Si aún no cabe, `format-too-long` al crear la carrera, con un mensaje claro y una sugerencia (bajar el Bo, quitar una vuelta) |

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
- **Bloqueo:** el formato se copia en el hecho `season.created`. Solo se puede cambiar el de la temporada siguiente (V6, P4).

### Módulos del núcleo (`packages/core/competition/`)

| Módulo | Responsabilidad |
| --- | --- |
| `round-robin.ts` | Método del círculo: jornadas y descansos |
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
- **RNG:** dos ámbitos nuevos, `competition` (sorteos de Swiss, grupos y desempate final) y `schedule` (reparto en días), con id por competición, temporada, fase y ronda. Los ids de texto se convierten en el índice de la competición dentro de la temporada, no en un hash. `competition = 6` ya está en el registro (#420). La prioridad del game 1 en liga usa una semilla por serie (competición, temporada, fase, jornada y posición de la serie), sin depender de las demás series del día. El reparto en grupos no sortea nada: serpiente y, después, permutas entre grupos solo para separar regiones.

### Calendario

- El núcleo cuenta **días enteros desde el inicio de la temporada** (sin fechas reales). La UI pone el año y el mes.
- Cada fase tiene una **ventana** (semana de inicio, semanas y días de partido por semana). Con los formatos reales, las ventanas salen de `startsOn` y `endsOn` de cada torneo del snapshot.
- `calendar.ts` reparte las jornadas en los días de partido de la ventana, con 4 series por día como máximo. Si no caben, el formato se rechaza al crear la carrera; la temporada nunca se alarga (C4). Las series de eliminatoria quedan con equipos pendientes hasta que termina la serie que los alimenta (Q5).
- Los internacionales tienen su ventana; las ligas no programan series de un equipo clasificado durante ella (C2).

### Cuadros (`bracket.ts`, #423)

- `buildSingleElim` y `buildDoubleElim` devuelven la estructura (partidos que apuntan a un sembrado, al ganador o al perdedor de otro); `resolveBracket` pone los equipos según los resultados y calcula la prioridad del game 1 (mejor sembrado, con sus dos sembrados como explicación). `seedEntrants` ordena por sembrado y, a igualdad, por la clasificación de origen.
- **Byes:** el cuadro se completa hasta la potencia de dos; los sembrados que faltan dan el paso directo a sus rivales (con 6, pasan el 1 y el 2; con 10, del 1 al 6).
- **Caídas (decisión 24-11-2026):** `drop[r][m]` es la ronda inferior (desde 0) a la que cae el perdedor de la serie `m` de la ronda superior `r`; `null` = eliminado. `lowerSeeds[k]` es cuántos sembrados entran directos en la ronda inferior `k` (los peores en las primeras rondas); `size` cuenta todos los equipos y el cuadro superior usa los demás. Cada ronda inferior junta supervivientes, caídos y entrantes. Si hay grupos mezclados (o caídos de varias rondas), se cruzan el primero con el último (sin revanchas inmediatas); un solo grupo se empareja por orden. Con un número impar, el primero pasa sin jugar. Una ronda inferior sin partidos, un `drop` a una ronda que no existe o un cuadro inferior que no termina con un solo equipo es un formato inválido.
- Ejemplos de `drop`: 4 → `[[0,0],[1]]`; 8 → `[[0,0,0,0],[1,1],[3]]`; LCK, LCS Summer y CBLOL (6, los perdedores de la ronda 2 caen a rondas distintas) → `[[0,0],[1,2],[3]]`; LCP (6, la ronda 1 queda eliminada) → `[[null,null],[0,0],[1]]`; LEC Spring/Summer y LCS Spring (4 arriba, sembrados 5-6 abajo) → `[[0,0],[2]]` con `lowerSeeds [2,0,0]`; LPL Grand Finals (6 + 2 de Knight's Road) → `[[0,0],[1,1],[3]]` con `[2,0,0,0]`; LCK Road to MSI → `[[3]]` con `[2,1,1,0]`. Un test por cada uno comprueba que construye y termina con un campeón.
- **Final:** sin reset, el ganador de la final es el campeón; con `reset`, si gana el del cuadro inferior se juega una segunda final (`RS`), y si no, se omite.

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

**Resultado:** el modelo adoptado (`drop` por serie y `lowerSeeds`) cubre todas las filas salvo los play-in en escalera de LPL y LCK Cup, que no son cuadros: pasan a #424 como un tipo de fase aparte (los ganadores de la ronda 1 pasan directos al cuadro principal y los perdedores se cruzan con los ganadores de la 2).

Pendiente al verificar reglamentos: el cruce exacto en cada ronda inferior (primero con último o por orden) y quién cae adónde dentro de una ronda.

### Desempates

Cada competición tiene su **lista de criterios** (dato, no código). Por defecto, el modelo de Riot: series ganadas, diferencia de games, enfrentamiento directo y, si el empate toca un corte, serie de desempate (Bo3 por defecto, configurable a Bo1 o Bo5); si no, sorteo. El orden exacto de cada liga sale de su reglamento y se marca `verified` al comprobarlo.

### Ascensos y descensos

No se implementan aquí (plan 24), pero el esquema ya los cubre: la serie de promoción es una fase `SingleElim` de tamaño 2 cuyos equipos salen de dos `standing` de competiciones distintas (penúltimo de primera y subcampeón de segunda), y el ascenso directo es una plaza con regla `standing` hacia la temporada siguiente. No hace falta reservar campos nuevos.

### Formatos reales de 2026: de dónde salen

**El snapshot de Leaguepedia no trae las reglas del formato**, solo los torneos con fechas y las partidas. Por eso:

1. **Formatos curados a mano** en `packages/core/content/real/formats/<liga>.json`, escritos a partir de las páginas de Leaguepedia y los reglamentos oficiales, con su procedencia.
2. **Comprobación automática (R1):** un test del pipeline compara cada formato curado con el snapshot (equipos, series por fase, Bo por ronda deducido de las victorias máximas). Si Riot cambia el formato, el workflow semanal lo detecta.
3. **Internacionales:** el snapshot actual no los incluye. El pipeline se amplía para traer sus páginas de Leaguepedia (misma fuente y licencia) y se comprueban igual que las ligas (R1).

Inferido del snapshot (22-11-2026). Lo marcado con **(?)** hay que verificarlo en el reglamento.

| Liga | Fase | Lo que muestra el snapshot | Formato propuesto |
| --- | --- | --- | --- |
| LCK | Cup (ene–mar) | 10 equipos en 2 grupos; 25 series, cada equipo 5 contra el otro grupo | Grupos cruzados Bo3 (semana 3 en Bo5) → play-in (Bo3, Bo3, Bo5) → playoffs Bo5 (?) |
| LCK | Rounds 1-2 (abr–may) | 90 series, todas las parejas 2 veces | Doble round robin Bo3 |
| LCK | Road to MSI (jun) | 5 series Bo5 en 4 rondas | Doble eliminación de 4 (?) |
| LCK | Rounds 3-4 (jul–ago) | 40 series: 2 grupos de 5, doble vuelta | Grupos Legend/Rise según Rounds 1-2, Bo3 |
| LCK | Play-In y Playoffs (ago–sep) | 3 + 10 series Bo5 | Play-in Bo5 → doble eliminación de 6 Bo5 por sembrado (?) |
| LPL | Split 1 (ene–mar) | 14 equipos, 54 series Bo3 y un desempate; grupos | Estructura de grupos **(?)**; playoffs con play-in de 3 rondas y cuadro Bo5 |
| LPL | Split 2 (abr–jun) | Grupo de 8 a doble vuelta (56) y grupo de 6 a una vuelta (15) | Grupos por nivel Bo3 → play-in y cuadro Bo5 |
| LPL | Split 3 y Grand Finals (jul–sep) | 12 equipos: grupos de 8 y 4 a doble vuelta (68); Grand Finals con Knight's Road | Grupos Bo3 → Knight's Road y cuadro Bo5 (?) |
| LEC | Versus (ene–mar) | 12 equipos a una vuelta Bo1 (66); playoffs de 14 series | En el juego, 10 equipos a una vuelta Bo1 (R3) → doble eliminación (Bo3 en rondas 1-2, Bo5 después) (?) |
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
| 2 | Round robin, grupos y sorteo de prioridad | `type:task`, `area:competition` | RR1–RR4, G1–G3 |
| 3 | Clasificación y desempates con explicación | `type:task`, `area:competition` | D1–D7 |
| 4 | Swiss propio | `type:task`, `area:competition` | S1–S8 |
| 5 | Eliminatoria simple y doble | `type:task`, `area:competition` | B1–B6 |
| 6 | Encadenado de fases, sembrado y plazas internacionales | `type:task`, `area:competition` | Q1–Q5, V3–V5 |
| 7 | Calendario de la temporada | `type:task`, `area:competition` | C1–C4 |
| 8 | Formatos reales de las seis ligas, adaptados a sus equipos, y comprobación con el snapshot | `type:task`, `area:content` | V1, R1, R3, C3 |
| 9 | First Stand, MSI y Worlds 2026: el pipeline trae sus torneos de Leaguepedia, y sus formatos | `type:task`, `area:data-pipeline` | V1, R1, R2, Q4 |
| 10 | Temporada en el despachador: crear, jugar día a día con el mismo motor y consultas | `type:task`, `area:competition` | P2–P4, P6, V6 |
| 11 | Golden y presupuesto de un año IA contra IA | `type:test`, `area:competition` | P1, P5 |

2–5 van en paralelo tras 1; 6 depende de 2–5; 7 de 6; 8 y 9 de 1 (los datos) y de 6 (la validación cruzada); 10 de 6 y 7; 11 cierra el plan.

## 5. Decisiones del usuario (24-11-2026)

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Sección «Competición» y modo Torneo | Plan aparte dentro de la Fase 4, no en este |
| 2 | Empate en un corte (clasificar o quedar fuera) | Serie de desempate con Bo configurable por formato (Bo1, Bo3 o Bo5); **Bo3 por defecto** en los personalizados y el del reglamento en los reales. Fuera de los cortes, criterios y después sorteo |
| 3 | Elección de rival en playoffs (LCK, LPL) | **No.** Cuadro fijo por sembrado |
| 4 | Formato personalizado que no cabe en el calendario | Más series por día, hasta 4. Si aún no cabe, se rechaza al crear la carrera con un mensaje claro y una sugerencia (bajar el Bo, quitar una vuelta). La temporada nunca se alarga |
| 5 | Presupuesto de un año IA contra IA | ≤ 60 s en el Arch del usuario; en el CI, un split con un límite proporcional |
| 6 | Formatos internacionales | El pipeline trae sus páginas de Leaguepedia y se comprueban como las ligas |
| 7 | Invitados de un solo split | Cada formato se adapta ahora a los equipos de su liga; los invitados de segunda división llegan en la Fase 6 |
| 8 | Prioridad del game 1 | El mejor sembrado en eliminatorias; sorteo en liga y Swiss |
