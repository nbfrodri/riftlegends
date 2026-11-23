# Plan 11 — Datos reales: Leaguepedia, campeones reales y atributos de jugadores

- **Estado:** aprobado (22-11-2026), troceado en #247–#253 y #265–#267.
- **Fase:** 3 · Pipeline de contenido real ([plan general](00-plan-general.md)).

## Objetivo

Jugar el draft rápido con **contenido real**: todos los campeones de LoL con sus retratos y todos los equipos de **LCK, LPL, LEC, LCP, LCS y CBLOL** con sus jugadores, coaches y logos. El contenido ficticio sigue siendo el modo sin red y el de los tests.

Queda fuera: ligas menores (plan 24), regens y evolución (plan 16), meta por parche (plan 18).

## Lista de tests

### Pipeline (`tools/data-pipeline`, solo en desarrollo)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| P1 | `pnpm data:snapshot` genera el snapshot JSON de las seis ligas desde Leaguepedia (equipos, plantillas, coaches y partidas de la temporada) | Con las respuestas grabadas (fixtures), dos ejecuciones dan bytes idénticos |
| P2 | Respeta la API: User-Agent propio sin datos personales, una petición a la vez, `maxlag` y reintentos con espera | Un 429 o `maxlag` espera y reintenta; tras N fallos se aborta sin escribir un snapshot a medias |
| P3 | Cada fichero lleva procedencia: fuente, fecha de consulta, licencia (CC BY-SA 3.0, la que declara Leaguepedia) y atribución | Falta la procedencia: la validación lo rechaza |
| P4 | Jugadores con varios equipos en la temporada quedan en el último; suplentes marcados | Jugador sin partidas: atributos por defecto de su rol y liga, marcados como estimados |
| P5 | El workflow semanal (y manual) descubre la temporada, regenera el contenido y resume el cambio de año en el PR | Sin cambios, no abre PR. Excluye exhibiciones, ascensos, descensos y clasificatorios. Espera a que jueguen las seis ligas |
| P5a | Al inicio de temporada, las partidas previas completan la muestra de atributos | A partir de 150 partidas de liga o 30 por jugador termina el refuerzo |

