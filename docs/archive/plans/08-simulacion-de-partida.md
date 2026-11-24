# Plan 08 — Simulación de partida v1 y timeline

- **Estado:** hecho (21-11-2026; PR #177, #178, #180–#184, #187 y el del #175). `match.play` sustituye a `game.finish`; `SIM_VERSION` 2. Redactado por Claude con las decisiones del usuario (al final) y el [estudio de DraftSim](../../research/draftsim-simulacion.md).
- **Fase:** 2 · Draft rápido completo ([plan general](../../plans/00-plan-general.md)).
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
2. **Forma del día:** una tirada por equipo y partida, con su propio flujo (minuto 0), que suma a todas las disputas. Sin ella, decenas de tiradas independientes hacen que el favorito gane siempre; la constancia la ensancha o estrecha (F10).
3. **Bucle por minuto.** En cada minuto se resuelven las disputas que tocan: líneas y jungla al principio; dragón, heraldo, barón y elder cuando aparecen; peleas y asedios en el juego medio y tardío.
4. **Disputa:** la probabilidad de ganarla sale del perfil de la fase, el estado (oro, objetivos, buffs) y el estilo de riesgo. Se calcula con una tabla entera de tipo logística, sin `exp`. La tirada usa un flujo propio `deriveSeed(seed, match, game, minuto, disputa)`, así que añadir una disputa no desplaza las demás.
5. **Estado:** cada resultado cambia oro, torres, objetivos, muertes y tiempos de reaparición. El oro pesa menos según avanza la partida (curva de contenido).
6. **Final:** cuando un equipo destruye el nexo, termina la partida. Duración, kills y estadísticas son consecuencias.

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

## Calibración (21-11-2026)

Medida con `calibration/calibration.test.ts`: dos equipos sintéticos medios, semillas fijas (1.000 partidas; 600 para K1) y la capa mental de un game 1.

| Banda | Objetivo | Resultado |
| --- | --- | --- |
| K1 favorito (+10 en todos los atributos) | 60–75 % | 72,2 % |
| K2 duración | mediana 28–34; 90 % entre 22 y 45 | 33 (25–40) |
| K3 kills | mediana 15–30 | 22 |
| K4 remontada con 3.000 de oro en contra al 20 | 15–30 % | 20,9 % |
| K5 lado azul con equipos iguales | 50–54 % | 52,7 % |

Constantes que más mueven las bandas: `EDGE_SCALE` (lo decisiva que es cada disputa), `FORM` (forma del día), `TAKE` y `PUSH_FROM` (ritmo de estructuras), `TEMPO_CHANCE` y `EXCHANGE_CHANCE` (peleas) y `rules.blueSide`.

`match.ended.decisive` apunta al evento por su índice entre los `match.event` del game: el handler no conoce las posiciones del registro.

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

## Ampliación 23-11: estadísticas por rol y composiciones (#326, #320)

### Lista de tests

| # | Comportamiento | Casos límite |
| --- | --- | --- |
| R1 | El rol, el arquetipo y los atributos cambian quién remata y quién asiste. | Duelo sin asistencia, gank que remata el laner, pelea con varias asistencias y bajas de ambos bandos. Autor y asistentes del mismo lado, sin duplicados ni autoasistencias. |
| R2 | El reparto de daño responde al rol, al arquetipo, al pico de poder y a los minutos jugados. Un apoyo mago supera a uno de utilidad a igual actuación. | Partida corta o sin bajas, cambio de fase y daño de equipo nulo. Daño individual suma el total del equipo, incluidos los restos. |
| R3 | Un apoyo con buena participación, asistencias, visión y pocas muertes puede ser MVP. Objetivos, presión y daño mejoran la nota de los roles correspondientes. | Mismo rendimiento relativo, misma nota en los cinco roles. Sin oportunidades, contribución neutra. Las muertes adicionales empeoran la nota. Límites de 0 y 100. |
| R4 | Con igual draft y semilla, la atribución y el reparto de daño (#326) conservan estado por minuto, ganador, duración, bajas y oro por lado, objetivos, estructuras y orden de eventos. | Comparar con la v2 con #320 y la nueva ventaja de oro desactivados, al excluir atribución individual. El último snapshot y `match.ended` cuadran en KDA y oro. |
| G1 | Cada jugador gana su propio oro (bajas, asistencias, farmeo, parte de objetivos y estructuras, pasivo). El oro del equipo es la **suma** de sus cinco jugadores en el estado, los snapshots y `match.ended`. | Partida sin bajas, baja sin asistentes, oro de línea ganado por el rival, objetivo sin torres, restos por mayores residuos con desempate `ROLES`, oro nunca negativo y log antiguo sin `playerGold`. |
| G2 | La ventaja de oro usa la diferencia **relativa**. A igual diferencia absoluta pesa más con menos oro total (más temprano). Es antisimétrica, monótona y cero con oro igual. | Suma total cero, un solo jugador con todo el oro, diferencia máxima, intercambio de lados y redondeo mitad hacia par. Acotada por el tope en puntos. |
| G3 | El oro por encima del **build completo** de un jugador aporta casi nada a la ventaja. Con todos saturados, la ventaja de oro tiende a cero y deciden objetivos, definitivas y ejecución. | Jugador justo en el umbral y 1 por encima, un equipo saturado y otro no, umbral y desbordamiento cambiados en las reglas, y reparto desigual entre roles (el carry satura antes). |
| V1 | Con atributos iguales, composiciones tempranas, medias y tardías ganan cada una **45–55 %** frente a las otras. Las tempranas ganan partidas más cortas y las tardías, más largas. | Tres parejas y ambos lados, composición sin identidad, mezcla de picos y semillas fijas. |
| V2 | Una composición temprana que no ha convertido su ventaja hacia el minuto 20 pierde fuerza de forma gradual. Si la convirtió, la conserva. | Ventaja justo en el umbral y 1 por debajo, tras el minuto 20, tardía sin efecto y causa visible `earlyFade`. |
| T1 | CC, reparto de daño, rango y rasgos de kit salen de los datos de juego (#340) con reglas fijas. `estimated` solo si faltan datos y queda marcado. | Hechizo sin marca de estado, daño mixto, campeón nuevo sin datos, parche distinto y contenido ficticio sin datos de juego. |
| C7 | Cada cruce da los puntos previstos. El perfil de daño y el control tienen causas propias. `resistVsDamage` solo puntúa en línea. | Triángulo completo, split con respuesta, visión conocida o desconocida, cambios de fase, daño mixto y verdadero neutros, daño físico o mágico concentrado ante primera línea fuerte y carry móvil frente a inmóvil. Cambiar solo `antiAp` o `antiAd` conserva la puntuación de composición. |
| C8 | El mismo detector identifica principal, secundaria o ninguna en IA y partida. A igual resto, concentrar más el daño físico o mágico o reforzar la primera línea rival nunca mejora la valoración de composición del atacante. Invertir bandos invierte los puntos. | Umbral de identidad exacto y justo por debajo, roles flex, empate, draft parcial, cero daño, frontera de daño mixto, tope del factor y tope global con restos. |
| C9 | Con alternativas equivalentes, la IA evita más a menudo un cruce desfavorable al subir de dificultad. | Semillas fijas, picks y bans legales en fearless, misma asignación para explicar y puntuar, réplica a la profundidad del plan 07. Las causas de `ai.decided` suman el total. |
| C10 | El draft y el desglose muestran las identidades, el sentido del cruce y su evidencia, incluida la cuota de daño y la primera línea rival. La ficha muestra los rasgos del campeón. | Cruce neutro, draft parcial, contenido antiguo y tabla alineada en ES y EN. Tests de componente y E2E con «Composición de poke contra engage: desventaja» y «Tu equipo hace casi solo daño mágico y su línea frontal es fuerte» o sus equivalentes en EN. |
| J1 | Cada identidad busca y evita las jugadas de la tabla. Cambiar el plan altera qué se juega, además de la frecuencia. | Primaria y secundaria, rasgos ausentes, plan neutro, fase de escalado y estrategia del coach. |
| J2 | Si los planes chocan, la identidad, la fase, el oro y los objetivos disponibles influyen en qué equipo impone la jugada. | Poke frente a engage en un foso libre, concesión sin pelea, dragón en reaparición, choque por torre lateral y empate simétrico. |
| J3 | Cada nueva jugada emite zona, segundo y causa. Las bajas, el oro, las estructuras y los objetivos cuadran con los hechos. | Defensa exitosa, cazada sin baja, asedio antes de objetivo, dos intentos sobre la misma torre y ninguna jugada tras el nexo. |
| J4 | Los ID y flujos nuevos mantienen estable la secuencia RNG de disputas existentes. El nexo decide cuándo y quién gana. | Activar una disputa nueva sin efecto sobre el estado conserva las tiradas antiguas. Semilla, planes y estado iguales reproducen hechos en Linux y Windows. |
| J5 | El desglose y el minimapa muestran las nuevas jugadas desde los hechos. | Claves i18n ES/EN, causa «Cazaron a su ADC sin visión», segundo exacto y log antiguo sin jugadas nuevas. |
| U1 | Cada campeón aprende, gasta y recupera su definitiva con su recarga **real** del rango que le toca por nivel (6, 11 y 16, #338) y la aceleración de habilidad de sus objetos (#338). | Nivel por debajo del desbloqueo, instante exacto de recuperación, subida de rango durante la recarga, aceleración 0 y alta, redondeo y dos jugadas en el mismo segundo. |
| U2 | Añadir una definitiva disponible a los mismos participantes, a igual resto, nunca reduce su probabilidad de ganar. Engage / wombo obtiene la mayor ventaja por una iniciación lista. | Ambos lados cargados o sin definitivas, cambio de lado, tope de puntos, definitiva de un campeón ajeno a la jugada y captura sin oposición. |
| U3 | Gastar una definitiva abre una ventana en la que el rival busca una pelea u objetivo que encaje con su plan. El ajuste desaparece al recuperarse. | Objetivo en reaparición, escalado que aún cede, recarga propia y rival simultáneas y definitiva aún por aprender. |
| U4 | Los hechos guardan el uso, el nuevo instante de recuperación y las causas. El cara a cara de #337 puede reproducir el mismo estado. | «Pelearon sin la ulti de su jungla» solo si participó y estaba en recarga. Log antiguo, desempate temporal, ES/EN y repetición con la misma semilla. |
| R5 | Goldens de partida y draft con la versión nueva y bandas K1–K15 en verde. | Mismos bytes en Linux y Windows con la misma semilla y contenido. Los hechos de la versión previa siguen siendo legibles. |

### Diseño · Reparto por rol (#326)

Hoy líneas y ganks asignan autores fijos. `fights.ts` sortea autor y un asistente con pesos iguales. `stats.ts` estima daño con KDA, peleas y minutos, reparte el oro restante por igual y calcula la misma nota para todos.

| Pieza | Propuesta |
| --- | --- |
| Atribución | Tras resolver cada disputa, conservar víctima, lado autor, número y orden de bajas. Antes de aplicar y emitir el evento, elegir autores y asistentes sin reemplazo dentro de cada baja (excluir al autor al repartir asistencias). Usar un ámbito nuevo `matchAttribution`, derivado con semilla, game, minuto, disputa, índice de evento e índice de baja. Conservar la secuencia de tiradas de resolución. |
| Pesos iniciales | En orden top, jungla, mid, ADC, apoyo, usar **18 / 22 / 25 / 30 / 5** para remates y **12 / 25 / 17 / 14 / 32** para asistencias. Remate favorece carry, hypercarry y dive, y usa mecánicas y posicionamiento. Asistencia favorece engage, peel y utilidad, y usa comunicación y juego en equipo. Centrar el ajuste de atributos en 50 y acotar cada multiplicador de arquetipo y atributos a 0,75–1,25. En gank, duplicar el peso de remate del jungla dentro de los roles locales. |
| Participantes | Duelo top o mid, solo el laner. Dúo bot, ADC o apoyo, con 0–1 asistencias. Gank, jungla y laner de la zona (también apoyo en bot), con 1–2. Pelea menor, 1–2 asistencias. Pelea de equipo (foso o al menos cuatro bajas en el evento), 2–4, con 3 como valor más probable. En pelea ponderar los cinco roles por lado. Acotar el número a los aliados elegibles y ajustar las probabilidades con K6. |
| Daño a campeones | Mantener por equipo el total que daría la fórmula anterior con los hechos originales. Repartirlo por peso de rol (medias de daño de la tabla), minutos por fase, arquetipo y actuación en peleas. Multiplicar la base de cada minuto por 1,25 en el pico del campeón, 1 en fase adyacente y 0,75 a dos fases, con los cortes actuales en 14 y 26. Poke, carry y participar en peleas aumentan el peso. En apoyo, `poke` con daño principalmente mágico y sin `enchanter` empieza con el doble del peso de utilidad (p. ej. Zyra o Xerath). |
| Oro individual | Ver [Oro por jugador](#diseño--oro-por-jugador-y-ventaja-de-oro-326). El equipo no reparte oro: cada jugador lo gana y el equipo es la suma. Daño y oro comparten acumulador entre snapshots y resultado. |
| Nota | Escala común **0–100**, con **60** para el rendimiento de referencia. Interpolar cada métrica entre P10, media y P90 del rol a 0, 60 y 100 y acotar extremos. Para muertes, invertir el orden de los anclajes y mantener la media en 60. Aplicar los pesos siguientes y redondear una vez. Si una métrica carece de oportunidades, usar 60. El resultado alimenta el MVP y la comparación de la serie. |

#### Atribución implementada y calibrada (#346, 24-11-2026)

Código en `packages/core/match/attribution/`. Ámbito RNG `matchAttribution = 5`, con semilla, game, minuto, disputa, evento y baja. Las tiradas de resolución no cambian (se conservan las dos tiradas antiguas de autor y asistente, descartadas): con las mismas semillas, ganador, duración, bajas, víctimas, oro por lado y probabilidades quedan idénticos a la v4. `SIM_VERSION` 5.

| Pieza | Valor final (K6 en verde en los dos pools) |
| --- | --- |
| Peso de remate (top, jungla, mid, ADC, apoyo) | 18 / 16 / 25 / 32 / 5 |
| Peso de asistencia | 12 / 25 / 55 / 60 / 400 |
| Factores | Arquetipo 0,75 / 1 / 1,25 (remate: `carry`, `hypercarry`, `dive` suben; `utility`, `peel` bajan. Asistencia: `engage`, `peel`, `utility` suben; `carry`, `hypercarry` bajan). Atributos: mecánicas y posicionamiento (remate), comunicación y pelea de equipo (asistencia), 3 milésimas por punto sobre 50, tope 0,75–1,25 |
| Asistencias por tipo | Duelo top o mid, 0. Dúo bot, 0–1 (95 % una). Gank, 1–2 (80 % dos). Pelea menor, 1–2 (80 % dos). Pelea de equipo (foso o 4+ bajas), 2–4 (5 / 30 / 65 %) |
| Gank | El jungla pesa igual que en pelea: duplicarlo dejaba su cuota de bajas 8 pp sobre el pro |

Los pesos de asistencia salen muy por encima de los iniciales porque cada baja ya reparte 2–4 asistentes entre cuatro aliados: solo un peso muy alto hace que el apoyo participe en casi todas, como en el pro (KP 74 %). El oro del evento no cambia con el número de asistentes: una baja con otro jugador paga una sola bolsa y `stats.ts` la divide entre los asistentes (el primero recibe el resto).

Las referencias de bajas, KP y daño salen de la tabla de competición. Para asistencias y muertes, usar el mismo snapshot y método con cifras por 30 minutos (`stat × 1800 / lengthSeconds`). El usuario aprobó los pesos de la nota el 23-11-2026. Visión, objetivos y presión son estimaciones de la simulación.

| Rol | Peso de la nota (%) | Señal específica |
| --- | --- | --- |
| Top | Daño 40, presión 35, muertes 25 | Proporción de disputas de línea top ganadas y torres top tomadas sobre las disputadas. |
| Jungla | KP 45, objetivos 35, muertes 20 | Proporción de dragones, heraldos, barones y elders obtenidos sobre los resueltos. |
| Mid / ADC | Daño 45, bajas 30, muertes 25 | Cuotas de daño y bajas del equipo. |
| Apoyo | KP 35, asistencias 25, muertes 20, visión 20 | Estimar visión con el atributo `vision` y la proporción de disputas en jungla y fosos ganadas. |

Objetivos y presión tienen anclajes de 0, 50 y 100 % de éxitos. En visión, promediar el atributo (0–100) y el porcentaje de disputas ganadas para usar los mismos anclajes. Sin disputas, la contribución de visión es neutra.

### Diseño · Oro por jugador y ventaja de oro (#326)

Hoy el oro es **por equipo** y se reparte después. Pasa a ser **por jugador**: cada uno lo gana y el oro del equipo es la suma.

| Fuente | Quién cobra | Regla inicial (se ajusta con K7) |
| --- | --- | --- |
| Baja | Autor | Recompensa de la baja (`rules.json`). |
| Asistencia | Asistentes | Una bolsa por baja, dividida entre los asistentes. |
| Farmeo de línea | Laner | Base por minuto por rol (pesos derivados de la tabla de oro) más el oro ganado en las disputas de su línea. Top: top. Mid: mid. Bot: 80 % ADC y 20 % apoyo. |
| Farmeo de jungla | Jungla | Base por minuto de campamentos. |
| Objetivos | Los cinco | Dragón, heraldo, elder y barón se reparten a partes iguales entre los cinco. |
| Estructuras | Roles de la línea y los cinco | Torre: 50 % a los roles de su línea y 50 % a partes iguales. Inhibidor y nexo: a partes iguales. |
| Pasivo | Los cinco | Por minuto, a partes iguales. |

- **Hechos.** `event.gold` por lado sigue siendo la suma pagada en el evento. Se añade el dato opcional `playerGold` por rol. En un log antiguo sin él se usa el reparto previo.
- **Estado.** `MatchState` guarda el oro de cada jugador y `state[side].gold` se deriva de la suma. Los restos van a los mayores residuos, con desempate por `ROLES`.
- **Bandas por rol.** Se mantienen las cuotas de oro de la [tabla de competición](#bandas-observadas-en-competición) (K7).

#### Ventaja de oro relativa con saturación

Hoy: `diferencia absoluta × 40`, ponderada 100 / 85 / 70 / 55 % en los minutos 0 / 15 / 25 / 35 (`rules.goldWeight`). Pasa a la **ventaja relativa**, con saturación por jugador. Todo en punto fijo (escala 10.000, redondeo mitad hacia par, [plan 05](../plans/05-rng-determinismo.md)).

| Paso | Fórmula |
| --- | --- |
| Oro útil por jugador | `útil = min(oro, F) + mul(max(oro − F, 0), O)` |
| Oro útil del lado | `E = Σ útil` de sus cinco jugadores |
| Ventaja relativa | `ventaja = div(E_azul − E_rojo, E_azul + E_rojo)`, entre −10.000 y 10.000. Cero si la suma es 0 |
| Puntos | `oro = clamp(mul(ventaja, P), −T, T)`, en la causa `gold` |

| Regla (`rules.json`) | Inicial | Significado |
| --- | ---: | --- |
| `fullBuildGold` (F) | 17.000 | Oro aproximado de un build completo por jugador. Se afina con los precios de #338. |
| `goldOverflow` (O) | 1.000 (10 %) | Parte que aporta el oro por encima de F. |
| `goldLeadPoints` (P) | 3.400.000 | Puntos por ventaja relativa completa. Equivale a 340 por cada punto fijo de ventaja. |
| `goldMaxPoints` (T) | 250.000 | Tope de la causa `gold` (25 puntos). |

- **Se retira** `goldWeight`: la saturación sustituye al peso por minuto. Una ventaja temprana pesa mucho más (menos oro total) y la tardía pesa poco (jugadores completos). Ya deciden objetivos, definitivas y ejecución.
- **K4 se mantiene** (3.000 en contra al minuto 20, gana el 15–30 %). A mano: 3.000 sobre unos 100.000 de oro útil dan una ventaja de 300 y unos 102.000 puntos, igual que los 3.000 × 40 × 0,85 de hoy. `goldLeadPoints` se ajusta en la calibración si K4 sale de banda, con el motivo en el PR.
- **`SIM_VERSION`** sube desde la vigente (hoy 2) al aplicar este cambio, con goldens regenerados.

#### Oro y daño por rol implementados (#347, 24-11-2026)

Código en `packages/core/match/economy.ts`, usado por `stats.ts` (estadísticas finales y snapshots). `SIM_VERSION` 6: ganador, duración, bajas y oro por lado no cambian; cambian el oro y el daño por jugador.

- **Oro.** El oro de cada jugador sale de los hechos, sin tiradas nuevas: bajas y asistencias como antes; el oro de un duelo de línea, al laner (bot: 80 % ADC, 20 % apoyo); una torre de línea, mitad a los roles de su línea y mitad a los cinco; objetivos, inhibidores y el resto, a los cinco. El pasivo se reparte por rol (top 19,5 %, jungla 21 %, mid 20,5 %, ADC 25,5 %, apoyo 13,5 %), calibrado con K7. Los restos van a los mayores residuos, con desempate por `ROLES`. La suma de los cinco es el oro del lado en cada snapshot.
- **Daño.** El total del equipo es el de la fórmula anterior; se reparte 90 % por la cuota de daño de su rol (tabla de competición) y 10 % por lo que hizo cada jugador (bajas, asistencias, peleas).
- **K7 (1.000 partidas por pool).** Oro por rol: media a ≤ 1,5 pp del pro y P10/P90 a ≤ 2 pp; apoyo entre 13 y 15 % y siempre por debajo del ADC. Daño por rol: media a ≤ 2 pp. Los extremos de daño (P10/P90 a 4 pp) no se cumplen: la simulación no tiene la dispersión de un pro, y se quedan sin banda.
- **Pendiente.** Los multiplicadores de fase y arquetipo del daño; el dato `playerGold` en los hechos (el oro por jugador se deriva de los hechos, así que los logs antiguos se leen igual); el CS del snapshot sigue siendo cosmético.

### Bandas observadas en competición

Leaguepedia (CC BY-SA 3.0), [snapshot versionado](../../../packages/core/content/real/LICENSE) del commit `e0c27bd`. CBLOL, LCK, LCP, LCS, LEC y LPL aportan **2.378 partidas distintas** del 14 de enero al 10 de octubre de 2026 y **4.756 equipos-partida** con cinco roles completos. Cada equipo-partida pesa igual. Los cuatro campos de `ScoreboardPlayers` están completos (`Kills`, `Assists`, `DamageToChampions`, `Gold`). Se excluyen 13 equipos con cero bajas al calcular cuota de bajas y KP. KP es (bajas + asistencias) dividido por bajas del equipo.

| Rol | Bajas % · media (P10–P90) | KP % · media (P10–P90) | Daño % · media (P10–P90) | Oro % · media (P10–P90) |
| --- | ---: | ---: | ---: | ---: |
| Top | 18,27 (0–35,71) | 51,84 (27,27–75,00) | 22,56 (14,69–30,54) | 20,09 (17,75–22,52) |
| Jungla | 22,63 (0–42,86) | 71,96 (50,00–93,33) | 16,72 (10,84–23,30) | 20,23 (18,20–22,39) |
| Mid | 24,91 (4,17–45,45) | 65,01 (42,86–86,96) | 24,70 (17,55–32,31) | 21,02 (18,80–23,33) |
| ADC (`bot`) | 29,05 (8,33–50,00) | 65,45 (41,67–86,67) | 28,12 (20,03–36,50) | 25,00 (22,42–27,77) |
| Apoyo | 5,14 (0–14,29) | 73,99 (50,00–94,44) | 7,90 (4,62–11,93) | 13,65 (12,64–14,71) |
| **N por rol** | **4.743** | **4.743** | **4.756** | **4.756** |

El snapshot incluye KDA y visión finales. Para medir los pesos por tipo de pelea o sustituir los indicadores estimados harían falta autor y asistentes por baja, tipo de pelea, y participación individual en objetivos y presión lateral. Son datos de timeline, pendientes de verificar en una fuente con licencia compatible.

Desde la raíz, con Bash y `jq`. Cada fila devuelve rol, muestra y media, P10 y P90. El percentil toma el índice entero inferior de `N × p` en la serie ordenada desde cero.

```sh
TMPDIR=/home/phobos/.cache/rift-tmp jq -s '
  [.[].games[] | (.lines | group_by(.team)) as $teams
    | select(($teams|length)==2 and all($teams[];
        (map(.role)|sort)==["bot","jungle","mid","support","top"]))
    | $teams[]] as $teams
  | [["kills","kills"],["assists","kills"],
     ["damageToChampions","damageToChampions"],["gold","gold"]] as $metrics
  | {games: ([.[].games[].id]|unique|length), teams: ($teams|length),
     metrics: ($metrics | map(. as [$num,$den]
      | [$teams[] | . as $p
        | select(all($p[]; .[$num]!=null and .[$den]!=null))
        | ($p | map(.[$den]) | add) as $total | select($total>0)
        | $p[] | {role, value: ((.[$num] +
            (if $num=="assists" then .kills else 0 end))/$total)}]
      | {metric:(if $num=="assists" then "KP" else $num end),
         roles:(group_by(.role) | map(.[0].role as $role
           | (map(.value)|sort) as $v | length as $n
           | {role:$role, n:$n, pct:([
               ($v|add/$n), $v[($n/10|floor)], $v[($n*9/10|floor)]
             ] | map(. * 10000 | round / 100))}))}))}
' packages/core/content/real/{cblol,lck,lcp,lcs,lec,lpl}.json
```

### Diseño · Composición contra el rival (#320)

El cruce entra una vez por disputa en `contests/edge.ts`, antes del riesgo, y sustituye la causa genérica de daño mixto. Los counters de línea y las sinergias por pareja siguen aportando en sus ámbitos. Los counters de equipo de #321 se consultan por pareja. El cálculo de equipo usa los rasgos de campeón que los originan.

#### Detectar identidades

Ampliar el catálogo compartido `AiContent.identities` de `packages/core/content/identities.json`. Conservar los IDs vigentes y añadir los tres planes que faltan. El mismo detector alimenta el componente `identity` de la IA, el perfil de partida y el desglose. Cada plan conserva `archetypes` y `threshold`, y añade sus condiciones de kit, curva y rol. Contar **campeones distintos** que cumplan alguna señal del plan y exigir además sus funciones obligatorias.

| Identidad (ID) | Umbral | Señales que cuentan | Funciones obligatorias |
| --- | ---: | --- | --- |
| Poke / asedio (`siege`) | 3 | `poke` o `siege` | Dos campeones de poke y capacidad de asedio. |
| Engage / wombo (`collapse`) | 3 | `engage`, `wombo` o `aoe` | Una apertura con `engage` o `wombo` y un aliado que la siga con `aoe` o `wombo`. |
| Front-to-back (`backline`) | 3 | `tank`, `carry`, `hypercarry`, `peel`, `disengage` o `enchanter` | Un tanque, un carry y un protector en tres campeones distintos. |
| Pick (`ambush`) | 2 | `pick`, `hook`, CC dirigido o `utility` con `vision` | Un campeón con `pick` o `hook` y un aliado con CC dirigido o utilidad de visión. |
| Split 1-3-1 (`sidelanes`) | 3 | `splitpush`, `duel`, `siege` o `disengage` | Top y mid aptos para el lateral (`splitpush` o `duel`, al menos uno con `splitpush`). Otro aliado sostiene el grupo con asedio o disengage. |
| Dive (`dive`) | 3 | `dive`, `engage` o `skirmish` | Dos campeones de dive y un tercer aliado con engage o escaramuza. |
| Tempo temprano (`earlyTempo`) | 3 | `power: early`, `invade` o `skirmish` | Dos picos tempranos y capacidad de invasión o escaramuza. |
| Escalado tardío (`lateScaling`) | 3 | `power: late`, `hypercarry` o `peel` | Dos picos tardíos, uno de carry o hypercarry, y un tercer aliado con peel. |

Ordenar planes activos por cuánto superan su umbral, después por número de campeones que aportan y, en empate, por ID ascendente. El primero es principal y el segundo, si existe, secundario. Con cero planes activos, el equipo queda sin identidad. En draft parcial, contar solo picks confirmados y usar una asignación legal estable para flex (orden `ROLES` e ID para desempatar). Las identidades detectadas son provisionales hasta completar la alineación. Un hueco o un rasgo de kit desconocido aporta cero.

**Implementado (#349).** [`detectIdentities`](../../../packages/core/match/composition/identities.ts) lee `archetypes` y `power` del contenido y, si existen, `kit` y `ccKinds` (la señal `cc:targeted` es CC dirigido). Hoy el contrato no publica los rasgos de kit en `champions.json`: sin ellos, los planes que los exigen (`siege`, `collapse`, `ambush`, `sidelanes`) no se activan. Las reglas viven en el código, no en `identities.json`: ampliar el catálogo cambiaría las elecciones de la IA y sus goldens. Sin conectar aún a la IA ni a la partida. El desglose devuelve cada plan con su cuenta, aportantes, requisitos y `active`; los empates se resuelven por exceso, número de aportantes e ID.

#### Cruces de identidades

Cada fila indica qué identidad recibe ventaja y por qué. Las demás parejas y las filas fuera de su fase, disputa o condición valen cero. Pelea, objetivo y asedio usan las disputas del plan 08. Temprana es antes del minuto 14, media va del 14 al 25 y tardía empieza en el 26.

| Identidad favorecida | Rival | Cuándo y por qué | Puntos |
| --- | --- | --- | ---: |
| Engage / wombo | Poke / asedio | Pelea y objetivo. La entrada cierra la distancia antes del desgaste. | 4,5 |
| Poke / asedio | Front-to-back | Objetivo y asedio. El alcance desgasta la primera línea antes de una pelea. | 3 |
| Front-to-back | Engage / wombo | Pelea y objetivo. La primera línea y la protección frenan la iniciación. | 3 |
| Front-to-back | Dive | Pelea. El protector cubre al carry, con más efecto si dos aliados aportan `peel`, `disengage` o `enchanter`. | 2 con un protector, 4 con dos o más |
| Dive | Poke / asedio | Pelea. Varios atacantes alcanzan la retaguardia de largo alcance. | 3 |
| Split 1-3-1 | Engage / wombo, front-to-back o poke / asedio | Asedio. Obliga al rival a dividirse. Vale cero si el top y el mid rivales pueden cubrir ambos laterales con `duel` o `splitpush`. | 3 |
| Pick | Split 1-3-1 | Pelea y objetivo desde la fase media. Puede atrapar a un campeón aislado al rotar. | 3 |
| Pick | Cualquiera, incluida la ausencia de identidad | Objetivo desde la fase media, con los cinco kits rivales conocidos y sin `vision`. La falta de cobertura facilita una emboscada. Si coincide con la fila anterior prevalece su valor de 3. | 2 |
| Tempo temprano | Escalado tardío | Objetivo y asedio en fase temprana. Los primeros picos abren la disputa antes de que escale el rival. | 4 |
| Escalado tardío | Tempo temprano | Objetivo y asedio en fase tardía. Los picos tardíos toman el relevo. El cruce es neutro en fase media. | 4 |

**Cruce (`compIdentity`).** Dar peso 100 % a la principal si está sola y repartir 75 % y 25 % si hay secundaria. Ponderar cada cruce por el producto de los pesos propios y rivales. Aplicar la fila de baja visión también si el rival completo carece de identidad. Restar la ventaja roja de la azul y acotar la magnitud a **4,5 puntos** (45.000). En draft, usar rasgos visibles y evaluar la defensa lateral cuando top y mid rivales tengan pick en la asignación legal.

**Coherencia (`compCoherence`).** En pelea, objetivo y asedio, cada equipo completo con identidad principal aporta **2,5 puntos** (25.000). Aplicar la diferencia entre los dos equipos. Con ambas composiciones claras o ambas sin identidad, el efecto es cero.

#### Perfil de daño, control y topes

| Factor | Cálculo y ámbito | Tope |
| --- | --- | ---: |
| Perfil de daño (`compDamageProfile`) | Pelea, objetivo y asedio. La primera línea rival puede comprar resistencias contra el tipo físico o mágico dominante. El daño mixto y el verdadero tienen efecto neutro según la fórmula de abajo. | **3 puntos** |
| Control (`compLockdown`) | Pelea. Cruzar CC fiable (`targeted` o `knockup` con `cc ≥ 7`) con carry o hypercarry de `mobility ≤ 3`. Cada controlador y cada carry expuesto aporta 5.000 a su lado del cruce, hasta 10.000 por señal. Multiplicar ambas señales y la fracción sin protección (2.500 de cobertura por protector, hasta 7.500). | 3 puntos |

**Perfil de daño.** Ponderar el reparto físico, mágico y verdadero por la aportación esperada de rol y arquetipo de #326 y normalizar las tres cuotas a 10.000. Sin daño previsto, la penalización es cero. La concentración vale `max(0, max(físico, mágico) − 6.500) / 3.500` en punto fijo. Hasta el 65 % de cualquier tipo, la mezcla es neutra. El daño verdadero cuenta en el total y queda fuera del máximo.

**Primera línea.** Sumar `frontline` de los campeones rivales (0–10 por perfil), con un mínimo de 6 para cada campeón `tank`. Multiplicar la suma por 300 y acotar a 10.000. La penalización de cada atacante es el producto en punto fijo de su concentración, la fuerza de la primera línea rival y **3 puntos** (30.000). Comparar ambas penalizaciones desde la perspectiva azul. Un rival sin primera línea da penalización cero.

Usar escala **10.000** y redondeo mitad hacia par. Para control, restar la valoración roja de la azul, acotar el margen a una unidad de punto fijo por sentido y multiplicar por 3. Si la suma de magnitudes de los cuatro factores supera **8 puntos** (80.000), reducirlas proporcionalmente y redondear el margen neto antes de repartir los restos por clave. Las causas aplicadas deben sumar ese margen sin superar el tope. El tope global de 8 y el de 3 para perfil de daño recogen la decisión del 23-11-2026.

**Counters de línea de #321.** Aplicar `antiAp` y `antiAd` exclusivamente mediante `resistVsDamage` en el prior del matchup de línea, con un aporte de hasta 2 puntos de ventaja o desventaja. Al implementar, ajustar el aporte base de línea de 3 a 2 y retirar `resistVsDamage` de las reglas de counters de equipo.

- **Contrato de #321.** Publicar en contenido real y ficticio `split`, `frontline`, los rasgos de `kit` usados en las tablas, `ccKinds` y su procedencia (los datos salen de #340, ver [Procedencia de los rasgos](#procedencia-de-los-rasgos-340)). Si faltan los datos de juego, `split` se estima como fallback con la categoría actual (tipo único, mitad física y mitad mágica para mixto, sin peso para utilidad). Si falta `frontline`, usar el mínimo de `tank` o cero. Mantener distinguible un kit desconocido de uno conocido sin un rasgo.
- **IA de draft.** Puntuar la mejora tras un pick legal o la ventaja evitada al banear un posible pick rival. Fácil refuerza su plan con el detector y valora el perfil de daño frente a la primera línea visible. Normal usa todos los cruces y mira una réplica legal. Difícil comprueba además su respuesta. Atenuar el cruce, el perfil de daño y el control por el menor número de picks confirmados entre ambos equipos dividido por cinco. En la valoración de draft, contar cada cruce una vez y ponderar las ventanas temprana y tardía del cruce de tempo y escalado en proporción 2 a 1. Usar coherencia relativa al completar las dos alineaciones en lugar del refuerzo propio. Conservar azar y límites del [plan 07](07-ia-de-draft.md#dificultad).
- **Presentación.** Publicar identidades en la vista del draft y en `match.started`, también si el cruce vale cero. Guardar en `match.event.causes` y `ai.decided` evidencia opcional de cada efecto (regla, fase, cuota de daño y valor de primera línea, según corresponda). Ejemplo de desglose «Tu equipo hace casi solo daño mágico y su línea frontal es fuerte». La ficha muestra la aportación a cada plan, el reparto de daño, la primera línea, el CC, la movilidad y la procedencia. Usar palabras e iconos accesibles, i18n ES/EN, tablas alineadas, selects Caja y campeones indisponibles en gris con raya diagonal. Los signos se reservan para el oro.

#### Procedencia de los rasgos (#340)

Ningún rasgo se cura a mano. Salen de los **datos de juego** (issue #340), con reglas fijas y versionadas. `estimated` solo existe como fallback y queda marcado en la ficha.

| Rasgo | Fuente (#340) | Regla |
| --- | --- | --- |
| Tipos de CC (`ccKinds`) | Texto de las habilidades en CommunityDragon (marcas `<status>`). Subclases de Meraki | Aturdimiento, levantamiento, inmovilización, supresión, provocación, miedo y encantamiento cuentan como CC fiable. Ralentización, no. `targeted` si la habilidad tiene objetivo, `knockup` si levanta. |
| Reparto de daño (`split`) | Marcas `<physicalDamage>`, `<magicDamage>` y `<trueDamage>` del texto y sus escalados (AD, AP) | Cuota de cada tipo en las habilidades de daño, ponderada por su escalado y su peso en el combo. Normalizada a 10.000. |
| Rasgos de kit (`kit`) | Etiquetas de hechizo de CommunityDragon y subclases de Meraki | Reglas derivadas: Catcher → `pick`/`hook`, Enchanter → `enchanter`/`peel`, Artillery → `poke`/`siege`, Vanguard → `engage`, Warden → `tank`/`peel`, Diver → `dive`, Skirmisher → `skirmish`/`duel`, Battlemage → `aoe`. |
| `range`, movilidad | Alcance base y habilidades con desplazamiento | `range` del dato. Movilidad por número de desplazamientos. |
| Definitivas | `cooldownTime` por rango de la definitiva | Recarga real por rango, ver [Disponibilidad de definitivas](#disponibilidad-de-definitivas-339). |
| Fallback | Ninguna | Rasgo `estimated` con valor neutro. Contenido ficticio sin datos de juego conserva su tabla propia. |

#### Curva de poder (V1, V2)

El pico de cada campeón (`power: early`, `mid` o `late`) ya da puntos por fase al perfil del equipo. Se añade la viabilidad de la curva:

| Pieza | Regla inicial |
| --- | --- |
| Equilibrio | Con atributos iguales, composición temprana, media y tardía ganan cada una **45–55 %** frente a las otras. Los puntos de fase se ajustan por K15. |
| Duración | Las tempranas ganan partidas más cortas y las tardías, más largas. Ya lo da el pico por fase y se comprueba en K15. |
| Desgaste temprano (`earlyFade`) | Desde el minuto 20, cada campeón `power: early` de un equipo cuya ventaja relativa de oro es menor que `earlyConvertLead` (500, un 5 %) resta puntos que crecen en línea recta hasta el minuto 30. Máximo 5.000 por campeón (2,5 puntos con cinco). Si el equipo ya convirtió, el desgaste es cero. |

Las reglas `earlyConvertLead`, `earlyFadeFrom` (20), `earlyFadeTo` (30) y `earlyFadePoints` (5.000) viven en `rules.json`. La causa `earlyFade` aparece en el desglose.

#### La composición decide las jugadas

`MATCH_CONTESTS` mantiene el bucle por minuto. Hoy las ventanas de líneas, gank, peleas, objetivos y estructuras salen de `due` y del calendario del mapa. La identidad de cada equipo pasa a generar un plan que propone **qué jugada ocurre, dónde y con qué frecuencia**. Una vez elegida la jugada, su disputa resuelve quién gana con `edge` y las reglas del mapa.

| Identidad | Busca | Evita | Arquetipos y rasgos del campeón que respaldan el plan |
| --- | --- | --- | --- |
| Poke / asedio | Desgastar antes del objetivo y asediar torres. | Peleas largas. | `poke` y `siege` con `range` largo o `ccKinds: skillshot`. El `sustain` rival reduce la oportunidad de despejar el foso. |
| Engage / wombo | Forzar peleas de equipo con un objetivo disponible. | Cambiar golpes a distancia o dispersar al equipo. | `engage`, `wombo`, `aoe` y CC de área o levantamiento (`knockup`). |
| Front-to-back | Pelear de frente y proteger al carry. | Escaramuzas aisladas. | `tank`, `carry` o `hypercarry`, `peel`, `enchanter` y `disengage`. `frontline` y CC dirigido sostienen la formación. |
| Pick | Cazar objetivos aislados y controlar visión antes de rotar. | Choque frontal contra una formación cerrada. | `pick`, `hook`, `vision` y CC dirigido. La movilidad y la visión rivales reducen la oportunidad. |
| Split 1-3-1 | Presionar top y bot, y tomar torres laterales. | Peleas de cinco contra cinco. | `splitpush` y `duel` en los laterales, con `sustain` para prolongar la presión. `siege` o `disengage` sostienen al grupo central. |
| Dive | Entrar bajo torre y alcanzar al carry. | Desgaste prolongado ante protección fiable. | `dive`, `engage` y `skirmish`, con movilidad y CC dirigido o levantamiento. |
| Tempo temprano | Invadir, gankear en fase temprana y disputar los primeros dragones. | Intercambiar los primeros objetivos por farmeo. | `skirmish`, `power: early`, `invade` y `vision` en la entrada a jungla. |
| Escalado tardío | Farmear y ceder objetivos sin pelea antes del pico. Tras el pico, pelear por objetivos con el carry. | Invadir y forzar peleas antes de escalar. | `power: late`, `hypercarry`, `farm` y `peel`. El perfil de daño (`split`) indica si conviene prolongar la disputa frente a la primera línea rival. |

Los arquetipos y requisitos de [detección](#detectar-identidades) activan el plan. Los rasgos de la tabla concretan sus oportunidades y objetivos. En todas las identidades, `split` entra por el perfil de daño ya definido al valorar un choque frontal. Publicar `range` y `sustain` junto al resto de rasgos de #321. La ausencia de un rasgo adicional deja neutro ese ajuste, y una alineación sin identidad conserva el plan equilibrado.

**Cómo se impone una jugada.** En cada minuto, recortar candidatos por fase, zona, torres en pie y disponibilidad o reaparición del objetivo. Con un plan activo, el gank se puede proponer en los minutos 4–14, una pelea frontal desde el 14 y una pelea de foso cuando el objetivo esté disponible. Cada propuesta identifica lado iniciador, disputa, zona y, si aplica, objetivo o víctima. La estrategia del coach (`tempo`, prioridad de objetivo y riesgo) ajusta los pesos del plan dentro de sus límites. Si compiten un asedio de poke y una entrada de engage por el mismo foso, la tabla de cruces y la situación deciden cuál tiene más peso para imponerse.

1. Partir de pesos enteros iniciales para calibrar. Usar 1.200 para jugadas actuales, 600 para cada jugada nueva solicitada por el plan y 6.000 para seguir sin iniciativa táctica. Sumar 2.400 a lo que el plan busca y restar 1.600 a lo que evita, ponderando principal y secundaria como en la tabla de cruces. El escalado cambia preferencias desde el minuto 26. Antes del pico, farmear añade 1.800 al peso de seguir sin iniciativa y mantiene el oro pasivo y de línea.
2. Aplicar el cruce pertinente a la disputa y fase, normalizado hasta 1.200 de ventaja o desventaja para la iniciativa. Sumar un ajuste de oro de hasta 1.000 en cada sentido (se alcanza con 3.000 de diferencia) y 1.000 cuando la propuesta gira en torno a un objetivo disponible. Acotar cada peso a 0–10.000. En el sorteo, cada probabilidad es el peso dividido por la suma de pesos, incluida la opción de no hacer jugada. La resolución calcula su probabilidad aparte en `edge`.
3. Conservar el destino de mayor peso para cada jugada y lado, con orden estable de zona y rol en empate. Sortear como máximo una iniciativa táctica por minuto entre ambos lados y la opción de no actuar. Si ambos proponen la misma pelea de foso, sus pesos suman y la pelea se resuelve una sola vez. Una concesión retira esa pelea de las propuestas y permite al rival intentar la captura sin bajas, con causa de objetivo cedido. Una pelea 5v5 en el foso da prioridad al ganador durante el minuto siguiente. La captura se propone y registra por separado, mientras el objetivo siga disponible.
4. Mantener el avance ordinario de estructuras desde su ventana habitual. Un asedio o presión que use esa misma zona sustituye el avance básico allí ese minuto y comparte su validación de estructuras. Conservar el oro de línea y pasivo, los requisitos de torres e inhibidores y la reaparición de objetivos. Dos planes neutros mantienen la agenda base.

| Disputa nueva | ID | Cuándo y qué puede pasar | Zona y ejemplo de causa |
| --- | ---: | --- | --- |
| Cazada (`catch`) | 40 | Desde fase media, buscar un lateral expuesto o un carry en rotación sin cobertura de visión. Inferir la ventana de la presión lateral reciente y la cobertura del equipo (`vision` de kit y atributo de visión). Un intento puede ganar control de visión sin baja. | Línea lateral, entrada de jungla o foso. «Cazaron a su ADC sin visión». |
| Asedio de poke (`poke-siege`) | 41 | Con una torre atacable o un objetivo disponible. Puede dar opción de tomar la torre por la regla ordinaria o dar prioridad sobre el foso durante el minuto siguiente. | Línea o foso. «Desgastaron al rival antes de que pudiera disputar el dragón». |
| Dive bajo torre (`tower-dive`) | 42 | En una línea con torre rival en pie y un carry elegible. El defensor puede ganar la disputa y causar bajas. | Línea de la torre. «Se tiraron bajo torre a por el carry». |
| Presión lateral (`side-lane-pressure`) | 43 | Desde fase media, en top o bot con una torre atacable. Puede forzar respuesta, abrir una ventana de cazada sobre el lateral o tomar la torre mediante un hecho de estructura. | `lane-top` o `lane-bot`. «Presionaron la calle lateral y obligaron al rival a dividirse». |
| Invasión (`invade`) | 44 | En fase temprana y en jungla rival. Puede ganar oro o control de visión, o acabar en una escaramuza si el rival le hace frente. | Cuadrante de jungla rival. «Invadieron la jungla con prioridad de línea». |

Los efectos temporales indican lado y zona y caducan al terminar el minuto siguiente. Cada jugada resuelta emite el lado iniciador, el ganador, `zone`, `second` entre 0 y 59 y una causa traducible. Conservar `side` como el ganador del hecho y añadir el iniciador como dato opcional para leer logs antiguos. Si la cazada provoca una baja, mostrar el rol de la víctima. Si faltaba visión, indicarlo en la causa. Las bajas se cuentan por lado autor y las capturas y estructuras se contabilizan con sus hechos canónicos. Ordenar por segundo y validar que el objetivo o la estructura aún esté disponible al aplicar cada hecho. El replay y el minimapa consumen esos hechos.

**Determinismo.** Reservar el ID 45 para el sorteo de iniciativa. Usar un flujo por ID con `deriveSeed(seed, SCOPES.match, game, minute, id)`, en orden canónico de propuestas. Conservar los ID existentes y las posiciones de las tiradas de resultado si se traslada una puerta de frecuencia al selector. Cada disputa nueva resuelve con su propio flujo. Al introducir el primer cambio de hechos de jugadas, subir `SIM_VERSION` y regenerar goldens según el [plan 05](../../plans/05-rng-determinismo.md).

#### Disponibilidad de definitivas (#339)

| Estado por campeón | Regla |
| --- | --- |
| Por aprender | El nivel sale de #338. Desbloqueo por defecto en el nivel 6 (el dato de juego puede traer otro). Sin ventana de explotación. |
| Lista | Desde el desbloqueo, o cuando el segundo de partida alcanza `readyAt`. |
| En recarga | Al usarla, `readyAt = segundo de uso + recarga efectiva`. |

**Recarga real (#340, #338).** La recarga base sale de `cooldownTime` de CommunityDragon por rango de la definitiva. El rango sube con el nivel del campeón (niveles **6, 11 y 16**, #338). La aceleración de habilidad (`haste`) viene de los objetos (#338) y se aplica en entero: `recarga efectiva = round(base × 100 / (100 + haste))`, mitad hacia par, en segundos. Una subida de rango o de objetos solo cambia los usos futuros.

| Campeón | Recarga base por rango (s) | Con 40 de aceleración (rango 1) |
| --- | --- | ---: |
| Thresh | 120 / 100 / 80 | 86 |
| Malphite | 130 / 115 / 100 | 93 |
| Galio | 180 / 160 / 140 | 129 |
| Jinx | 85 / 65 / 45 | 61 |
| Yasuo | 70 / 50 / 30 | 50 |

Los valores son ejemplos del dato de juego, no constantes del código. **120 / 100 / 80 s** solo se usa si falta el dato y queda marcado como `estimated`. El tiempo de partida es `(minute − 1) × 60 + second`. El selector consulta la disponibilidad al empezar el minuto. Resolver por segundo e ID de disputa y comprobar de nuevo la disponibilidad antes de cada resolución. Aplicar los usos al cerrar la disputa para que la siguiente vea la recarga, incluso si coincide en segundo. Detener la resolución al caer el nexo.

**Resolución.** Fijar los participantes de cada lado antes de calcular la probabilidad. En una pelea 5v5 cuentan los cinco roles. En cazadas, ganks, dives e invasiones disputadas cuentan los participantes locales. Las disputas de objetivo o asedio valoran a quienes pueden intervenir y las capturas sin oposición tienen ajuste cero. En `edge`, cada definitiva lista aporta **1 punto** (10.000) a su lado. Si el portador tiene `engage` o `wombo`, añadir hasta **0,5 puntos** según el peso de esa identidad en el plan (100 % si es la única, 75 % o 25 % si conviven dos). Restar ambos lados y acotar el margen a **4 puntos** (40.000) por disputa. Es un factor de estado temporal, aplicado una vez antes del riesgo. El tope de composición sigue aplicándose a sus cuatro factores.

| Efecto de las definitivas | Regla |
| --- | --- |
| Ventaja en la disputa | Cada definitiva lista suma 1 punto a su lado, hasta 0,5 más para `engage` o `wombo`. El margen se acota a 4 puntos. Más definitivas listas nunca bajan la probabilidad (U2). |
| Ventana tras el uso | Al gastar sus definitivas, el rival busca pelea u objetivo mientras duren las recargas (K13). |
| Plan de cada identidad | Fuerza o evita la pelea según las definitivas listas de ambos lados (tabla siguiente). |
| Causa en el desglose | «Pelearon sin la ulti de su jungla», solo si participó y estaba en recarga. |

**Uso y ventana.** Registrar los usos de ambos lados incluso si pierden. Como punto de partida, gastar hasta tres definitivas listas por lado en un 5v5 u objetivo disputado y hasta una en una jugada local o un asedio disputado. Priorizar portadores clave para el plan y desempatar por orden de rol. La ventana para el rival empieza tras el uso y dura hasta `readyAt`. Una definitiva aún por aprender carece de ventana de explotación.

| Identidad | Fuerza la jugada cuando… | Espera o busca otra jugada cuando… |
| --- | --- | --- |
| Poke / asedio | El rival ha gastado su iniciación. Aprovecha para desgastar o asediar un objetivo. | El rival conserva su entrada y el equipo tiene su disengage en recarga. |
| Engage / wombo | Su iniciador está listo y el rival tiene menos definitivas listas o ha gastado protección. | Su iniciador está en recarga ante un rival listo para responder. |
| Front-to-back | El carry y su protector están listos para una pelea frontal. | Falla una de esas definitivas y la entrada rival sigue lista. |
| Pick | Su control está listo y el objetivo aislado o su protector ha gastado la definitiva. | El control propio se está recargando y el rival conserva su respuesta. |
| Split 1-3-1 | Su duelista está listo y el rival ha gastado las definitivas que pueden frenar la presión lateral. | El duelista está en recarga y el rival tiene su respuesta lista. |
| Dive | Su entrada está lista y el protector rival está en recarga. | Falta su definitiva de entrada y el rival conserva peel. |
| Tempo temprano | Tras el desbloqueo, llega antes a la disputa con sus definitivas listas o con las del rival en recarga. | Sus definitivas clave están en recarga y el rival puede contestar. Los ganks anteriores al desbloqueo siguen el plan temprano. |
| Escalado tardío | Tras el pico, el carry y su protector están listos para aprovechar una recarga rival. | Aún no alcanzó su pico o su carry está en recarga frente a un rival listo. |

La tabla modifica el peso de una propuesta válida en el selector de jugadas. Identificar los roles clave por los rasgos de cada plan y desempatar por orden de rol. Como estimación inicial, sumar o restar **600** según la condición, **1.200** para engage / wombo, y ponderar identidades principal y secundaria. Si coinciden condiciones, prevalece esperar. Tras un gasto, el rival puede aprovechar la ventana para forzar pelea o tomar un objetivo disponible según su plan.

**Hechos y determinismo.** Guardar como datos opcionales del hecho los roles participantes que estaban en recarga, las definitivas gastadas y sus nuevos `readyAt`. La causa puede decir «Pelearon sin la ulti de su jungla» cuando participó y estaba en recarga. Publicar el estado por rol en el snapshot para el cara a cara de #337. En un log antiguo sin esos datos, el estado queda desconocido. Usar segundos enteros y punto fijo 10.000 según el [plan 05](../../plans/05-rng-determinismo.md). Los temporizadores y la selección de usos reutilizan el orden de la jugada. Mantener los flujos de azar existentes y subir `SIM_VERSION` con los primeros hechos o resultados modificados.

### Invariantes y calibración

El ganador sigue siendo el equipo que derriba el nexo en el bucle por minuto. El nexo fija la duración. El límite de seguridad solo detecta un fallo de simulación. #326 actúa sobre atribución y estadísticas, y cambia el oro a por jugador (los totales por lado no cambian al repartir). La ventaja de oro relativa, #320 y #339 pueden cambiar qué disputas ocurren y sus probabilidades para un draft dado. En cada entrega que cambie los bytes, subir `SIM_VERSION` desde la versión vigente y regenerar los goldens afectados con `pnpm goldens:update`, según el [plan 05](../../plans/05-rng-determinismo.md). Leer los hechos previos y conservar sus estadísticas guardadas. Reutilizar punto fijo y RNG por ámbito en el núcleo puro.

Ampliar `packages/core/match/calibration` sobre las **1.000 semillas** actuales por pool (control y empaquetado, **600** para K1). Mantener K1–K5. Aplicar el mismo filtro y cálculo de percentiles que en la muestra real. Las tolerancias son provisionales y están en puntos porcentuales (pp). Informar por rol y pool del tamaño, media, percentiles y desvío.

| Banda | Comprobación Monte Carlo |
| --- | --- |
| K6 · Bajas y participación | Media por rol a 3 pp o menos de la cuota de bajas observada y a 5 pp o menos de KP. Cada extremo P10/P90 a 6 y 8 pp, respectivamente. Asistencias por baja entre 2,0 y 2,6 de media por equipo-partida (referencia observada 2,28 en 4.743 equipos). |
| K7 · Daño y oro | El oro de cada rol sale de su propio libro (suma de fuentes). Medias por rol dentro de 2 pp (daño) y 1,5 pp (oro). Extremos P10/P90 dentro de 4 y 2 pp. Comparar apoyo mago y de utilidad con semillas emparejadas e igual actuación de base. |
| K8 · Nota | En cada pool equilibrado, media por rol de 56 a 64 y distancia entre medias de hasta 5 puntos de nota. Mantener R3 como prueba controlada de mérito individual. |
| K9 · Cruces de identidades | 600 pares de partidas equilibradas por fila aplicable (300 por lado favorecido). Dentro de cada par, comparar la fila activa con la misma semilla y alineaciones con esa fila a cero en `edge`. Mantener su uso en el selector para aislar el efecto de puntuación. La tasa de victoria del equipo favorecido sube entre 0 y 10 pp. Medir las dos ventanas de tempo y escalado por separado. C7 exige la ventaja en la disputa al cumplirse la fase y las condiciones. |
| K10 · Mezcla de jugadas | 600 pares por contraste (300 por lado), con semillas, atributos y rival equilibrado iguales. Comparar medianas del equipo evaluado. Atribuir asedios y peleas al iniciador y torres y objetivos a quien los toma. Poke inicia **2–5** asedios en línea y al menos **1 más** que engage. Engage inicia **3–7** peleas 5v5 y al menos **1 más** que poke. Split consigue **1–3** torres laterales más que front-to-back (niveles 1–3 en top y bot). Tempo toma **1–2** objetivos tempranos más que escalado (dragones o heraldo antes del 14). Son estimaciones para calibrar. |
| K11 · Totales de partida | Mantener K1–K9 en sus muestras, incluida la mediana de bajas de K3 (**15–30**). En las muestras de 1.000 partidas por pool, añadir medianas de **8–15** torres (incluidas las del nexo) y **3–6** dragones (elder aparte). Las bandas nuevas son estimaciones para calibrar. |
| K12 · Ventaja en disputa (#339) | 600 pares de disputas equilibradas por grupo, con 300 por lado, misma semilla y una definitiva relevante lista frente a la misma en recarga. La tasa de victorias sube **0–4 pp** en el plan equilibrado y **0–6 pp** en engage / wombo. En situaciones sin saturación, la ventaja calculada es positiva y mayor para su iniciación. Bandas estimadas. |
| K13 · Ventana tras el uso (#339) | 600 pares de situaciones elegibles, con 300 por lado y mismo oro, fase y objetivo disponible. Con una definitiva rival recién gastada, el equipo evaluado inicia peleas o intentos de captura **3–15 pp** más a menudo que si esa definitiva sigue lista. Al recuperarse, el ajuste de ventana es cero. Banda estimada. Mantener K1–K11. |
| K14 · Ventaja de oro (#326) | Mantener **K4**: 3.000 de oro en contra al minuto 20 gana el 15–30 %. Con 1.000 en contra al minuto 5 y atributos iguales, el equipo gana menos que con la fórmula anterior (se espera 35–47 %). Con 3.000 en contra al minuto 35, gana igual o más que en K4 y menos del 40 %. Con ambos equipos por encima del build completo, la ventaja de oro no mueve la tasa más de 3 pp. Bandas estimadas. |
| K15 · Curva de poder | 600 pares por pareja (temprana–media, media–tardía y temprana–tardía), 300 por lado, atributos iguales: cada composición gana **45–55 %**. La mediana de duración de las victorias tempranas es al menos **2 min** menor que la de las tardías. Con ventaja relativa menor que el 5 % al minuto 20, la tasa de victoria temprana desde ahí baja al menos 5 pp frente a su versión sin `earlyFade`. Bandas estimadas. |

### Troceado propuesto · Fase 3 — Pipeline de contenido real

| # | Issue | Área | Issue existente | Test que lo cierra |
| --- | --- | --- | --- | --- |
| 1 | Publicar datos de juego: CC, reparto de daño, rasgos de kit, rango y recargas de definitivas con procedencia | `area:data` | #340 | T1, C8 y J1 en contratos y contenido real, ficticio y antiguo. Parte de #321. |
| 2 | Limitar `resistVsDamage` a línea (#320) | `area:core` | #320 | C7 en counters de línea y equipo. Tras 1. |
| 3 | Atribuir bajas y asistencias por rol (#326) | `area:core` | #326 | R1, R4 y K6. |
| 4 | Ganar oro por jugador y repartir daño por rol (#326) | `area:core` | #326 | G1, R2, R4 y K7. Tras 3. |
| 5 | Calcular la nota común por rol (#326) | `area:core` | #326 | R3 y K8. Tras 4. |
| 6 | Detectar identidades desde el catálogo compartido (#320) | `area:core` | #320 | C8 en umbrales, empates, ausencia de identidad y drafts parciales. Tras 1. |
| 7 | Puntuar perfil de daño frente a primera línea y control contra carries (#320) | `area:core` | #320 | C7 en daño mixto y verdadero neutros, C8 en monotonía del perfil de daño. Tras 1 y 4. |
| 8 | Aplicar cruces de identidades, coherencia y tope global (#320) | `area:core` | #320 | C7 en cruces, C8 en coherencia y topes, y K9. Tras 6 y 7. |
| 9 | Leer cruces de composición en picks y bans (#320) | `area:draft` | #320 | C9. Tras 8. |
| 10 | Ventaja de oro relativa con saturación por build completo (#326) | `area:core` | #326, usa precios de #338 | G2, G3, K4 y K14. Sube `SIM_VERSION`. Tras 4. |
| 11 | Curva de poder y desgaste temprano (#320) | `area:core` | #320 | V1, V2 y K15. Tras 6 y 10. |
| 12 | Definir planes por identidad y arbitrar sus jugadas (#320) | `area:core` | #320 | J1, J2 y J4 en el selector. Tras 6 y 8. |
| 13 | Resolver cazadas, asedios de poke, dives, presión lateral e invasiones (#320) | `area:core` | #320 | J3 y J4 en disputas, hechos y replay. Tras 12. |
| 14 | Calcular nivel y objetos por jugador (nivel, rango de definitiva y aceleración) | `area:core` | #338 | Niveles 6, 11 y 16 y aceleración en U1. Tras 4. |
| 15 | Simular disponibilidad y uso de definitivas con recargas reales | `area:core` | #339 | U1–U4, K12–K13 y regresión K1–K11. Usa 1 y 14. Tras 12 y 13. |
| 16 | Cara a cara por rol con el estado de definitivas | `area:core` | #337 | Reproduce el estado de U4. Tras 15. |
| 17 | Calibrar la mezcla de jugadas y los totales (#320) | `area:core` | #320 | K10, K11 y regresión de K1–K9 y K14–K15. Tras 11, 13 y 15. |
| 18 | Mostrar identidades, causas de jugadas, definitivas, minimapa y estadísticas (#320, #326) | `area:ui` | #320, #326 | C10 y J5. Tras 5, 9, 13 y 15, con la ficha de #318. |

Cada cambio de hechos actualiza y verifica sus goldens y las bandas ya vigentes. R5 comprueba el conjunto al cerrar la ampliación. Quedan para calibración las estimaciones de visión, presión y objetivos, los puntos de cada cruce y las tolerancias iniciales Monte Carlo. La muestra de Leaguepedia fija la referencia observada.
