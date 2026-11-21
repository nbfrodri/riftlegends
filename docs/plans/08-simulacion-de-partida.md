# Plan 08 — Simulación de partida v1 y timeline

- **Estado:** aprobado (21-11-2026). Redactado por Claude con las decisiones del usuario (al final) y el [estudio de DraftSim](../research/draftsim-simulacion.md).
- **Fase:** 2 · Draft rápido completo ([plan general](00-plan-general.md)).
- **Objetivo:** simular un game a partir del draft y de los jugadores. **El ganador sale de lo que pasa en la partida**: nadie decide el resultado de antemano para después contarlo. Todo es determinista y explicable, y sustituye al comando provisional `game.finish`.

## Contexto

- **DraftSim** fijaba la duración antes de jugar y decidía el ganador con una tirada final. Aquí la partida termina cuando cae un nexo.
- **Planes 05, 06 y 07:** RNG por ámbito (`match` = 2), enteros y punto fijo, la serie y el draft ya resueltos (picks y roles).
- **Plan 10:** amplía el contenido con los atributos que pide este plan. Los tests usan el fixture de la IA, ampliado.
- **Minimapa (Fase 9, plan 23):** reproducirá estos mismos hechos, sin volver a simular. Por eso cada evento lleva desde ya su zona del mapa y su segundo. El minimapa interpola el movimiento entre eventos; no hace falta simular posiciones.
- **Fase 7 (plan 21):** moral y química completas.
- **Atributos visibles:** los atributos de cada jugador se mostrarán en su perfil y en el mercado (plan 15) y al pasar el ratón en el draft (plan 09). De los rivales se verá lo que permita el scouting (plan 19). Este plan los define y los usa; la UI llega en esos planes.

## Lista de tests

### Estructura

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| M1 | La misma semilla y el mismo draft dan la misma partida, byte a byte | Golden por semilla |
| M2 | La partida avanza minuto a minuto y termina **solo** cuando cae un nexo | Ningún tope fijo de duración; una salvaguarda en el minuto 70 falla el test |
| M3 | Los hechos respetan las reglas del mapa y cada evento lleva una zona coherente con su tipo (un dragón, en su foso; una torre, en su línea) | No cae un inhibidor sin sus torres, ni un nexo sin un inhibidor; los objetivos respetan su reaparición |
| M4 | Oro, kills, torres y objetivos del estado cuadran con la suma de los hechos | Propiedad sobre miles de partidas |
| M5 | Las estadísticas por jugador salen de los hechos | Kills de un equipo = muertes del otro; participación ≤ 100 % |
| M6 | Cada disputa guarda sus causas con puntos | El «por qué ganó» cita las disputas que más cambiaron la probabilidad |

### Factores (cada uno, a igual resto, empuja en su sentido)

