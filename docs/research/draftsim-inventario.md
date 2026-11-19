# Inventario de DraftSim → Rift Legends

Qué funciones de DraftSim se mantienen, cuáles se adaptan y cuáles se descartan, y en qué plan entra cada una. No se reutiliza código: es la fuente de **funcionalidades e ideas** para escribir los planes específicos. Revisado el 19-11-2026 sobre `~/Projects/draftsim` (v1.17.x: `README.es.md`, `docs/systems.es.md`, `propuestas-profundidad.md`, `season-realism.md`, `tournament-mode.md`, `title-playground.md`, `persistence-and-recovery.md` y los componentes).

**Leyenda:** ✅ mantener · 🔁 adaptar (cambia por ser juego y no simulador) · ⏸ más adelante · ❌ descartar.

## Principios que se heredan

| Principio de DraftSim | En Rift Legends |
| --- | --- |
| Núcleo de funciones puras, determinista con semilla | ✅ Ya es regla del núcleo (ADR 0001) |
| "Palancas neutrales por defecto": sin configurar no alteran nada | ✅ Útil para la IA y las estrategias; facilita los golden tests |
| Sesgos combinados en **un único punto** (`starRatingBias`) antes de la timeline, sin doble conteo | ✅ Regla de diseño del plan 08: un solo punto de combinación con desglose explicable |
| Récords agregados por identidad de equipo y por `Player.id` estable, nunca por lado | ✅ Identidades estables desde el plan 04 |
| Realismo **opt-in** con flags | 🔁 En un juego, forma, desarrollo y fichajes son sistemas siempre activos; la varianza y las "mareas regionales" pasan a opciones del Sandbox |
| Nombres reales, reglas abstractas (sin visados, salary cap ni scrims) | ✅ Se mantiene la abstracción; Rift Legends añade presupuesto y contratos |

## Draft e IA de draft → planes 06, 07 y 09

| Función | Estado | Notas |
| --- | --- | --- |
| Fases de pick y ban, lados, fearless, series Bo1/Bo3/Bo5 y elección de lado del perdedor | ✅ | Plan 06 |
| IA por **ensemble de scoring**: metaTier, synergy, archetypeSynergy, damageBalance, playerComfort, laneMatchup, identity, crossGameCounter, lookahead, targetBan y threatBan | ✅ | Plan 07; cada componente aparece en el desglose |
| Muestreo top-N con temperatura; dificultad = lookahead (0/1/2-ply) + temperatura | ✅ | La dificultad es ruido derivado del PRNG |
| Identidad de composición (Wombo, Pick, Dive…; 11 perfiles) | ✅ | Contenido como datos (plan 10) |
| Draft consciente del lado (azul: flex y meta; rojo: matchup y R5 de counter) | ✅ | |
| Contexto de serie (eliminación, match point, picks fearless previos, identidad rival) | ✅ | |
| Meta de torneo en vivo (WR observado con shrinkage bayesiano) | ✅ | Plan 18 |
| Scouting del roster enemigo (ban de mains, negar comfort) | 🔁 | Solo con lo que el jugador **sabe** (información imperfecta, plan 19) |
| Pocket picks | ✅ | |
| **Personalidades**: balanced, meta-slave, comfort-first, counter-picker y cheese | ✅ | Vectores de pesos por equipo y coach |
| Coaches con rating 1–5 → dificultad, adaptabilidad y motivación | ✅ | Plan 16 (staff) |
| Panel de razonamiento de la IA e historial de razonamientos | ✅ | Pilar 2: alimenta la "Lectura de la IA" de Caja |
| Política neuronal (rama opcional) | ❌ | Fuera de alcance |
| Arnés de calibración (correlación fuerza ↔ win-rate) | ✅ | Tests Monte Carlo de balance (plan 05) |
| PvP local (jugador contra jugador) | ⏸ | El usuario lo descartó por ahora |
| IA contra IA | ✅ | Sandbox (plan 24) y simulación del resto de partidos |

## Simulación de partida → planes 08 y 23

| Función | Estado | Notas |
| --- | --- | --- |
| Timeline por fases (laning, objetivos, peleas, cierre) con unos 30 tipos de evento (dragones, grubs, heraldo, Atakhan, alma, barón, elder, ace, backdoor…) | ✅ | Plan 08; los eventos son hechos |
| KDA y oro por evento; probabilidad de victoria en el tiempo (sparkline) | ✅ | |
| Resolución de peleas con daño y EHP por builds, power spikes y escalado tardío | ✅ | Datos de builds como contenido |
| Multiplicadores de identidad (Wombo contra sin disengage, etc.) | ✅ | |
| **War Room**: 16 palancas de estrategia (plan, mapa y recursos, asignación de líneas) | ✅ | IDEA §5 "estrategia de partida"; neutras por defecto |
| La IA elige y **adapta su estrategia** entre partidas de una serie | ✅ | |
| Pivote estratégico hacia el minuto 20 | ✅ | |
| Recap: MVP, KDA por jugador, swing de probabilidad, notas 1–10 | ✅ | Las notas alimentan forma, fichajes y premios |
| Replay de la partida con eventos clave, daño y pentakills | ✅ | Timeline (fase 2) y minimapa (fase 9, plan 23) |
| Duración acotada (24–50 min) según estrategia | ✅ | |

## Competición y temporada → planes 12 y 14

