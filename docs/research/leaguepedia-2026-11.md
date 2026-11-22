# Leaguepedia para la temporada 2026

**Leaguepedia es viable como fuente única de esports del plan 11.** Cargo devuelve partidas de las seis ligas y permite enlazar plantillas, partidas, drafts y estadísticas. El 22-11-2026 verificamos esas relaciones con una muestra de la LCK. Antes de publicar el snapshot, P3 debe reflejar la licencia declarada por Leaguepedia, **CC BY-SA 3.0 Unported**. Los logos requieren comprobar sus derechos por separado.

Las [capturas y sus consultas](../../tools/data-pipeline/fixtures/leaguepedia/README.md) reproducen la muestra. [Special:CargoTables](https://lol.fandom.com/wiki/Special:CargoTables) respondió con un 403 de Cloudflare a este cliente. Verificamos el mismo catálogo con [`cargotables`](https://lol.fandom.com/api.php?action=cargotables&format=json&maxlag=5) y los esquemas con [`cargofields`](https://lol.fandom.com/api.php?action=cargofields&table=ScoreboardPlayers&format=json&maxlag=5).

## Tablas y campos útiles

| Tabla o consulta | Campos y uso | Tests del plan 11 |
| --- | --- | --- |
| `Tournaments` | `OverviewPage` enlaza el torneo. `Name`, `Year`, `League`, `Region`, `Split`, `DateStart`, `Date`, `TournamentLevel`, `IsQualifier`, `IsPlayoffs` e `IsOfficial` ayudan a delimitar y ordenar la temporada. | P1, P3, P4, J2, J4 |
| `Teams`, `TeamRedirects`, `TeamRenames` | `Teams.OverviewPage`, `Name`, `Short`, `Region`, `Image` y `RenamedTo`. Para alias, `TeamRedirects.AllName` y `OtherName`; para cambios, `TeamRenames.Date`, `OriginalName`, `NewName`, `IsSamePage` y `Slot`. | P1, P4, J2, J4 |
| `TournamentRosters` | Una fila de plantilla con `OverviewPage`, `Team`, `PageAndTeam` y `UniqueLine`. Alinear `RosterLinks`, `Roles` y `Flags` por posición separando por `;;`. `Flags` son países. Los coaches están en `Roles`. Revisar `Footnotes`, `IsUsed` e `IsComplete` para anotaciones y cobertura. | P1, P4, J4 |
| `TournamentPlayers` | Esquema con una fila por persona, `PageAndTeam`, `OverviewPage`, `Team`, `Link`, `Player`, `Role`, `N_PlayerInTeam`, `Flag` y `Footnote`. Candidato para leer plantillas por persona. | P1, P4, J4 |
| `ScoreboardGames` | `GameId`, `MatchId`, `OverviewPage`, `DateTime_UTC`, `N_GameInMatch`, `Team1`, `Team2`, `Winner` (1 o 2), `WinTeam`, `Team1Picks`, `Team2Picks`, `Team1Bans`, `Team2Bans`, `Patch`, `Gamelength` (minutos:segundos) y `Gamelength_Number` (minutos decimales). | P1, P4, R2, R3, J1, J4, J5 |
| `ScoreboardPlayers` | Unir por `GameId`; identificar fila por `GameRoleId`. `Link` identifica al jugador y `Name` sirve para mostrarlo. `Champion`, `Role`, `IngameRole`, `Team`, `Side`, `Kills`, `Deaths`, `Assists`, `CS`, `Gold`, `DamageToChampions`, `VisionScore`, `TeamKills` y `TeamGold`. Usar la duración de la partida para tasas por minuto. | P1, P4, R2, R3, J1, J2, J3 |
| `PicksAndBansS7` | `GameId`, `Team1`, `Team2`, `SwitchedSides` y columnas `Team1Pick1`–`Team1Pick5` y `Team2Pick1`–`Team2Pick5` para el orden de selección. También expone `Team1Ban1`–`Team1Ban5` y sus equivalentes del otro equipo. | P1, J5 |
| `TournamentResults` | Esquema con `OverviewPage`, `Team`, `PageAndTeam`, `Place`, `Place_Number`, `Phase`, `Date` y `Qualified`. El sembrado puede combinar resultados y clasificación. | J4 |
| `query+imageinfo` | Añadir `File:` a `Teams.Image`, pedir `prop=imageinfo&iiprop=url\|mime\|extmetadata&redirects=1` y leer `query.pages[pageid].imageinfo[0].url` y `descriptionurl`. Guardar la procedencia de ambos. | P3, J4, A3 |

## Límites y política

| Tema | Resultado |
| --- | --- |
| Filas por consulta | `paraminfo` de Leaguepedia declara 50 por defecto, 500 para clientes normales y 5000 con el permiso de límites altos. [Parámetros de Cargo](https://lol.fandom.com/api.php?action=paraminfo&modules=cargoquery&format=json&maxlag=5). |
| Paginación | `offset` empieza en 0. La captura con `offset=3` continúa la primera página de tres partidas con el mismo orden. Para el pipeline, usar un `order_by` con desempate único, incrementar el desplazamiento por filas devueltas y parar al acabar. Las ediciones entre páginas pueden mover filas. [API de Cargo](https://www.mediawiki.org/wiki/Extension:Cargo/Exporting_data#API). |
| Frecuencia (P2) | `userinfo&uiprop=ratelimits` anunció para `cargo-query` 6 peticiones por IP cada 60 s y 300 por 60 s para `anon`. Con peticiones espaciadas al menos 2 s observamos HTTP 200 con `error.code=ratelimited`, sin `Retry-After`. Usar una sola petición a la vez y al menos 11 s entre consultas Cargo. [Límites declarados](https://lol.fandom.com/api.php?action=query&meta=userinfo&uiprop=ratelimits&format=json&maxlag=5). |
| Reintentos (P2) | Enviar `maxlag=5`. Detectar también errores en el cuerpo de HTTP 200. Para 429, `ratelimited` y `maxlag`, respetar `Retry-After` si llega y aplicar espera creciente con tope. Tras agotar intentos, conservar el snapshot anterior. Durante la muestra observamos `ratelimited`; 429 y `maxlag` quedan para pruebas del cliente. [Manual de MediaWiki](https://www.mediawiki.org/wiki/Manual:Maxlag_parameter). |
| User-Agent (P2) | Todas las consultas directas usaron `RiftLegendsDataPipeline/0.1`, sin contacto ni datos personales. La API aceptó el identificador. MediaWiki recomienda un agente descriptivo; la muestra no establece una obligación adicional de Leaguepedia para Cargo. [Etiqueta de la API](https://www.mediawiki.org/wiki/API:Etiquette). |

## Licencia

| Material | Resultado |
| --- | --- |
| Datos de la wiki | **CC BY-SA 3.0 Unported** para el contenido que Leaguepedia puede licenciar. Coinciden la página de derechos, `siteinfo.rightsinfo` y la política general de Fandom. Mantener procedencia y atribución a los colaboradores. Usar esta versión para las capturas crudas y revisar P3 antes de fijar la licencia del snapshot. [Derechos de Leaguepedia](https://lol.fandom.com/wiki/Leaguepedia:Copyrights) · [Respuesta de siteinfo](https://lol.fandom.com/api.php?action=query&meta=siteinfo&siprop=rightsinfo&format=json&maxlag=5) · [Licencias de Fandom](https://www.fandom.com/licensing). |
| Logos | Fandom remite a la ficha de cada archivo para determinar sus derechos. El logo de T1 devuelve `extmetadata: []` para los campos de licencia y su ficha carece de texto de licencia. En este caso no se pudo confirmar una licencia abierta ni una declaración de uso legítimo. Los términos reservan las marcas de terceros a sus titulares; una URL accesible no concede permiso de uso. [Ficha del logo](https://lol.fandom.com/wiki/File:T1logo_profile.png) · [Licencias de Fandom](https://www.fandom.com/licensing) · [Términos de Fandom](https://www.fandom.com/terms-of-use). |

## Torneos de 2026 por liga

Cada sufijo de la tabla completa `OverviewPage = <liga>/2026 Season/<sufijo>`. El filtro por `League` necesita los nombres exactos de Cargo. El filtro inicial con las seis siglas devolvió cero filas.

| Liga | Valor exacto de `League` | Sufijos de `OverviewPage` para la competición principal | Filas en `ScoreboardGames` |
| --- | --- | --- | ---: |
| LCK | `LoL Champions Korea` | `Cup`, `Rounds 1-2`, `Road to MSI`, `Rounds 3-4`, `Season Play-In`, `Season Playoffs` | 502 |
| LPL | `Tencent LoL Pro League` | `Split 1`, `Split 1 Playoffs`, `Split 2`, `Split 2 Playoffs`, `Split 3`, `Grand Finals` | 675 |
| LEC | `LoL EMEA Championship` | `Versus Season`, `Versus Playoffs`, `Spring Season`, `Spring Playoffs`, `Summer Season`, `Summer Playoffs` | 383 |
| LCP | `League of Legends Championship Pacific` | `Split 1`, `Split 1 Playoffs`, `Split 2`, `Split 2 Playoffs`, `Split 3` | 283 |
| LCS | `League of Legends Championship Series` | `Lock-In`, `Spring Season`, `Spring Playoffs`, `Summer Season`, `Summer Playoffs` | 260 |
| CBLOL | `Circuit Brazilian League of Legends` | `Cup`, `Split 1`, `Split 1 Playoffs`, `Split 2`, `Split 2 Playoffs` | 275 |

Todas las páginas de la tabla tienen filas en `ScoreboardGames`. Los recuentos miden cobertura en Cargo. La comprobación de estadísticas completas por partida se hizo solo para las tres de la muestra.

La búsqueda ampliada encontró `LPL/2026 Season/Regional Finals` bajo `World Championship`, con 12 partidas. Conviene decidir si se incluye esa clasificatoria. `LCP/2026 Season/Promotion` y las dos promociones de LTA (`LTA North/2026 Season/Promotion` y `LTA South/2026 Season/Promotion`) empezaron en 2025. También aparecen `LCK 2026 Season Opening` con `League` vacío y exhibiciones como `CBLOL/2026 Season/Split 2 Playoffs/Showmatch` dentro de la liga y con `IsOfficial=1`. Mantener una lista explícita de páginas por temporada.

## Problemas y decisiones para #248

| Problema | Recomendación |
| --- | --- |
| Identificadores de campeón | Cargo devolvió `Wukong` en `ScoreboardPlayers.Champion`. Su id en Data Dragon es `MonkeyKing`. Data Dragon muestra `Nunu & Willump` con id `Nunu`; las variantes consultadas de Nunu no devolvieron partidas en el conjunto filtrado de 2026. Cruzar con `name` del catálogo EN, resolver excepciones con alias explícitos y registrar los nombres sin correspondencia. Guardar el `id` de Data Dragon en el snapshot. [Catálogo de Data Dragon consultado](https://ddragon.leagueoflegends.com/cdn/16.23.1/data/en_US/champion.json). |
| Coaches, suplentes y fichajes | La muestra de T1 tiene tres entradas `Coach` y marca `IsComplete` como `"0"`. En las diez plantillas de `Rounds 1-2` hay roles repetidos (p. ej. dos `Jungle` para Dplus Kia) con `Footnotes` e `IsUsed` vacíos. El esquema no expone `IsSub`. Mantener la suplencia como desconocida si faltan indicios. Para el último equipo, combinar la cronología de plantillas y partidas con desempate fijo. Si falta coach, usar el definido en J4. |
| Alias de equipos y lados | Resolver nombres históricos mediante redirecciones y cambios fechados, conservando el texto original en la caché. En la muestra, `Team1` de `PicksAndBansS7` puede ser `Team2` de `ScoreboardGames` para el mismo `GameId`. Emparejar por equipo y consultar `SwitchedSides`. |
| Orden y valores vacíos | Los picks de `ScoreboardGames` se agrupan por rol en la muestra. Usar la tabla de draft para J5. Cargo devuelve números como cadenas y ausencias como `""`. Los nombres de columna con guion bajo pueden aparecer con espacio en JSON, como `DateTime UTC` y `Gamelength Number`. Fijar aliases y validar ausencias sin convertirlas en ceros. |
| Cobertura de estadísticas | Medir filas, campos vacíos y uniones por torneo. Derivar tasas con `Gamelength`; `ScoreboardPlayers.Time` llega vacío en la muestra. Las bajas son totales de partida y los bans no llevan rol. Tratar los atributos sin observación directa como estimados y usar el rol de los picks para R2. |
| Reproducibilidad | Guardar consultas y respuestas crudas en caché. Ordenar el resultado normalizado por claves estables, fijar la fecha de consulta de la caché y escribir el snapshot solo al terminar la validación. Comprobar P1 con dos ejecuciones sin red y P2 con la captura de `ratelimited`. |