| # | Factor |
| --- | --- |
| F1 | Atributos por área (ver [Atributos de jugador](#atributos-de-jugador)); cada fase y cada disputa usan los suyos |
| F2 | Maestría del jugador con su campeón |
| F3 | Draft: meta, sinergias, counters de línea y fase de poder (un equipo de late gana más partidas largas) |
| F4 | Composición en peleas: daño AD/AP, frontline, engage y peel |
| F5 | Química del equipo y estrategia (3 palancas: ritmo, prioridad de objetivos y riesgo) |
| F6 | Lado azul: ventaja pequeña y configurable |
| F7 | Temple: en games decisivos (último game, eliminación, finales, internacionales) el temple bajo rinde menos y el alto más |
| F8 | Inercia: ganar el game anterior da confianza; perder dos seguidos puede hundir, según la resistencia mental |
| F9 | Experiencia: los veteranos sufren menos la presión en escenarios grandes |
| F10 | Constancia: el jugador irregular tiene más varianza, para bien y para mal |
| F11 | Shotcalling: un líder mejora las decisiones de objetivos y peleas |
| F12 | Adaptación: tras perder un game, el coach que mejor se adapta reduce la ventaja de lo que funcionó |
| F13 | Riesgo: un estilo arriesgado da más remontadas y más ventajas perdidas (throws) |

### Calibración (Monte Carlo, en el CI)

| # | Banda |
| --- | --- |
| K1 | Con una ventaja clara pero no aplastante, el favorito gana entre el 60 y el 75 % |
| K2 | Duración: mediana de 28 a 34 min, con el 90 % entre 22 y 45 |
| K3 | Kills por partida: mediana entre 15 y 30 |
| K4 | Remontadas: con 3.000 de oro en contra en el minuto 20, se gana entre el 15 y el 30 % |
| K5 | Lado azul con equipos iguales: entre el 50 y el 54 % |

## Diseño

### Cómo se juega un game

1. **Perfil:** antes de empezar, cada equipo tiene una fuerza por fase (temprana, media y tardía) y por tipo de disputa (línea, jungla, pelea, objetivo y asedio). Sale del draft, los atributos, la maestría y los factores mentales. Todo en punto fijo, con su desglose.
2. **Bucle por minuto.** En cada minuto se resuelven las disputas que tocan: líneas y jungla al principio; dragón, heraldo, barón y elder cuando aparecen; peleas y asedios en el juego medio y tardío.
3. **Disputa:** la probabilidad de ganarla sale del perfil de la fase, el estado (oro, objetivos, buffs) y el estilo de riesgo. Se calcula con una tabla entera de tipo logística, sin `exp`. La tirada usa un flujo propio `deriveSeed(seed, match, game, minuto, disputa)`, así que añadir una disputa no desplaza las demás.
4. **Estado:** cada resultado cambia oro, torres, objetivos, muertes y tiempos de reaparición. El oro pesa menos según avanza la partida (curva de contenido).
5. **Final:** cuando un equipo destruye el nexo, termina la partida. Duración, kills y estadísticas son consecuencias.

### Hechos

| Hecho | Campos principales |
| --- | --- |
| `match.started` | game, lados, perfil resumido por equipo |
| `match.event` | minuto y segundo, tipo (`kill`, `tower`, `dragon`, `herald`, `baron`, `elder`, `fight`, `inhibitor`, `nexus`…), lado, **zona del mapa** (línea, cuadrante de jungla, foso de dragón o barón, base), jugadores implicados y causas (`[{ key, points }]`) |
| `match.ended` | ganador, duración, estadísticas por jugador (K/D/A, oro, daño, participación y nota) y las 3 disputas que más pesaron |

Estadísticas (`stats.ts`) y «por qué ganó» (`explain.ts`), funciones puras sobre los hechos:

- **Oro:** kill y asistencia, a quien las hizo; el resto del lado (pasivo y objetivos) a partes iguales, y el resto entero al primer rol. La suma de los cinco = oro del lado.
- **Daño** (no está en los hechos, se estima): kill 1.500, asistencia 600, muerte 300, 150 por minuto, y 500 (ganadores) o 250 (perdedores) por cada lucha o asedio.
- **Participación:** (kills + asistencias) / kills del equipo, por 10.000; 0 sin kills.
- **Nota:** 60 + 6 por kill + 3 por asistencia − 5 por muerte + hasta 10 por participación, acotada a 0–100.
- **Decisivas:** de las disputas que ganó el ganador, las 3 con más `swing` = (10.000 − probabilidad) × peso del tipo. Pesos: lucha, barón y élder 1; asedio 0,7; dragón 0,6; inhibidor 0,5; heraldo y torre 0,4; kill y gank 0,3; línea 0,2; nexo 0. Empate: el evento más temprano.

`game.finish` desaparece: tras los roles, `match.play {}` juega el game entero y emite sus hechos y `game.finished`.

### Atributos de jugador

20 atributos de 0 a 100, en cinco áreas. Ampliados el 21-11 (#179).

| Área | Atributo (clave) | Qué decide |
| --- | --- | --- |
| Línea | Líneas (`lanes`) | Duelos y disputas de línea |
| Línea | Farming (`farming`) | Oro de línea por minuto, aunque no gane duelos |
| Línea | Gestión de oleadas (`waves`) | Presión de oleadas, splitpush y torres sin pelea |
| Mapa | Macro (`macro`) | Decisiones de objetivos y rotaciones |
| Mapa | Roaming (`roaming`) | Influencia de mid y support en otras líneas y en los ganks |
| Mapa | Visión (`vision`) | Picks y disputas de objetivos |
| Mapa | Anticipación (`anticipation`) | Leer el mapa y al jungla rival: esquivar ganks y contragankear |
| Mapa | Control de objetivos (`objectiveControl`) | Asegurar y robar dragones y barones |
| Pelea | Peleas en equipo (`teamfight`) | Peleas y asedios |
| Pelea | Mecánicas (`mechanics`) | Duelos, escaramuzas y ejecución |
| Pelea | Posicionamiento (`positioning`) | Morir menos en las peleas |
| Pelea | Agresividad (`aggression`) | Más kills a favor y en contra; más varianza (#172) |
| Mental | Temple (`composure`) | Games decisivos (F7) |
| Mental | Resistencia mental (`resilience`) | Rachas de derrotas (F8) |
| Mental | Experiencia (`experience`) | Presión en escenarios grandes (F9) |
| Mental | Constancia (`consistency`) | Varianza del jugador (F10) |
| Mental | Concentración (`focus`) | Aguante en partidas y series largas (#173) |
| Equipo | Shotcalling (`shotcalling`) | Decisiones de objetivos y peleas del líder (F11) |
| Equipo | Comunicación (`communication`) | Coordinación en peleas; suma a la química |
| Equipo | Versatilidad (`versatility`) | Menos penalización con campeones fuera del pool y en flex |

Con jugadores reales, los atributos se derivan de estadísticas por rol y liga (plan 11); los mentales se estiman y se pueden ajustar a mano.

### Contenido nuevo (para el plan 10)

- **Jugador:** los 20 atributos de la tabla siguiente, maestría por campeón y si es líder en partida.
- **Equipo:** química (por pares) y estrategia por defecto.
- **Campeón:** CC, movilidad y frontline.
- **Partida:** tiempos de objetivos, economía y constantes de balance como datos, no en el código.

### Dónde vive cada cosa

| Pieza | Ubicación |
| --- | --- |
| Perfil de equipo | `packages/core/match/profile/` |
| Bucle, estado y disputas | `packages/core/match/loop.ts`, `state.ts`, `contests/` |
| Capa mental y de serie | `packages/core/match/mental.ts` |
| Estadísticas y explicación | `packages/core/match/stats.ts`, `explain.ts` |
| Calibración | `packages/core/match/calibration.test.ts` |

## Troceado en issues (Tarea de plan · milestone «Fase 2 — Draft rápido completo»)

| Orden | Issue | Test que lo cierra |
| --- | --- | --- |
| 1 | Contratos de los hechos de partida y del contenido nuevo; fixture ampliado | Tests de esquema |
| 2 | Perfil de equipo por fase y disputa, con desglose | F1–F5 sobre el perfil |
| 3 | Estado y bucle por minuto: líneas y jungla | M1, M2 parcial |
| 4 | Objetivos, torres, inhibidores y nexo | M2, M3 |
| 5 | Peleas, asedios, riesgo, remontadas y throws | F13, K4 |
| 6 | Capa mental y de serie | F6–F12 |
| 7 | Estadísticas por jugador y explicación | M4–M6 |
| 8 | `match.play` en el dispatcher, calibración y golden | K1–K5, M1 |

2 tras 1; 3 tras 2; 4 y 5 tras 3 (en paralelo); 6 tras 2; 7 tras 4 y 5; 8 cierra el plan y sube `SIM_VERSION`.

## Riesgos

- **Calibración:** como el resultado no se fija, hay que ajustar las constantes hasta entrar en las bandas K1–K5. Son datos, y los tests K avisan si un cambio las rompe.
- **Snowball:** si la ventaja satura, la partida se vuelve predecible. Lo contrarrestan el peso decreciente del oro, la fase de poder y el riesgo, con causas visibles y sin «comeback bias» oculto.
- **Tiempo de CI:** la calibración simula miles de partidas. Se limita su número y la versión completa corre aparte.

## Decisiones del usuario (21-11-2026)

1. El ganador **sale de la partida**, no al revés.
2. Factores: draft y composición (con sinergias y counters), nivel y forma, química y estrategia, y lado.
3. Factores humanos en la v1: temple, inercia, experiencia y constancia.
4. Factores de juego en la v1: atributos por área, shotcalling, adaptación entre games y riesgo.
5. Partida por fases con eventos; el minimapa, en la Fase 9.
6. Varianza realista: el favorito gana un 60–75 %.
7. Implementa Claude, con subagentes de Claude (Sonnet, medium) para las partes independientes, porque Codex está cerca de su límite.