| Función | Estado | Notas |
| --- | --- | --- |
| Seis ligas (LCK, LPL, LEC, LCS, CBLOL, LCP) de 10 equipos | ✅ | Ligas menores en la fase 10 |
| Calendario anual: Winter → First Stand → Spring → MSI → Summer → Worlds | ✅ | Con ventanas de fichajes entre fases |
| Global Cup cuatrienal | ⏸ | Opcional; ficticio |
| Formatos: round-robin (ida y vuelta), grupos, Swiss con Buchholz, doble eliminación, triple eliminación, stepladder y gran final con reset | ✅ | Plan 12; Swiss propio con restricciones de región |
| Byes por seed, play-in de First Stand y Worlds, insignias "directo a playoffs" | ✅ | |
| Controles de simulación: jornada, fase regular y fase completa | ✅ | Pilar 5, respeto por el tiempo del jugador |
| Simular N años con ETA y feed en vivo (bulk years) | ✅ | Sandbox y avance rápido; en un worker |
| Modo Torneo suelto con configuración por partido y seeding | ✅ | Modo Torneo (IDEA §6) |
| Torneos reproducibles y compartibles por semilla (`TOUR1:`) | ⏸ | Encaja con el determinismo; más adelante |
| Clasificación en vivo y placements por fase | ✅ | Proyecciones (plan 13) |

## Plantillas, mercado y jugadores → planes 16, 17 y 21

| Función | Estado | Notas |
| --- | --- | --- |
| `Player.id` estable que sobrevive a fichajes y años | ✅ | Identidad de dominio |
| Tiers de jugador, pools de campeones (buenos y malos), flex picks | ✅ | |
| Fuerza de equipo de 1 a 5 en medias estrellas | 🔁 | Se revisa: en un juego quizá se muestre con incertidumbre (scouting) |
| Forma (racha caliente o fría con regresión a la media) | ✅ | Siempre activa |
| Desarrollo y envejecimiento; deriva del pool de campeones entre splits | ✅ | |
| Ventanas de fichajes; valor = tier + rendimiento + encaje del pool en el meta | 🔁 | Se añaden **presupuesto, contratos y sueldos** (IDEA §8) |
| Límite de movimientos internacionales para estrellas | ✅ | |
| **Player agency**: exigir salida, subida desde academia o salida de academia | ✅ | Se integra con moral y vestuario (plan 21) |
| Academia, agentes libres, retiradas y vacantes | ✅ | |
| Rookies y generación de nombres por línea | 🔁 | **Regens** ficticios con semilla (plan 16) |
| Química por pares de jugadores (dúo de bot, misma región) | ✅ | Plan 21 |
| Jugadores **SS** (élite mundial por rol) y SS Race en directo | ⏸ | Interesante como capa narrativa; se decide en el plan 22 |
| Propuestas de intercambio del equipo del usuario | 🔁 | Negociación con coste y respuesta de la IA |

## Meta y parches → plan 18

| Función | Estado | Notas |
| --- | --- | --- |
| Meta base: tiers por línea (S+ a D), más de 340 sinergias, más de 250 counters y 11 identidades | ✅ | Contenido propio como datos (plan 10), con esquema |
| Editor de meta y librería de sinergias y counters; export `META1:` | 🔁 | Editor en el Sandbox (plan 24) |
| Meta aleatorio con proporciones realistas | ✅ | Base de los parches generados |
| Patch shift entre fases y meta vivo dentro de un evento | ✅ | Parches entre splits con notas generadas (IDEA §7) |
| Fallback de tier fuera de posición | ✅ | |

## Historial, premios y narrativa → planes 13, 22 y 27

| Función | Estado | Notas |
| --- | --- | --- |
| Hall of Seasons: campeones, placements completos, All-Pro, carreras, log de fichajes, rosters por fase, meta inicial y final, matrices H2H, dinastías y rivalidades | ✅ | Plan 27; todo como proyección de hechos |
| Placements por split y región, e internacionales con eliminados de play-in | ✅ | |
| Tablas de carrera: kills, MVPs, títulos regionales e internacionales por jugador | ✅ | |
| Compañeros más frecuentes y rosters históricos por evento | ✅ | |
| **Title Playground**: títulos por equipo o jugador, filtros por región, competición y años, línea acumulada y tarta | ✅ | Plan 27 |
| Estadísticas por evento: ranking por rol, most picked y banned, presencia | ✅ | |
| Perfiles de jugador y equipo con tarjetas al pasar el ratón | ✅ | |
| Premios: All-Pro, MVP de split, Rookie of the Year y notas de temporada por equipo | ✅ | Plan 22 |
| Power rankings y "season story" | ✅ | Base de la narrativa emergente (plan 22) |
| Feed de noticias de movimientos | ✅ | Noticias y titulares (plan 22) |
| Export XLSX del historial | ⏸ | |

## Partidas guardadas → plan 28

| Función | Estado | Notas |
| --- | --- | --- |
| Varias "realities" con nombre | 🔁 | **Carreras ilimitadas**, una por fichero SQLite, cada una con su equipo |
| Backups y restauración desde la app | ✅ | Rotativos y automáticos |
| Recuperación ante fallos, cola de escritura, atomicidad y diagnósticos | ✅ | Transacción única por jornada (ADR 0001) |
| Exportar e importar una reality (`.draftsim-reality.json`) | 🔁 | **Fichero de carrera** exportable e importable |
| Códigos para compartir (`REAL1:`) y galería comunitaria | ⏸ | El usuario lo dejó para más adelante |
| Vista en navegador con otro almacenamiento | ❌ | Es app de escritorio |

## Lo que Rift Legends añade (no está en DraftSim)

Rol del jugador con objetivos de directiva y consecuencias, información imperfecta y scouting, presupuesto y contratos, entrenamiento con coste de oportunidad, moral y vestuario, prensa, **autoguardado** y **modo ironman**, presentación broadcast y minimapa animado. Ver IDEA.md §2 y §8.