### Campeones reales

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| R1 | Cada campeón del juego tiene roles, tier, daño, curva de poder y arquetipos | Campeón nuevo sin partidas profesionales: roles y arquetipos de la tabla curada, tier por su perfil |
| R2 | Roles y tier salen de la presencia en partidas profesionales de la temporada y las dos anteriores (picks y bans por rol), más los roles curados (#321) | Rol con menos del 5 % de sus picks: solo cuenta si está en la tabla curada |
| R3 | Todos los campeones tienen counters a favor y en contra y sinergias: base de reglas con nombre mezclada con los datos pro según la muestra (#321) | Sin partidas: manda la regla; con muchas, el dato real |
| R4 | Los nombres y retratos salen de la caché en tiempo de ejecución, en el idioma de la UI | Sin caché: el modo real no está disponible y la UI lo explica |
| R5 | Nombres (ES y EN), retratos y clase de cada campeón salen de `champion-summary.json` de CommunityDragon | Campeón sin partidas pro ni entrada en la tabla curada: arquetipos por defecto según su clase |

#### Campeones reales: cómo se generan (#249)

`pnpm data:champions` (offline desde `packages/core/content/real/*.json`; solo descarga el `champion-summary.json` de CommunityDragon fijado en el parche 16.23, a la caché cruda) escribe `packages/core/content/real/champions/`: `champions.json`, `matchups.json`, `synergies.json` y `provenance.json`. Misma forma que los ficheros ficticios. `name` repite el id (no se guarda ningún nombre de Riot).

- **Lista:** los campeones jugables del catálogo (sin `None` ni variantes Jade): ids alias, clave numérica y clases.
- **Daño, curva, arquetipos, CC, movilidad y línea frontal:** [curated-champions.ts](../../tools/data-pipeline/curated-champions.ts), solo ids. Las entradas con `true` son dudosas y quedan en `estimated` de la procedencia. Sin entrada: valores por defecto según su clase, tier C y marca `classFallbacks` (R5).
- **Rol (R2):** los de pro (≥ 5 % de los picks ponderados por temporada) más los de la tabla curada. Se ordenan por presencia: el primero es el principal.
- **Tier (R2):** `presencia = 100 × (picks + bans) / partidas × (picks del rol / picks totales)` por temporada. Ver [base de reglas](#base-de-reglas-y-mezcla-con-los-datos-pro-321) para las temporadas y los cortes.
- **Matchups, counters y sinergias (R3):** base de reglas mezclada con los datos pro; ver la sección siguiente.
- **Determinismo:** orden estable por id; dos ejecuciones dan los mismos bytes.

#### Base de reglas y mezcla con los datos pro (#321)

Cada campeón tiene un **perfil** en [curated-champions.ts](../../tools/data-pipeline/curated-champions.ts) y sus **rasgos** en [champion-traits.ts](../../tools/data-pipeline/champion-traits.ts): alcance (melee, rango, largo), sustain (0–3), tipos de CC (punto y click, skillshot, área, knock-up), reparto de daño (físico, mágico y verdadero en %) y rasgos de kit (wombo, daño en área, disengage, enchanter, asedio, invasor, farmeo, anti-curación, escudos, daño a tanques, visión, duelista, skillshots lentos, anti-dash, anti-AP, anti-AD y ultimate de knock-up). Los estilos engage, poke, split y pick salen de los arquetipos. Los dudosos van en `estimated`.

Cada regla tiene un **id** que viaja en `reasons` para que la ficha explique el porqué. La ficha no dice de dónde sale el dato.

**Counters en línea** (mismo rol; A gana a B, y B pierde lo mismo):

| Regla | Puntos | Cuándo |
| --- | --- | --- |
| `range` | 2 | A tiene más alcance (no en jungla) |
| `pokeVsLowSustain` | 2 | A hace poke y B tiene sustain 0–1. Si depende de skillshots lentos, B necesita movilidad < 7 |
| `sustainVsPoke` | 2 | A tiene sustain ≥ 2, no hace poke, y B sí |
| `earlyVsScaling` | 3 | A es fuerte en early y B escala (late) |
| `mobilityVsSkillshots` | 3 | A tiene movilidad ≥ 7 y B depende de skillshots lentos |
| `lockdownVsDash` | 2 | A tiene CC de punto y click o anti-dash y B es melee con movilidad ≥ 7 |
| `antiHeal` | 2 | A aplica anti-curación y B tiene sustain 3 |
| `shieldVsPoke` | 1 | A da escudos y B hace poke |
| `shieldVsSustain` | 1 | A tiene escudo y B es un duelista con sustain alto |
| `tankShred` | 2 | A hace daño porcentual o verdadero y B tiene primera línea ≥ 8 |
| `resistVsDamage` | 3 | A es anti-AP y B hace ≥ 70 % mágico, o anti-AD y B ≥ 70 % físico |
| `splitDuel` | 2 | A es splitpusher duelista y B no es ni lo uno ni lo otro |
| `tankVsBurst` | 1 | A tiene primera línea ≥ 8 y B es asesino frágil (pick o dive, primera línea ≤ 3) |
| `invadeVsFarm` | 3 | Jungla: A invade en early y B farmea |
| `counterGank` | 1 | Jungla: A escaramucea sin ser late y B gankea (pick o engage) sin escaramucear |
| `visionVsPick` | 1 | A controla la visión y B vive de los picks |
| `engageVsEnchanter` | 2 | Soporte: A hace engage y B es enchanter |
| `enchanterVsPoke` | 1 | Soporte: A es enchanter y B hace poke |
| `pokeVsEngage` | 1 | Soporte: A hace poke sin engage y B hace engage |
| `projectileBlock` | 3 | A intercepta proyectiles y una parte importante del kit de B depende de ellos |

**Counters de equipo** (cualquier rol; mismo sentido):

| Regla | Puntos | Cuándo |
| --- | --- | --- |
| `assassinVsCarry` | 3 | A es asesino (pick o dive, movilidad ≥ 7, primera línea ≤ 4) y B es carry a distancia con movilidad ≤ 3 |
| `disengageVsEngage` | 2 | A tiene disengage y B entra en melee con engage |
| `peelVsDive` | 2 | A hace peel y B es asesino o diver melee |
| `aoeVsGrouped` | 1 | A hace daño en área y B es melee frágil que pelea encima (dive o escaramuza, primera línea ≤ 5). Varios rivales de ese perfil favorecen la misma respuesta |
| `engageVsPoke` | 2 | A hace engage con CC ≥ 7 y B hace poke con movilidad ≤ 3 |
| `lockdownVsCarry` | 1 | A tiene CC ≥ 8 de punto y click y B es hypercarry con movilidad ≤ 3 |
| `hookVsImmobile` | 3 | A tiene gancho y B juega a distancia, tiene movilidad ≤ 3 y primera línea ≤ 4 |
| `projectileBlock` | 2 | Como en línea |
| `resistVsDamage`, `tankShred`, `antiHeal`, `lockdownVsDash`, `visionVsPick` | 2, 1, 1, 1, 1 | Como en línea |

**Sinergias** (aliados en roles distintos):

| Regla | Puntos | Cuándo |
| --- | --- | --- |
| `wombo` | 3 | Kit con iniciación en área, o engage con CC ≥ 7 en área o knock-up, más daño en área aliado |
| `hypercarryPeel` | 3 | Hypercarry + peel o enchanter |
| `pokeSiege` | 2 | Poke + disengage o asedio |
| `chainCc` | 1 | Los dos con CC ≥ 7 |
| `knockupUlt` | 4 | Knock-up aliado + ultimate de Yasuo |
| `earlyDuo` | 2 | ADC y soporte fuertes en early |
| `scalingDuo` | 2 | ADC de late y soporte de late con peel o de tipo enchanter |
| `pickVision` | 2 | Pick + visión o CC de largo alcance |
| `splitPressure` | 2 | Splitpusher + asedio o disengage (1-3-1) |
| `damageMix` | 1 | Dos fuentes de daño, una ≥ 70 % física y la otra ≥ 70 % mágica |
| `diveTogether` | 1 | Los dos son divers |
| `enchanterDiver` | 2 | Enchanter + melee de dive o escaramuza |
| `frontToBack` | 1 | Tanque (primera línea ≥ 8) + carry a distancia |

**Mezcla.** `valor = round(p × pro + (1 − p) × regla)`, con `p = partidas / (partidas + 20)` y redondeo por magnitud. `pro` es el valor sin redondear de las partidas: `20 × victorias / partidas − 10` en matchups y `12 × victorias / partidas − 6` en counters de equipo y sinergias. Cada partida con ganador de la temporada actual aporta muestra. Los matchups requieren rivales del mismo rol y las sinergias usan parejas aliadas. Los counters de equipo mezclan solo rivales en roles distintos y con al menos una señal del kit. Topes de la base: ±6 para counters y 0–6 para sinergias. Se guardan valores distintos de cero. `reasons` lista las reglas que favorecen al campeón con ventaja, de más a menos puntos.

**Tier.** Media de presencia ponderada: temporada actual × 1, anterior × 0,5 y la de antes × 0,25, desde la primera temporada disponible con picks del campeón. Para las temporadas previas, Cargo devuelve los picks agrupados por campeón y rol y el total de partidas. Se estiman los bans previos con la proporción global bans/picks de la temporada actual. La media se mezcla con el perfil con peso `picks del rol / (picks del rol + 3)`, usando los pesos de temporada también para contar picks. El perfil aporta 0,5 de presencia a campeones con engage, peel, utilidad, tanque, pick, poke, dos roles curados o un nicho competitivo indicado en el kit. Aporta 0,1 al resto y 0,5 a perfiles sin revisar. Cortes: ≥ 70 S+, ≥ 45 S, ≥ 30 A, ≥ 10 B, ≥ 0,25 C, menos D. En modo offline se omiten temporadas históricas sin caché y se registran sus años en la procedencia.

**Mínimos** (test sobre el contenido generado): cada campeón tiene ≥ 1 rol, un tier, ≥ 3 counters a favor y ≥ 3 en contra frente a campeones distintos (línea y equipo), y ≥ 3 sinergias. No se añaden parejas sin señal para rellenar el mínimo.

### Jugadores y equipos

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| J1 | Los 20 atributos salen de estadísticas por rol y liga (percentiles) y de la trayectoria previa (#287), con una fórmula documentada por atributo | Muestra pequeña: el atributo se acerca a la media de su rol y liga |
| J2 | Ajuste por fuerza de liga: un percentil en LCK vale más que en LCS (coeficiente por liga, configurable) | Coeficientes en un solo fichero con su justificación |
| J3 | Pools de campeones (mains, secundarios y débiles) y maestría salen de lo jugado | Jugador con menos de 3 campeones: el resto del pool viene de su rol |
| J4 | Cada equipo tiene nombre, sembrado (por resultados de la temporada), coach y logo | Equipo sin coach en Leaguepedia: coach «sin nombre» con personalidad equilibrada |
| J5 | La personalidad del coach sale del estilo de draft del equipo (primeros picks, arquetipos y curva) | Pocas partidas: `balanced` |

### App

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| A1 | La configuración ofrece **ficticio** o **LoL real**; el real necesita la caché lista | Caché a medias o con error: real desactivado con el motivo en palabras |
| A2 | La configuración agrupa los equipos por liga | 60 equipos: el selector sigue siendo usable (búsqueda o grupos) |
| A3 | Retratos en draft, roles y resultados; logos de equipo con caída al escudo propio | Imagen que no carga: placeholder sin saltos |
| A4 | La calibración K1–K5 sigue en verde con el contenido real | Bandas revisadas solo si el contenido real lo justifica, con nota |
| A5 | E2E de una Bo5 con fearless hard en modo real con una caché de prueba | Sin red |
| A6 | Créditos visibles en Ajustes: Leaguepedia (CC BY-SA) y CommunityDragon | — |

## Diseño

- [Consultas, cobertura y licencia de Leaguepedia para 2026](../research/leaguepedia-2026-11.md).
- [Evaluación de Riot Games Open Access powered by GRID para la CI](../research/grid-open-access-2026-11.md).
- **Fuente única de esports: Leaguepedia** (API Cargo de `lol.fandom.com`). Tablas previstas: equipos, plantillas de torneo (jugadores y coaches), partidas y estadísticas por jugador y partida. No se usa Oracle's Elixir ni gol.gg mientras su licencia no esté clara.
- **Pipeline** en `tools/data-pipeline/` (Node + TypeScript, fuera del binario): descarga, guarda las respuestas crudas en una caché local fuera del repo, normaliza y escribe `packages/core/content/real/*.json` con procedencia. Los JSON van al repo (datos CC BY-SA; código MIT/Apache) con un `LICENSE` propio en esa carpeta.
- **Cambio de temporada (#288):** Cargo descubre los torneos por liga y año. El snapshot cambia de año al empezar las seis ligas y la ventana de trayectoria avanza con él. La temporada previa solo complementa los atributos de las ligas con poca muestra. [Filtros, umbrales y caché](../../tools/data-pipeline/README.md#cambio-de-temporada).
- **Sin texto ni arte de Riot en el repo:** el snapshot guarda ids de campeón; los nombres (ES y EN), retratos y clases salen de la caché del plan 10 (`champion-summary.json` de CommunityDragon). La tabla curada de arquetipos usa solo ids.
- **Logos de equipos:** nombre de archivo, URL resuelta y SHA-1 de Leaguepedia en el snapshot; se descargan en tiempo de ejecución al origen `leaguepedia` de la caché del plan 10.
- **Plantillas:** el historial conserva los equipos por torneo. La plantilla de temporada asigna cada jugador a su último equipo por partida y marca la suplencia por mayoría de partidas en su rol. Si el identificador de Leaguepedia incluye un desambiguador entre paréntesis, se sustituye por una huella para no publicar nombres reales.
- **Atributos:** cada uno con su fórmula en `tools/data-pipeline/attributes.ts` (por ejemplo, farming ← CS por minuto; visión ← puntuación de visión por minuto; agresividad ← participación en bajas temprana). Los de equipo y mentales (comunicación, shotcalling, temple) parten de la media del rol, ajustada por experiencia y resultados; se marcan como **estimados** en el perfil.
- **Fórmulas creíbles (#280):** cada atributo medido es la media ponderada de los percentiles (rol y liga, suavizados con 12 partidas) de varias métricas (`recipes` en `attributes.ts`; p. ej. peleas = KP, cuota de daño, muertes y asistencias). El percentil se lleva a una banda de **55–88** (centro 71,5), más los **puntos de liga** (LCK +4 · LPL +3 · LEC 0 · LCP −2 · LCS −3 · CBLOL −6) y los **resultados del equipo** (±3 a ±6 puntos según el atributo; los playoffs cuentan doble). Experiencia: partidas de la muestra frente a la media del rol. **Nivel:** media ponderada de los 20 atributos (peso 3 en los seis del rol, 1 en el resto), estirada ×1,25 sobre el centro. **Sembrado:** rating tipo Elo = prior de liga (LCK +150 · LPL +120 · LEC 0 · LCP −80 · LCS −110 · CBLOL −190) + 400·log10(w/(1−w)) con el % de victorias suavizado (12 partidas al 50 %, playoffs ×2); orden global por rating.
- **Jugadores y equipos (#250):** `pnpm data:content` genera `players.json`, `teams.json` y `provenance.json` desde el snapshot, sin red ([README del pipeline](../../tools/data-pipeline/README.md#jugadores-y-equipos)). Los atributos no medibles o basados en proxies van en `estimated`.
- **Contenido en el núcleo:** el mismo esquema del plan 10. `content_version` distinto por snapshot; los goldens siguen con el contenido ficticio.
- **Datos sin licencia clara, nunca:** si una tabla o campo no está bajo CC BY-SA, no entra.

## Decisiones del usuario (22-11-2026)

1. **Temporada:** la foto inicial cubre 2026 completa. A partir de #288, el pipeline descubre el siguiente año automáticamente.
2. **Nombres de campeón:** salen de la **caché** en ES y EN. El modo real exige haber descargado la caché una vez.
3. **Atributos no medibles** (comunicación, shotcalling, temple, resistencia mental): **estimados** desde la media del rol, ajustados por experiencia y resultados, y **marcados como estimados** en la UI.
4. **Coaches:** la personalidad sale del **estilo de draft** del equipo.
5. **Fuerza de liga:** coeficientes fijos y editables, LCK y LPL los más altos y CBLOL el más bajo.
6. **Actualización:** la app no consulta Leaguepedia; un workflow semanal regenera el snapshot y abre un PR, y los datos nuevos llegan con cada versión. Sin cuenta de Leaguepedia.
7. **Campeones:** CommunityDragon en lugar de Data Dragon para nombres, retratos y clases (se actualiza el mismo día del parche y trae la clase).
8. **Riot Open Access (GRID):** se estudian sus condiciones antes de usarlo; solo en el CI, nunca con una clave dentro de la app.

## Troceado en issues (Tarea de plan · milestone «Fase 3 — Pipeline de contenido real»)

| Orden | Issue | Test que lo cierra |
| --- | --- | --- |
| 1 | #247 · Verificar fuentes y licencias (Cargo: tablas, campos y límites) y grabar fixtures | Informe en `docs/research/` |
| 2 | #248 · Pipeline: cliente Cargo educado, caché cruda y snapshot reproducible con procedencia | P1–P4 |
| 3 | #249 · Campeones reales: roles, tier, arquetipos, matchups y sinergias | R1–R3 |
| 4 | #250 · Jugadores: atributos, pools y maestría; equipos, sembrado y coaches | J1–J5 |
| 5 | #251 · Modo real en la app: selector de contenido, nombres y retratos desde la caché, ligas | R4, A1–A3 |
| 6 | #252 · Logos de equipos en la caché (origen `leaguepedia`) | A3 |
| 7 | #253 · Calibración con contenido real, E2E Bo5 en modo real y créditos | A4–A6 |
| 8 | #265 · Campeones desde CommunityDragon: nombres, retratos y clases | R5 |
| 9 | #266 · Workflow semanal que regenera el snapshot con un PR | P5 |
| 10 | #267 · Condiciones de Riot Open Access (GRID) como segunda fuente | Informe en `docs/research/` |
| 11 | #288 · Cambio automático de temporada | P5, P5a |

## Riesgos

- **Límite de la API:** Cargo admite 6 consultas por minuto sin cuenta ([informe](../research/leaguepedia-2026-11.md#límites-y-política)); regenerar la temporada lleva varios minutos, nunca se hace en tiempo de ejecución.
- **Logos sin licencia abierta:** son marcas de sus dueños; solo se descargan en tiempo de ejecución, como el resto de assets de Riot, y nunca entran en el repo.
- **Disponibilidad de Leaguepedia** (cambios de esquema o límites): el snapshot va al repo, así que el juego no depende de la API; solo regenerarlo.
- **Atributos poco creíbles** para jugadores concretos: fórmulas documentadas, revisión de una muestra a mano y ajuste de coeficientes.
- **Legal:** Riot prohíbe usar su PI en juegos (riesgo ya asumido, [ADR 0001](../decisions/0001-stack-tecnologico.md)); los datos de la comunidad se atribuyen según su licencia.

## Catálogo de campeones en la app

- #265 usa `champion-summary.json` de CommunityDragon en `es_es` y `en_gb`. Selecciona los dos primeros parches distintos del listado de Data Dragon (por ejemplo, `16.23.1` → `16.23`). Si alguno de los dos catálogos del primer parche devuelve 404, prueba el anterior.
- Guarda `catalog/es.json` y `catalog/en.json` normalizados y sirve los retratos por alias en `rift-asset://cdragon/champions/<alias>.png`. El manifiesto comprueba tamaños y SHA-256 antes de activar el parche. Los iconos de rol y objetivos se descargan de `latest`, igual que los de estadísticas (KDA, oro, súbditos, daño y visión): el set SVG del marcador de fin de partida del cliente, que se sirve como `image/svg+xml` con `default-src 'none'` (#293).
- El renderer obtiene el catálogo bilingüe verificado con `window.riftlegends.assets.champions()`. Devuelve `null` mientras no haya un catálogo disponible.
- Los tests de R5 comprueban que se omiten las entradas no jugables y se rechazan los ids inválidos, los duplicados y los catálogos que no coinciden.

## Logos de equipos en la caché (#252, #284)

- **Origen de las URL:** la API web pública de lolesports.com (`getTeams`), consultada **solo por el pipeline** (`pnpm data:logos`, en desarrollo y CI; la app nunca la llama). Autorizado por el usuario el 22-11-2026. Los logos de Leaguepedia/Fandom devuelven 403 a clientes sin cabeceras de navegador y no se simulan.
- **Pipeline** ([logos.ts](../../tools/data-pipeline/logos.ts)): una petición a la vez, pausa de 1 s, `User-Agent: RiftLegendsDataPipeline/0.1`, sin redirects y respuestas crudas en la caché fuera del repo. Cada equipo del snapshot se empareja con su equipo de lolesports por liga y código (o nombre), prefiriendo los activos; si queda más de uno no se adivina. La tabla de alias cubre lo que no casa (Team Liquid). Descarga cada logo una vez para calcular SHA-256, tamaño y tipo (PNG, JPEG o WebP por magic bytes; máximo 512 KB) y escribe `packages/core/content/real/logos.json` (`provenance` y `logos: [{ team, url, sha256, size, mime }]`, ordenado). Los equipos sin logo se listan al ejecutarlo y la app usa el escudo propio. Nunca se commitean los bytes. Capturas en [fixtures/lolesports](../../tools/data-pipeline/fixtures/lolesports/README.md).
- **Resultado del 22-11-2026:** 60 de 60 equipos (CBLOL 8/8, LCK 10/10, LCP 8/8, LCS 8/8, LEC 12/12, LPL 14/14), todos en `static.lolesports.com`.
- **App:** origen `logos` en `userData/assets/logos/`, con su propio `manifest.json` (tamaño y SHA-256 por logo). La API de main es `syncTeamLogos(fuentes)` y `getTeamLogos()`; el renderer solo lee `window.riftlegends.assets.teamLogos()` (id de equipo → URL). Quien cargue el modo real (#251) llama a `syncTeamLogos` con las entradas de `logos.json` (`id` = `team`).
- Los datos de `logos.json` **no son de confianza**. Se rechaza todo logo que no cumpla ([real-logos.ts](../../packages/contracts/draft/real-logos.ts)): `https` y host exacto `static.lolesports.com` (ruta `/teams/<archivo>`) o `lolstatic-a.akamaihd.net` (ruta `/esports-assets/production/team/<archivo>`), sin credenciales, puerto, query ni fragmento; mime `image/png`, `image/jpeg` o `image/webp` (nunca SVG) con los magic bytes de ese formato; SHA-256 y tamaño iguales a los de `logos.json`; máximo 512 KB. Los redirects no se siguen y el transporte solo admite esos hosts de Riot. Un logo inválido se descarta y los demás continúan.
- La ruta local sale de un slug `[a-z0-9-]{1,64}` del id del equipo (nunca del nombre remoto). Los ids que chocan, vacíos o reservados en Windows llevan un hash del id. Se sirve en `rift-asset://logos/teams/<slug>.<png|jpg|webp>` solo si el manifiesto lo lista y el archivo aún coincide con su SHA-256.
- `TeamCrest` muestra el logo en la misma caja fija que el escudo propio y vuelve a él si falta o falla la carga.
- El campo `logo` de Leaguepedia del snapshot ya no lo lee nadie en la app.
