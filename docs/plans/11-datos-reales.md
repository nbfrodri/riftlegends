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
| P5 | Un workflow semanal (y manual) regenera el snapshot y abre un PR si algo cambia | Sin cambios: no abre PR; nunca fusiona solo |

### Campeones reales

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| R1 | Cada campeón del juego tiene roles, tier, daño, curva de poder y arquetipos | Campeón nuevo sin partidas profesionales: roles y arquetipos de la tabla curada, tier C |
| R2 | Roles y tier salen de la presencia en partidas profesionales de la temporada (picks y bans por rol) | Rol con menos del 5 % de sus picks: no cuenta como posición |
| R3 | Matchups y sinergias solo con muestra mínima | Por debajo de la muestra: no se generan (no inventamos datos) |
| R4 | Los nombres y retratos salen de la caché en tiempo de ejecución, en el idioma de la UI | Sin caché: el modo real no está disponible y la UI lo explica |
| R5 | Nombres (ES y EN), retratos y clase de cada campeón salen de `champion-summary.json` de CommunityDragon | Campeón sin partidas pro ni entrada en la tabla curada: arquetipos por defecto según su clase |

#### Campeones reales: cómo se generan (#249)

`pnpm data:champions` (offline desde `packages/core/content/real/*.json`; solo descarga el `champion-summary.json` de CommunityDragon fijado en el parche 16.23, a la caché cruda) escribe `packages/core/content/real/champions/`: `champions.json`, `matchups.json`, `synergies.json` y `provenance.json`. Misma forma que los ficheros ficticios. `name` repite el id (no se guarda ningún nombre de Riot).

- **Lista:** los campeones jugables del catálogo (sin `None` ni variantes Jade): ids alias, clave numérica y clases.
- **Daño, curva, arquetipos, CC, movilidad y línea frontal:** [curated-champions.ts](../../tools/data-pipeline/curated-champions.ts), solo ids. Las entradas con `true` son dudosas y quedan en `estimated` de la procedencia. Sin entrada: valores por defecto según su clase, tier C y marca `classFallbacks` (R5).
- **Rol (R2):** el rol cuenta con ≥ 5 % de los picks del campeón (picks sin rol resoluble no cuentan para ningún rol). Sin picks suficientes: roles de la tabla curada.
- **Tier (R2):** `presencia = 100 × (picks + bans) / partidas × (picks del rol / picks totales)`. Los bans no llevan rol, así que se reparten según los picks. Cortes: ≥ 70 S+, ≥ 45 S, ≥ 30 A, ≥ 10 B, ≥ 1 C, menos D.
- **Matchups (R3):** mismo rol, cara a cara, partidas con ganador. `valor = round(20 × victorias / partidas − 10)` (−10 a 10), simétrico.
- **Sinergias (R3):** parejas aliadas en la misma partida. `valor = max(0, round(12 × victorias / partidas − 6))` (0 a 6).
- **Muestra mínima:** 20 partidas (`--min-sample`). Por debajo no se genera nada.
- **Determinismo:** orden estable por id; dos ejecuciones dan los mismos bytes.

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
- **Sin texto ni arte de Riot en el repo:** el snapshot guarda ids de campeón; los nombres (ES y EN), retratos y clases salen de la caché del plan 10 (`champion-summary.json` de CommunityDragon). La tabla curada de arquetipos usa solo ids.
- **Logos de equipos:** nombre de archivo, URL resuelta y SHA-1 de Leaguepedia en el snapshot; se descargan en tiempo de ejecución al origen `leaguepedia` de la caché del plan 10.
- **Plantillas:** el historial conserva los equipos por torneo. La plantilla de temporada asigna cada jugador a su último equipo por partida y marca la suplencia por mayoría de partidas en su rol. Si el identificador de Leaguepedia incluye un desambiguador entre paréntesis, se sustituye por una huella para no publicar nombres reales.
- **Atributos:** cada uno con su fórmula en `tools/data-pipeline/attributes.ts` (por ejemplo, farming ← CS por minuto; visión ← puntuación de visión por minuto; agresividad ← participación en bajas temprana). Los de equipo y mentales (comunicación, shotcalling, temple) parten de la media del rol, ajustada por experiencia y resultados; se marcan como **estimados** en el perfil.
- **Fórmulas creíbles (#280):** cada atributo medido es la media ponderada de los percentiles (rol y liga, suavizados con 12 partidas) de varias métricas (`recipes` en `attributes.ts`; p. ej. peleas = KP, cuota de daño, muertes y asistencias). El percentil se lleva a una banda de **55–88** (centro 71,5), más los **puntos de liga** (LCK +4 · LPL +3 · LEC 0 · LCP −2 · LCS −3 · CBLOL −6) y los **resultados del equipo** (±3 a ±6 puntos según el atributo; los playoffs cuentan doble). Experiencia: partidas de 2026 frente a la media del rol. **Nivel:** media ponderada de los 20 atributos (peso 3 en los seis del rol, 1 en el resto), estirada ×1,25 sobre el centro. **Sembrado:** rating tipo Elo = prior de liga (LCK +150 · LPL +120 · LEC 0 · LCP −80 · LCS −110 · CBLOL −190) + 400·log10(w/(1−w)) con el % de victorias suavizado (12 partidas al 50 %, playoffs ×2); orden global por rating. El histórico anterior a 2026 no está en el snapshot.
- **Jugadores y equipos (#250):** `pnpm data:content` genera `players.json`, `teams.json` y `provenance.json` desde el snapshot, sin red ([README del pipeline](../../tools/data-pipeline/README.md#jugadores-y-equipos)). Los atributos no medibles o basados en proxies van en `estimated`.
- **Contenido en el núcleo:** el mismo esquema del plan 10. `content_version` distinto por snapshot; los goldens siguen con el contenido ficticio.
- **Datos sin licencia clara, nunca:** si una tabla o campo no está bajo CC BY-SA, no entra.

## Decisiones del usuario (22-11-2026)

1. **Temporada:** la foto de datos cubre **2026 completa** (todos los splits); se regenera con un comando.
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

## Riesgos

- **Límite de la API:** Cargo admite 6 consultas por minuto sin cuenta ([informe](../research/leaguepedia-2026-11.md#límites-y-política)); regenerar la temporada lleva varios minutos, nunca se hace en tiempo de ejecución.
- **Logos sin licencia abierta:** son marcas de sus dueños; solo se descargan en tiempo de ejecución, como el resto de assets de Riot, y nunca entran en el repo.
- **Disponibilidad de Leaguepedia** (cambios de esquema o límites): el snapshot va al repo, así que el juego no depende de la API; solo regenerarlo.
- **Atributos poco creíbles** para jugadores concretos: fórmulas documentadas, revisión de una muestra a mano y ajuste de coeficientes.
- **Legal:** Riot prohíbe usar su PI en juegos (riesgo ya asumido, [ADR 0001](../decisions/0001-stack-tecnologico.md)); los datos de la comunidad se atribuyen según su licencia.

## Catálogo de campeones en la app

- #265 usa `champion-summary.json` de CommunityDragon en `es_es` y `en_gb`. Selecciona los dos primeros parches distintos del listado de Data Dragon (por ejemplo, `16.23.1` → `16.23`). Si alguno de los dos catálogos del primer parche devuelve 404, prueba el anterior.
- Guarda `catalog/es.json` y `catalog/en.json` normalizados y sirve los retratos por alias en `rift-asset://cdragon/champions/<alias>.png`. El manifiesto comprueba tamaños y SHA-256 antes de activar el parche. Los iconos de rol y objetivos se descargan de `latest`.
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
