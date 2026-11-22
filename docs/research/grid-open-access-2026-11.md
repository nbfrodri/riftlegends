# Riot Games Open Access powered by GRID

**Recomendación (#267, 22-11-2026). No incorporar GRID al pipeline de publicación del plan 11.** Mantener Leaguepedia como fuente del snapshot. Riot anuncia Worlds 2026 como primer evento y la documentación pública no acredita la temporada completa de las seis ligas ni el derecho a redistribuir sus datos. Si GRID confirma el uso por escrito, valorar una comprobación interna de resultados y estadísticas en CI, sin incorporar sus respuestas ni valores derivados al snapshot ni consultar la API desde la app.

## Acceso y límites

| Tema | Evidencia |
| --- | --- |
| Lanzamiento | El 17-11-2026 es la fecha del lanzamiento comunicada por la prensa. El anuncio de Riot del 12 indicaba el 14, y la ficha de GRID muestra «Launching 12 November 2026». [Inven Global](https://www.invenglobal.com/articles/28744/riot-games-and-grid-open-official-lol-and-valorant-esports-data-to-the-community-for-free) · [LoL Esports](https://lolesports.com/en-US/news/build-with-official-league-of-legends-esports-data) · [GRID](https://grid.gg/riot-open-access/). |
| Alta y coste | Cuenta en el portal de GRID, declaración de categoría y uso previsto, y generación de una clave propia. El acceso es gratuito para estudiantes, investigadores, aficionados y proyectos en fase temprana. El plan comercial tiene precio a medida. «You declare your category and intended use when you register.» [GRID](https://grid.gg/riot-open-access/). |
| API | GraphQL por HTTPS con cabecera `x-api-key`. Central Data Feed lista series y metadatos en `/central-data/graphql`. Series State consulta el estado por ID en `/live-data-feed/series-state/graphql`. La guía general de Open Access documenta el host `api-op.grid.gg`. «This gives you the final state of an ended series.» [Guía de GRID](https://grid.helpjuice.com/client-help/open-access-quickstart) · [Autenticación](https://docs.grid.gg/public/documentation/api-reference/getting-started/authentication). |
| Directo y pruebas | Riot anuncia cinco minutos de retraso en directo y acceso a Loopfeed, una serie de prueba que se repite. La oferta anunciada enumera Central Data y Series State con Loopfeed. La guía general excluye Series Events (WebSocket) y File Download. «Live series data is delayed by five minutes.» [LoL Esports](https://lolesports.com/en-US/news/build-with-official-league-of-legends-esports-data) · [Glosario de GRID](https://docs.grid.gg/public/documentation/api-documentation/getting-started/glossary) · [APIs de Open Access](https://grid.helpjuice.com/client-help/what-apis-does-an-open-access-developer-have-access-to). |
| Frecuencia | GRID publica para Open Access 20 peticiones/min en Central Data y, en Series State, 180 peticiones/min en total y 6 peticiones/min por serie. «Overall: 180 requests per minute» y «Per Series: 6 requests per minute». Falta confirmar su aplicación a la clave de Riot, si se cuentan por clave, cuenta o IP y qué devuelve la API al superarlos. [Límites de GRID](https://grid.helpjuice.com/rate-limits-for-products#open-access). |

## Datos y cobertura

| Dato | Qué se puede confirmar |
| --- | --- |
| Series y partidas terminadas | Central Data documenta la búsqueda de series por fechas con paginación. Series State documenta resultado y desglose por partida para series cubiertas. Riot solo identifica públicamente el primer evento. «Worlds 2026 will be the first event available through the portal.» Queda por verificar qué fases y partidas de Worlds incluye y cuánto tiempo se conservan. [LoL Esports](https://lolesports.com/en-US/news/build-with-official-league-of-legends-esports-data) · [Guía de GRID](https://grid.helpjuice.com/client-help/open-access-quickstart). |
| Estadísticas por jugador | GRID incluye LoL en la guía de estado final. El ejemplo desglosa bajas por jugador y partida. «All cumulative information about kills based on map/game/series can be found on the Series State API». Falta comprobar los campos y la completitud en Worlds, en especial asistencias, súbditos, oro, daño y visión. [Estado final de GRID](https://grid.helpjuice.com/en_US/client-help/how-to-get-information-about-the-final-state-of-a-mapgameseries). |
| Picks y bans | El ejemplo general de `draftActions` muestra vetos y elecciones de mapas de Counter-Strike. Queda sin confirmar si la clave de Riot devuelve picks y bans de campeones de LoL por partida, con orden y lado. [Ejemplo histórico de GRID](https://grid.helpjuice.com/en_US/client-help/what-historical-data-does-grid-offer-and-how-far-back-does-it-go). |
| Plantillas | Series State identifica a los participantes de la partida. Central Data documenta jugadores por equipo y roles. «To find players of a team, you need to use the Players query». Quedan sin confirmar las plantillas fechadas por split, los suplentes y los fichajes. [Jugadores por equipo](https://grid.helpjuice.com/how-can-i-get-players-of-a-team) · [Roles](https://grid.helpjuice.com/en_US/client-help/can-i-get-role-information-about-a-player-). |
| Coaches | Sin campo ni cobertura confirmados para entrenadores o staff en las fuentes públicas consultadas. Las plantillas del plan 11 siguen dependiendo de Leaguepedia. |
| Logos de equipo | El ejemplo de Central Data muestra `teams.baseInfo.logoUrl`. «The API uses `x-api-key` authentication». Quedan sin verificar los valores para LoL con esta clave y el permiso de mostrar, enlazar o redistribuir los logos. [Ejemplo de Central Data](https://grid.helpjuice.com/how-do-i-use-the-central-data-api?kb_language=en_US). |

| Liga | Riot Open Access y primera temporada | Lo que enumera Riot para distribución comercial |
| --- | --- | --- |
| LCK | Sin confirmar | Solo para medios |
| LPL | Sin confirmar | No figura en esa lista |
| LEC | Sin confirmar | Figura en la lista |
| LCP | Sin confirmar | No figura en esa lista |
| LCS | Sin confirmar | Figura en la lista |
| CBLOL | Sin confirmar | Figura en la lista |

La FAQ de Riot encuadra la lista comercial en la pregunta «Which LoL regions are currently available for commercial live data access?» y precisa «LCK data is available for media purposes only.» Los dos años de histórico que menciona GRID corresponden a su oferta general de datos históricos y carecen de desglose por liga en Riot Open Access. La fecha más antigua y la cobertura de los splits de 2026 siguen sin confirmar para las seis ligas. [Riot Esports Data](https://riotesportsdata.com/en-us/league-of-legends/) · [Histórico de GRID](https://grid.helpjuice.com/en_US/client-help/what-historical-data-does-grid-offer-and-how-far-back-does-it-go).

## Términos y redistribución

El enlace «Terms» de la ficha de GRID lleva a una página legible con un marcador de posición. «This route exists so internal links stay valid during the phased build.» Ese enlace no proporciona el acuerdo aplicable. Los términos del portal de desarrolladores de Riot, las condiciones de hackatones de GRID y el acuerdo beta de GRID de 2022 pertenecen a otras ofertas o versiones. [Términos enlazados por GRID](https://grid.gg/legal/terms-of-service/).

| Pregunta | Respuesta con las fuentes públicas |
| --- | --- |
| ¿Qué entiende por no comercial? | La ficha resume el propósito como «Non-commercial use: learning and experimentation» y excluye apuestas y juegos de azar. No publica una definición contractual que aclare el caso de un juego gratuito distribuido al público, las donaciones, el patrocinio o una monetización futura. [FAQ de GRID](https://grid.gg/riot-open-access/). |
| ¿Publicar datos crudos? | Sin permiso público verificado para subir respuestas, extractos o capturas a un repo público, ofrecer un JSON descargable o incluirlo en un binario gratuito. El paso por CI y el carácter privado del repo principal no cambian que las releases son públicas. [Términos enlazados](https://grid.gg/legal/terms-of-service/). |
| ¿Publicar datos derivados? | Sin permiso público verificado para tablas normalizadas, agregados, percentiles, atributos calculados o un snapshot que los mezcle con Leaguepedia. MIT/Apache-2.0 licencia el código propio. Para incluir datos de GRID hace falta confirmar sus derechos por separado, incluida la compatibilidad con CC BY-SA si se combinan en una adaptación. [Términos enlazados](https://grid.gg/legal/terms-of-service/) · [CC BY-SA 3.0, §4](https://creativecommons.org/licenses/by-sa/3.0/legalcode.en). |
| ¿Qué atribución exige? | Sin texto, formato, enlaces, ubicación ni posibles avisos obligatorios verificados para publicaciones o binarios. [Términos enlazados](https://grid.gg/legal/terms-of-service/). |
| ¿Se puede compartir la clave? | La referencia técnica indica «Don't share these with others, or upload to public spaces such as GitHub.» Falta confirmar si se permite una clave de proyecto para CI y cómo se autoriza a varios mantenedores. [Autenticación de GRID](https://docs.grid.gg/public/documentation/api-reference/getting-started/authentication). |
| ¿Qué pasa si se termina el acceso? | Sin cláusulas verificadas sobre causas, preaviso, revocación, retención o borrado de cachés, copias, artefactos y derivados. Tampoco se pudo confirmar qué ocurre con releases ya publicadas. [Términos enlazados](https://grid.gg/legal/terms-of-service/). |

**Leaguepedia.** La [verificación del plan 11](leaguepedia-2026-11.md) encontró partidas de 2026 en las seis ligas mediante Cargo. Para el contenido que la wiki puede licenciar, CC BY-SA 3.0 permite redistribución y uso comercial con atribución a los colaboradores, enlace a la licencia y aviso de cambios. Las adaptaciones se publican bajo la misma licencia o una admitida por ella. Los logos requieren comprobar los derechos de cada archivo. «Share — copy and redistribute the material in any medium or format for any purpose, even commercially.» [Derechos de Leaguepedia](https://lol.fandom.com/wiki/Leaguepedia:Copyrights) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/deed.en).

## Qué pedir a GRID

1. El acuerdo vigente para Riot Open Access y confirmación escrita de si la CI privada de un juego gratuito con releases públicas cumple el uso no comercial. Aclarar qué cambia con donaciones, patrocinio o una versión comercial.
2. Permiso explícito, por tipo de dato, para conservar respuestas en cachés privadas, publicar datos crudos o derivados en JSON, combinar datos con Leaguepedia bajo CC BY-SA 3.0 y empaquetarlos en releases gratuitas. Pedir créditos exactos, derechos de logos y obligaciones tras cancelar o perder acceso.
3. Clave de proyecto o servicio para CI, reglas para mantenedores y cuotas aplicables. Pedir la primera fecha, torneos y splits disponibles por cada liga, la retención y una muestra de estado final de LoL que permita comprobar draft, estadísticas, plantillas, staff y logos.

## Límites de la consulta

- El [registro de Riot GRID](https://riot.grid.gg/register) requiere JavaScript. No se pudo leer el formulario ni comprobar si presenta un acuerdo adicional durante el alta.
- El [índice público](https://docs.grid.gg/public/documentation), el [Playground](https://docs.grid.gg/public/documentation/graphql-playground), la [guía de Central Data](https://portal.grid.gg/documentation/api-documentation/static-data/data-feed-quick-start-guide), su [referencia](https://portal.grid.gg/documentation/api-reference/central-data-feeds/central-data-feed-api), la [guía de Series State](https://portal.grid.gg/documentation/api-documentation/in-game-data/series-state) y su [referencia](https://portal.grid.gg/documentation/api-reference/live-data-feed/api-reference-series-state-api) devolvieron «You need to enable JavaScript to run this app». Se contrastaron con los artículos accesibles de GRID. El proveedor indica que la [introspección GraphQL](https://grid.helpjuice.com/how-to-get-the-gql-api-documentation) requiere clave. La revisión se hizo sin cuenta, clave ni consultas autenticadas. El esquema efectivo y la cobertura de la clave de Riot quedan pendientes.
