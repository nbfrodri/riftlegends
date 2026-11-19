# Glosario

Términos de Rift Legends y su vocabulario en inglés para el código. Los nombres sirven como referencia para los sistemas que aún están en desarrollo.

## Draft y meta

| Término | Inglés en el código | Significado |
| --- | --- | --- |
| Draft | draft | Fase previa a cada partida en la que ambos equipos eligen y bloquean campeones por turnos. |
| Elección (pick) | pick | Selección de un campeón para la composición del equipo. |
| Bloqueo (ban) | ban | Exclusión de un campeón para ambos equipos durante la partida que se está preparando. |
| Fearless | fearless draft | Regla de serie que impide a ambos equipos volver a elegir campeones que cualquiera de los dos ya haya jugado en esa serie. Los bans ordinarios se reinician en cada partida. |
| Lado azul | blue side | Lado que hace la primera elección del draft. |
| Lado rojo | red side | Lado que hace la última elección del draft. |
| Composición | team composition | Conjunto de campeones elegidos por un equipo y la forma en que encajan entre ellos. |
| Meta | meta | Campeones, composiciones y estrategias que predominan en un parche o entorno competitivo. |
| Tier | tier | Escalón de una clasificación, por ejemplo, la fuerza estimada de un campeón en el meta. |
| Pool de campeones | champion pool | Repertorio de campeones que un jugador puede usar en competición. |
| Comfort pick | comfort pick | Campeón que un jugador domina y con el que juega con confianza. |

## Competición

| Término | Inglés en el código | Significado |
| --- | --- | --- |
| Serie | series | Enfrentamiento entre dos equipos compuesto por una o más partidas. En una Bo1 vence quien gana 1 partida, en una Bo3 quien gana 2 y en una Bo5 quien gana 3. |
| Split | split | Tramo de una temporada competitiva con su propio calendario y clasificación. |
| Playoffs | playoffs | Fase de eliminatorias entre los equipos clasificados que decide el título o las plazas para otra competición. |
| Sistema suizo | Swiss | Fase por rondas que empareja a equipos con balances de victorias y derrotas similares, según las restricciones del torneo. |
| Play-in | play-in | Fase preliminar que adjudica plazas para la fase principal de un torneo. |
| Cabeza de serie | seed | Posición asignada a un equipo para ordenar el cuadro o determinar emparejamientos. |
| First Stand | First Stand | Torneo internacional que abre el calendario de eventos internacionales de la temporada. |
| MSI | Mid-Season Invitational (MSI) | Torneo internacional de mitad de temporada. |
| Worlds | World Championship (Worlds) | Campeonato mundial que cierra la temporada competitiva. |

## Carrera y simulación

| Término | Inglés en el código | Significado |
| --- | --- | --- |
| Carrera | career | Partida guardada en la que gestionas un equipo durante varias temporadas. Cada carrera tiene su propia base de datos SQLite. |
| Regen | regen | Jugador ficticio generado por la simulación que se incorpora al ecosistema competitivo con el paso de las temporadas. |
| Hecho | fact | Registro inmutable de algo ocurrido en la simulación, como el resultado de una serie. Se añade al historial de hechos de la carrera. |
| Proyección | projection | Vista derivada de los hechos, como una clasificación, un palmarés o unas estadísticas. |
| Semilla | seed | Valor inicial del generador pseudoaleatorio. Con el mismo estado inicial, la misma semilla y las mismas decisiones, la simulación reproduce los mismos resultados. |
| Desglose | breakdown | Detalle de los factores que explican un resultado simulado o una decisión de la IA. |
