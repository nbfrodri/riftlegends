# Datos de League of Legends, fuentes de assets y restricciones legales para Rift Legends (a 19-nov-2026)

> Notas de investigación, no asesoramiento legal. Los puntos marcados con **[revisión legal]** requieren un abogado de PI/derecho de imagen. Las fechas entre paréntesis son las de la fuente o la de consulta (2026-11-19) cuando la página no fecha su contenido.

## 1. Política de fans de Riot ("Legal Jibber Jabber") y Developer API Policies: ¿permiten un juego de fans?

### Takeaway
El texto vigente de Legal Jibber Jabber (fechado "agosto 2018", sin cambios visibles a 2026-11-19) **prohíbe expresamente usar la PI de Riot en juegos y apps**, citando como ejemplos apariencia de personajes, habilidades, mapas, iconos y objetos. Las Developer API Policies también dicen "Do not create or develop games utilizing Riot's IP". Para Rift Legends este es el riesgo legal central, por encima de las licencias de los datos. Que el juego sea gratuito y sin monetización no lo exime de esta cláusula.

### Cited Findings
- La página indica "Last Updated: August 2018". Riot concede una licencia revocable para proyectos gratuitos de fans, "strictly for noncommercial … community use", y puede denegar el uso de su PI en cualquier momento. — [Riot Games Legal (Legal Jibber Jabber), consultado 2026-11-19](https://www.riotgames.com/en/legal)
- Sección 3, "No unauthorized games or apps", cita literal: "We prohibit the use of our IP in games and apps. Please do not take any part of our IP (e.g., character appearance, character abilities, maps, icons, items, etc.) and use it in a game or app. To be super clear: we do not allow any Projects on the Apple Store or Google Play Store unless they have either a written license agreement from us or a valid Riot API key and comply with our API Terms and Policies". — [Riot Games Legal](https://www.riotgames.com/en/legal)
- Monetización (sección 2): los proyectos comerciales necesitan licencia escrita, incluido "any Project that crowdsources any portion of its funding", los que implican una entidad empresarial y los que tienen paywall. Hay tres excepciones: ingresos pasivos por anuncios, donaciones o suscripciones en streams, y proyectos de API con una clave válida que cumplan las API Policies. — [Riot Games Legal](https://www.riotgames.com/en/legal)
- Aviso obligatorio (sección 6): el proyecto "was created under Riot Games' 'Legal Jibber Jabber' policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project." — [Riot Games Legal](https://www.riotgames.com/en/legal); CommunityDragon muestra exactamente este aviso — [communitydragon.org](https://www.communitydragon.org/)
- Otras cláusulas: el proyecto debe ser original (sección 4), los logos y marcas de Riot no se pueden usar sin licencia escrita (sección 5), y Riot puede usar, modificar y distribuir cualquier proyecto compartido sin crédito ni pago (sección 7). — [Riot Games Legal](https://www.riotgames.com/en/legal)
- Developer API Policies: "Do not create or develop games utilizing Riot's Intellectual Property (IP)". Además, "Products cannot closely resemble Riot's games or products in style or function". Los productos deben registrarse y pasar auditoría en el Developer Portal, y deben mostrar un aviso visible: "isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved…". No se permite incrustar claves en binarios distribuidos. Los logos y marcas del Press Kit solo pueden usarse cuando sea inevitable. — [Riot Developer Policies (General)](https://developer.riotgames.com/policies/general)
- Las mismas políticas permiten usar los assets estáticos de Data Dragon en el desarrollo y el marketing de un producto registrado. — [Riot Developer Policies](https://developer.riotgames.com/policies/general); [Riot Developer Docs, LoL](https://developer.riotgames.com/docs/lol)
- Riot ya actuó contra un proyecto de fans. En abril de 2021 envió un cease-and-desist a **Chronoshift**, un servidor legacy emulado de LoL, alegando que "cannot permit unauthorized emulated services in any form, regardless of intent or purpose" y exigiendo entregar el código. El proyecto cerró, con polémica por supuesta "extorsión" que Riot negó. — [NME](https://www.nme.com/news/gaming-news/league-of-legends-fan-game-shut-down-by-riot-games-2930371); [Business Insider](https://www.businessinsider.in/A-League-of-Legends-fan-made-game-has-shut-down-after-developer-Riot-Games-issued-legal-threats/articleshow/82297663.cms); [Screen Rant](https://screenrant.com/league-legends-fan-made-legacy-project-shut-down/)
- Existen herramientas de draft de terceros que siguen activas: ProComps (Overwolf; se integra con el cliente de LoL, Prodraft y Draftlol), WeDraft (Overwolf; incluye modo Fearless), Drafter (web) y Draft Battle (juego web gratuito de draft de un desarrollador independiente). — [Overwolf ProComps](https://www.overwolf.com/app/procomps); [Overwolf WeDraft](https://www.overwolf.com/app/wedraft-wedraft); [Drafter](https://drafter-n0nu.onrender.com); [Product Hunt, Draft Battle](https://www.producthunt.com/products/draft-battle)
- Riot tiene su propio juego oficial de gestión, **LoL Esports Manager**, desarrollado por Riot y publicado por Tencent en China (beta abierta en julio de 2022). — [LoL Wiki](https://wiki.leagueoflegends.com/en-us/LoL_Esports_Manager); [Baidu Baike](https://baike.baidu.com/en/item/LOL%20Esports%20Manager/3334067); [ONE Esports](https://www.oneesports.gg/league-of-legends/mobile-game-lol-esports-manager-lpl-team/)

### Inferences
- La sección 3 parece cubrir literalmente un juego de escritorio que use nombres, iconos o splash de campeones. Que muchas herramientas de draft y estadísticas sigan activas sugiere tolerancia práctica, pero esa tolerancia no es un permiso, y Riot puede revocar la licencia en cualquier momento.
- La vía de la API key (registrar el producto) parece pensada para apps que consumen la API de Riot. La política de API prohíbe por separado crear juegos con PI de Riot, así que registrarse probablemente no legitima un juego. **[revisión legal]**
- Que Riot tenga un juego oficial del mismo género (LoL Esports Manager) aumenta el riesgo de que un juego de fans se vea como competencia o sustituto. Es una inferencia, no un hecho constatado.
- Hay alternativas que reducen el riesgo: campeones ficticios o genéricos, o un juego que no incluya assets ni nombres de Riot y permita al usuario importar los datos localmente desde Data Dragon o CommunityDragon. No he podido verificar la eficacia legal de ninguna. **[revisión legal]**

### Gaps
- No encontré una declaración pública de Riot (2024-2026) sobre juegos de gestión o simuladores de draft de fans en concreto, ni ningún caso de acción legal contra un simulador de draft o un manager de esports.
- No encontré cambios en Legal Jibber Jabber posteriores a 2018. No pude confirmar si hay versiones regionales distintas.
- No sé si Riot concede licencias escritas a proyectos de fans no comerciales ni cómo se solicitan.

## 2. Datos de campeones y assets: Data Dragon, CommunityDragon y Meraki

### Takeaway
Data Dragon es la fuente oficial de datos estáticos y de imágenes de campeones (iconos, splash, loading). Su uso está pensado para productos registrados, y los assets siguen siendo PI de Riot. CommunityDragon expone el contenido extraído del cliente, con más assets y algo de audio de draft, pero no publica licencia. Meraki publica datos derivados bajo licencia MIT en un CDN sin garantías. Ninguna de las tres cambia la titularidad de la PI de Riot.

### Cited Findings
- **Data Dragon**: es la fuente centralizada de Riot para datos y assets de campeones, objetos, runas, hechizos de invocador e iconos de perfil. Hay un tarball por parche (el más reciente a la fecha de consulta es `dragontail-16.23.1.tgz`). Patrones de URL: `ddragon.leagueoflegends.com/api/versions.json`, `/cdn/16.23.1/data/en_US/champion.json`, `/cdn/img/champion/splash/Aatrox_0.jpg` y `/cdn/img/champion/loading/Aatrox_0.jpg`. La actualización tras cada parche es manual y puede retrasarse, y puede haber varias builds por parche. — [Riot Developer Docs, LoL](https://developer.riotgames.com/docs/lol)
- **CommunityDragon**: declara 738 millones de peticiones y 30.500 GB servidos en 30 días. Muestra el aviso de Legal Jibber Jabber y no publica licencia, términos ni límites de peticiones. — [communitydragon.org](https://www.communitydragon.org/)
- Estructura de CommunityDragon: `raw.communitydragon.org/latest/` (más rutas versionadas y `pbe/`). JSON del cliente en `plugins/rcp-be-lol-game-data/global/default/v1/`, iconos en `.../v1/champion-icons/`, splash y loading en `.../assets/characters/{name}/skins/`. Sobre audio, incluye las líneas de voz de pick y ban, pero "Audio heard in-game, including champion voice lines, is not available". Riot reorganiza a veces los ficheros, así que conviene usar el JSON de datos básicos de campeón como referencia de rutas. El documento no menciona `cdn.communitydragon.org`. — [CommunityDragon Docs, assets.md](https://github.com/CommunityDragon/Docs/blob/master/assets.md)
- **Meraki Analytics (lolstaticdata)**: licencia MIT. Ofrece estadísticas, habilidades (más precisas que Data Dragon, según el propio README), skins y lore de campeones, además de datos de objetos. CDN: `cdn.merakianalytics.com/riot/lol/resources/latest/en-US/champions.json`. El README dice que el CDN lleva años sin caídas pero no promete disponibilidad, y pide cachear los datos en lugar de consultarlo repetidamente. El repositorio tiene 257 commits, 15 issues y 7 PR abiertos. — [GitHub meraki-analytics/lolstaticdata](https://github.com/meraki-analytics/lolstaticdata)

### Inferences
- La licencia MIT de Meraki cubre su código y, como mucho, su trabajo de compilación. Los nombres, textos e imágenes de campeones siguen siendo de Riot. Ninguna de las tres fuentes autoriza a redistribuir esos assets dentro de un juego. **[revisión legal]**
- Data Dragon da roles y clases a través de `tags` en champion.json. No he verificado si Meraki expone posiciones o atributos; la página de GitHub no lo menciona.
- Empaquetar los assets en el instalador equivale a redistribuirlos. Descargarlos al ejecutar el juego desde Data Dragon o CommunityDragon evita la redistribución directa, pero no la prohibición de usarlos en un juego. **[revisión legal]**

### Gaps
- No he verificado los términos ni la frecuencia de actualización del CDN de Meraki, ni si tiene datos de posiciones o roles.
- No hay licencia publicada para CommunityDragon. Su situación legal depende de la tolerancia de Riot.
- No hay sonidos de campeones en el juego (habilidades, voces) disponibles legalmente; CommunityDragon solo tiene las líneas de pick y ban.

## 3. Datos de esports: Leaguepedia, Oracle's Elixir, gol.gg, API no oficial de lolesports y otras

### Takeaway
Leaguepedia (Cargo API, CC BY-SA 3.0) es la fuente más completa para plantillas, equipos, ligas y torneos. Su licencia exige atribución y compartir igual, y el acceso anónimo está muy limitado. Oracle's Elixir sigue activo en 2026, aunque ha tenido incidentes. gol.gg y Liquipedia tienen datos de 2026, pero no hay API ni términos verificados para gol.gg. La API de lolesports no está documentada oficialmente.

### Cited Findings
- **Leaguepedia, licencia**: la página de documentación para desarrolladores indica CC BY-SA 3.0 salvo indicación contraria. Algunos proyectos de terceros citan 4.0, en contradicción con la wiki. — [Leaguepedia Category:Developer Documentation](https://lol.fandom.com/wiki/Category:Developer_Documentation); en contra: [GitHub ATorres02/rift-graphs](https://github.com/ATorres02/rift-graphs)
- Los datasets derivados de Leaguepedia piden atribución y mantener términos share-alike compatibles. — [Hugging Face, gptilt/lol-esports-entities](https://huggingface.co/datasets/gptilt/lol-esports-entities)
- **Límites de Leaguepedia**: el acceso anónimo a Cargo ronda 1 consulta por minuto según un post de lista de correo (~2025) o 1 cada 30-40 s según un README. Con cuenta bot o el permiso `apihighlimits` se pasa de 500 a 5000 filas por lote, y se recomienda `maxlag=5` con backoff ante 429. Según una fuente secundaria, el flag de bot se pide a un administrador de la wiki. — [Wikimedia mediawiki-api list](https://lists.wikimedia.org/hyperkitty/list/mediawiki-api@lists.wikimedia.org/thread/A6VWUYRHLGGJWZ3USGEBQJSDMX6A4YCM/); [GitHub fedeterpin/smurfeando](https://github.com/fedeterpin/smurfeando); [LoL Wiki Bots/Approvals](https://leagueoflegends.fandom.com/wiki/League_of_Legends_Wiki:Bots/Approvals)
- La página Help:Leaguepedia_API devolvió HTTP 402 en la consulta del 2026-11-19, así que no pude leer la documentación oficial. — [lol.fandom.com Help:Leaguepedia_API](https://lol.fandom.com/wiki/Help:Leaguepedia_API)
- **Oracle's Elixir** sigue activo en 2026:
  - Corrección de los datos de draft de 2026 (enero 2026).
  - Secuestro del DNS con una página de phishing durante unas horas (13-abr-2026).
  - Sin datos de LPL/LDL (27-jul-2026), restaurados con estadísticas más completas (11-ago-2026).
  - Un issue de terceros (octubre 2026) indica que las descargas CSV desde Google Drive fallaban y que su última partida disponible era del 2026-03-20. Es un único reporte secundario.
  — [Oracle's Elixir blog, "LPL Data is Back and Better"](https://oracleselixir.com/blog/post/14040/lpl-data-is-back-and-better); [Oracle's Elixir](https://oracleselixir.com/); [GitHub diegoaranab/leagueStats #17](https://github.com/diegoaranab/leagueStats/issues/17); [Kaggle mirror](https://www.kaggle.com/datasets/lauffing/oracles-elixir-league-of-legends-pro-play-data)
- **gol.gg** tiene la temporada S16 (2026), incluidos los playoffs de LCK 2026 y la Esports World Cup 2026, con listados de partidas por campeón. Algunas páginas aparecen tras un "Sign In". — [gol.gg](https://gol.gg/champion/champion-matchlist/120/season-S16/split-ALL/tournament-ALL/)
- **Liquipedia** tiene estadísticas de campeones por torneo de 2026, por ejemplo LIT 2026 Winter. — [Liquipedia LIT 2026 Winter](https://liquipedia.net/leagueoflegends/LIT/2026/Winter/Statistics)
- **API de lolesports**: es no oficial. La base es `https://esports-api.lolesports.com/persisted/gw` (endpoints como `getSchedule`). Hay una especificación OpenAPI no oficial de vickz84259. Algunos campos, como tournament_id, salen null en `getSchedule`. — [lolesports-api-docs (vickz84259)](https://vickz84259.github.io/lolesports-api-docs/); [@viriato/lol-esports-api README](https://cdn.jsdelivr.net/npm/@viriato/lol-esports-api@0.6.0/README.md); [Apify scraper](https://apify.com/jungle_synthesizer/lol-esports-worlds-2026-schedule-results-scraper)
- Hay datasets abiertos de la comunidad en Hugging Face (gptilt) y proyectos de pago como "lolesportsapi.com", que se anuncia como alternativa a Leaguepedia. — [GitHub gptilt/datasets](https://github.com/gptilt/datasets); [lolesportsapi.com](https://lolesportsapi.com/leaguepedia-api-alternative/)

### Inferences
- Si se empaquetan datos de Leaguepedia (aunque sean tablas transformadas), probablemente haya que atribuirlos y publicar ese dataset bajo CC BY-SA. Es discutible si los hechos puros (resultados, alineaciones) son protegibles y si la base de datos derivada arrastra la licencia al código del juego; en general, share-alike afecta al dataset, no al binario. **[revisión legal]**
- Un snapshot procesado offline encaja mejor con el principio de "contenido como datos" de IDEA.md que consultar en tiempo real, sobre todo con los límites de Leaguepedia y la fragilidad de Oracle's Elixir.

### Gaps
- No encontré la licencia ni los términos de uso de Oracle's Elixir; la página de descargas no devolvió contenido. No sé si permite redistribuir sus CSV.
- No encontré los términos de gol.gg ni si tiene una API.
- No verifiqué la licencia ni los términos de la API de Liquipedia (la petición devolvió 403).
- No verifiqué el estado de mwclient y mwrogue en 2025-2026.

## 4. Riot Developer API: tipos de clave y si un juego de escritorio la necesita

### Takeaway
Hay tres tipos de clave: de desarrollo (caduca cada 24 h y no puede usarse en productos públicos), personal (registro sin verificación, no puede usarse en público) y de producción (requiere revisión). Rift Legends no necesita la API de Riot para lo que describe IDEA.md, porque los datos estáticos y de esports no salen de ella. Registrar el producto no resolvería la prohibición de crear juegos.

### Cited Findings
- **Clave de desarrollo**: "deactivate every 24 hours" y "You may not maintain a public product with a development API key". — [Riot Developer Portal docs](https://developer.riotgames.com/docs/portal)
- **Clave personal**: pensada para "just the developer or a small private community". No permite uso público, ni siquiera en alphas o betas abiertas. Límite de 20 peticiones/s y 100 cada 2 min, sin acceso al Tournaments API. — [Riot Developer Portal docs](https://developer.riotgames.com/docs/portal)
- **Clave de producción**: para "large communities or the Internet as a whole", normalmente con prototipo previo. La revisa Developer Relations. Empieza en 500 peticiones/10 s y 30.000/10 min, y se aprueba una por producto. — [Riot Developer Portal docs](https://developer.riotgames.com/docs/portal); [Riot Developer Policies](https://developer.riotgames.com/policies/general)
- La documentación de Data Dragon no menciona datos de esports, y el Tournament API sirve para torneos en lobbies personalizados, no para datos pro. — [Riot Developer Docs, LoL](https://developer.riotgames.com/docs/lol)
- Las políticas prohíben incrustar claves en binarios distribuidos. — [Riot Developer Policies](https://developer.riotgames.com/policies/general)

### Inferences
- Data Dragon es público y no necesita clave. Un juego offline que solo use Data Dragon o CommunityDragon no necesita clave de la API de Riot.
- Si se quisiera una clave, solo la de producción permite distribución pública, y la propia política de API prohíbe los juegos con PI de Riot, así que la clave no parece una vía viable. **[revisión legal]**

### Gaps
- No encontré ningún caso de un juego de fans registrado y aceptado en el Developer Portal.

## 5. Nombre "Rift Legends": marcas y productos existentes

### Takeaway
**"Rift Legends" ya es el nombre de una liga oficial de LoL**: el ERL (European Regional League) de Polonia y Europa del Este, que sustituyó a Ultraliga desde enero de 2025 dentro del ecosistema de Riot. La coincidencia es exacta y en el mismo dominio, así que el riesgo de confusión es alto, más allá de la cercanía con Summoner's Rift, Wild Rift, Riftbound o Legends of Runeterra.

### Cited Findings
- Rift Legends sustituye a Ultraliga como ERL polaco. La operan GAM3RS_X y el streamer Nervarien, y debutó en enero de 2025 (primer split, 2025 Winter: 28-ene a 9-mar-2025). Según algunas fuentes cubre Polonia, Estonia, Lituania, Letonia, Ucrania, Israel y Georgia. — [Sheep Esports](https://www.sheepesports.com/en/all/articles/rift-legends-nervarien-takes-over-the-polish-erl/en); [Leaguepedia, Rift Legends](https://lol.fandom.com/wiki/Rift_Legends); [Liquipedia 2025 Spring](https://liquipedia.net/leagueoflegends/Rift_Legends/2025/Spring)
- La liga sigue activa en 2026, con splits Winter, Spring y Summer (Summer 2026: 4-ago a 19-sep-2026). — [Leaguepedia 2026 Summer](https://lol.fandom.com/wiki/Rift_Legends/2026_Season/Summer_Split); [Strafe](https://www.strafe.com/event/rift-legends-summer-2026-c221fa/)
- Riot usa "Rift" en varios productos: League of Legends: Wild Rift (anunciado el 15-oct-2019) y Riftbound, su juego de cartas coleccionables de LoL. — [Wikipedia, Wild Rift](https://en.wikipedia.org/wiki/League_of_Legends:_Wild_Rift); [Wikipedia, Riftbound](https://en.wikipedia.org/wiki/Riftbound)
- Existe un MMORPG sin relación llamado "Rift" (2011). — [Wikipedia, Rift](https://en.wikipedia.org/wiki/Rift_(video_game))
- La sección 5 de Legal Jibber Jabber prohíbe usar marcas de Riot sin licencia escrita. — [Riot Games Legal](https://www.riotgames.com/en/legal)

### Inferences
- Un juego de esports de LoL llamado "Rift Legends" podría confundirse con la liga oficial del mismo nombre, por ejemplo en búsquedas o al parecer un producto oficial de esa liga. Esto choca con el requisito de IDEA.md §11 de no aparentar ser oficial.
- La marca "Rift Legends" podría pertenecer al operador de la liga (GAM3RS_X), a Riot o a nadie. No consulté registros de marcas. **[revisión legal]**

### Gaps
- No consulté registros de marcas (EUIPO, USPTO, OEPM) para "Rift Legends" ni sus variantes.
- No encontré ningún videojuego publicado con ese nombre.

## 6. Nombres e imagen de jugadores reales frente a jugadores ficticios

### Takeaway
No encontré fuentes que traten específicamente el uso de nombres de jugadores profesionales de LoL en juegos de fans. El único manager de LoL con jugadores reales que encontré es el oficial de Riot y Tencent, que según una tienda de terceros tiene licencia de la LPL. El uso de nombres e imagen reales (derecho de imagen o right of publicity, y protección de datos personales en la UE) es una cuestión aparte de la política de Riot y necesita revisión legal.

### Cited Findings
- LoL Esports Manager se describe como "officially licensed esports management game" (Riot y Tencent). La afirmación de que tiene licencia oficial de la LPL para usar jugadores reales viene solo de una tienda de APK de terceros. — [Baidu Baike](https://baike.baidu.com/en/item/LOL%20Esports%20Manager/3334067); [Uptodown](https://league-of-legends-esports-manager.en.uptodown.com/android)
- Proyectos de fans gratuitos sí publican estadísticas de jugadores reales con datos de Leaguepedia, por ejemplo rift-graphs (estadísticas visuales de Worlds 2026) y smurfeando (récords de jugadores pro). — [GitHub ATorres02/rift-graphs](https://github.com/ATorres02/rift-graphs); [GitHub fedeterpin/smurfeando](https://github.com/fedeterpin/smurfeando)

### Inferences
- Publicar estadísticas, que es lo que hacen las webs de fans, no es lo mismo que convertir a jugadores reales en personajes de un juego con atributos, ofertas de fichaje y morales inventados. Lo segundo se parece más a lo que en juegos deportivos suele requerir licencias de asociaciones de jugadores. Es una inferencia por analogía, sin fuente específica de LoL. **[revisión legal]**
- Jugadores ficticios generados (regens), con la opción de que el usuario edite o importe nombres localmente, reducen la exposición. Los equipos y ligas reales también llevan marcas (de los clubes y de Riot), no solo los jugadores.

### Gaps
- No encontré cómo tratan esto otros managers no oficiales de esports, ni casos de reclamaciones de jugadores o equipos contra juegos de fans.
- No verifiqué juegos comerciales con jugadores ficticios (por ejemplo, Teamfight Manager) en esta sesión.

## 7. Estructura competitiva 2026 relevante para el contenido (ligas, formatos, fearless)

### Takeaway
En 2026 la LTA desapareció y volvieron la LCS y el CBLOL, cada una con una plaza de invitado de tier 2. Las plazas internacionales siguen el modelo de 2024 y se mantiene el Fearless Draft. No verifiqué los detalles del formato de First Stand 2026 ni de la LCP.

### Cited Findings
- Riot anunció el 28-sep-2025 la vuelta de la LCS y el CBLOL como ligas independientes para 2026. La LTA de 2025 fue su única temporada (campeón: FlyQuest). — [Wikipedia, 2025 LTA season](https://en.wikipedia.org/wiki/2025_LTA_season); [Esports Advocate](https://esportsadvocate.net/2025/09/riot-dismantles-lta-brings-back-lcs-and-cblol/); [GosuGamers](https://www.gosugamers.net/lol/news/77398-riot-games-announce-lcs-and-cblol-will-return-in-2026)
- La LCS cubre Norteamérica y Centroamérica, y el CBLOL cubre Brasil y el resto de Sudamérica. Cada liga tiene una plaza de invitado de tier 2 con ascenso y descenso. Plazas internacionales: First Stand 1 LCS y 1 CBLOL; MSI 2 LCS y 1 CBLOL; Worlds 3 LCS y 1 CBLOL. — [LTA North (X)](https://x.com/LTANorth/status/1972707974071329054); [Wikipedia, 2026 LCS season](https://en.wikipedia.org/wiki/2026_LCS_season); [Esports Advocate](https://esportsadvocate.net/2025/09/riot-dismantles-lta-brings-back-lcs-and-cblol/)
- Team Liquid Alienware ganó la LCS Summer 2026. — [Wikipedia, LCS](https://en.wikipedia.org/wiki/League_Championship_Series_(esports))
- El Fearless Draft se mantiene en 2026, según Chris Greeley en Worlds 2025 y sin cambios de reglas. Los campeones ya elegidos quedan bloqueados el resto de la serie y los bans se reinician en cada partida. — [Esports Insider (nov 2025)](https://esportsinsider.com/2025/11/fearless-draft-returns-league-of-legends-2026); [Spilled](https://spilled.gg/riot-games-keep-fearless-draft-league-legends-esports-2026); [LoL Esports, "fearless draft takes over 2025"](https://lolesports.com/en-US/news/fearless-draft-takes-over-2025/)

### Gaps
- No verifiqué el formato de First Stand, MSI y Worlds 2026 (Swiss, eliminatorias, número de equipos) ni la composición de la LCP en 2026.

## 8. Herramientas y librerías para obtener y convertir los datos

### Takeaway
Encontré y verifiqué clientes para Leaguepedia (TS) y para la API no oficial de lolesports (TS y R), además de herramientas de descarga para CommunityDragon. Para Data Dragon y Meraki basta con HTTP y JSON. No verifiqué en esta sesión el estado de librerías de Python como cassiopeia, riotwatcher o mwrogue.

### Cited Findings
- `poro` (npm): cliente TypeScript para la Cargo API de Leaguepedia, con tipos y soporte para joins y group by. — [GitHub pacexy/poro](https://github.com/pacexy/poro); [npm poro](https://npmjs.com/package/poro)
- `@viriato/lol-esports-api` (npm, v0.6.0): wrapper no oficial de la API de lolesports, con tipos basados en la especificación de vickz84259. — [README jsDelivr](https://cdn.jsdelivr.net/npm/@viriato/lol-esports-api@0.6.0/README.md)
- `lol-esports-api-module` (npm): otro wrapper de la API de lolesports. — [npm](https://npmjs.com/package/lol-esports-api-module)
- `rlolesports` (R): wrapper de la API de lolesports. — [rdrr.io](https://rdrr.io/github/flsck/rlolesports/f/README.md)
- `lolstaticdata` (Python, MIT): generador de los datos de Meraki. — [GitHub meraki-analytics/lolstaticdata](https://github.com/meraki-analytics/lolstaticdata)
- Herramientas de descarga para CommunityDragon: cd-dd y snip-snip. — [CommunityDragon assets.md](https://github.com/CommunityDragon/Docs/blob/master/assets.md)
- Ejemplo de pipeline ETL de esports de LoL. — [GitHub HerrKurz/Esports_Data_Pipeline](https://github.com/HerrKurz/Esports_Data_Pipeline)
- `kayn` (JS) y `lolapi` (Rust) son wrappers de la API de Riot, que Rift Legends probablemente no necesita. — [GitHub cnguy/kayn](https://www.github.com/cnguy/kayn); [docs.rs lolapi](https://docs.rs/crate/lolapi/0.5.0/source/README.md)

### Gaps
- No verifiqué en 2026 el estado de cassiopeia, riotwatcher, mwclient, mwrogue ni de los crates de Rust. Comprobar su actividad antes de adoptarlos.
