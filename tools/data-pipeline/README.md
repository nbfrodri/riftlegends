# Snapshot de datos reales

Desde la raíz, con las dependencias del repositorio instaladas:

```sh
mise exec -- pnpm data:snapshot
mise exec -- pnpm data:snapshot --offline
```

El comando escribe un JSON por liga en `packages/core/content/real/`, tras validar las seis ligas. Descubre los torneos principales con Cargo y usa el catálogo EN de Data Dragon fijado en [scope.ts](scope.ts). Descarga datos y metadatos de los logos. Los logos de la app salen de `data:logos`.

## Cambio de temporada

[season.ts](season.ts) consulta los torneos de las seis ligas por `League` y `Year` (año UTC) y cuenta las partidas agrupadas por torneo. Entran los torneos oficiales de nivel principal, con fecha de inicio en ese año y alguna partida. Se excluyen exhibiciones, ascensos, descensos y clasificatorios externos. [season-exceptions.ts](season-exceptions.ts) permite corregir páginas concretas si Cargo las clasifica mal.

El snapshot pasa al año nuevo cuando las seis ligas han disputado al menos una partida válida. Hasta entonces se conserva la temporada anterior. Los equipos y plantillas se reconstruyen a partir de los torneos seleccionados, incluidas las altas, bajas y cambios de nombre.

Mientras una liga tenga menos de **150 partidas**, cada jugador de su plantilla puede completar una muestra de **30 partidas** con las más recientes de la temporada anterior en esa liga. La mezcla solo alimenta los atributos. Las consultas de los marcadores previos se guardan en la caché de temporadas cerradas y comparten el límite de Cargo con el resto del pipeline.

| Opción | Uso |
| --- | --- |
| `--offline` | Lee solo la caché y aborta si falta una respuesta. La fecha de cada consulta viene de la caché, así que esos mismos datos dan los mismos bytes. |
| `--cache-dir <ruta>` | Usa una carpeta fuera del repositorio. También se puede indicar con `RIFT_LEGENDS_DATA_CACHE`. La ruta por defecto es `$XDG_CACHE_HOME/rift-legends/data-pipeline` o `~/.cache/rift-legends/data-pipeline`. |
| `--max-attempts <n>` | Número máximo de intentos por petición recuperable. Por defecto, 5. |

Para consultar datos nuevos, usa una caché vacía. En una descarga completa hay al menos 11 s entre peticiones Cargo, con páginas de hasta 500 filas. Los fallos recuperables esperan con retroceso exponencial de hasta 120 s o el `Retry-After` si es mayor. El tiempo de descarga depende de esa espera y de la API.

Los JSON separan el historial de plantillas de `seasonPlayers`, que asigna cada jugador a su último equipo por fecha e ID de partida. Sin partidos, se usa la última plantilla por fecha de torneo. `sub` indica que el jugador no inició más de la mitad de las partidas del equipo en ese rol. Los IDs de Leaguepedia con paréntesis conservan el handle y sustituyen el desambiguador por una huella, ya que puede incluir el nombre real. Los IDs que solo difieren en mayúsculas (o en el desambiguador) y comparten equipo se fusionan en uno ([canonical-players.ts](canonical-players.ts)): gana la variante con más partidas y, en empate, la primera por orden léxico. En los drafts, `null` indica un hueco, y `draftOrder: false` identifica listas de marcador cuyo orden de selección se desconoce.

## Jugadores y equipos

```sh
mise exec -- pnpm data:content
```

Lee solo los JSON de `packages/core/content/real/` (sin red) y escribe `players.json`, `teams.json` y `provenance.json` en la misma carpeta, con la forma del contenido ficticio. Los equipos de cada liga son los que jugaron su **último split** o **más de la mitad de los splits** regulares de la temporada (sin playoffs, play-ins, «Road to» ni Grand Finals), así que los invitados de un solo split quedan fuera (LEC: Los Ratones y Karmine Corp Blue). Un equipo que cambia de nombre conserva su ID. Sus jugadores siguen en los snapshots y el historial, pero no forman plantilla. [league-members.ts](league-members.ts) tiene la lista de excepciones (`include` y `exclude` por liga e ID de equipo). Dos ejecuciones dan los mismos bytes; un test comprueba que los ficheros del repo están al día.

| Pieza | Dónde | Resumen |
| --- | --- | --- |
| Atributos (J1, P4) | [attributes.ts](attributes.ts) | Cada atributo medible sale del percentil de una métrica por minuto dentro de su rol y liga, con 12 partidas previas que acercan las muestras pequeñas a la media (65). Los que no se miden (temple, resistencia, concentración, shotcalling, comunicación) y los proxies parten de esa media, ajustada por experiencia y resultados; van en `estimated`. Sin partidas: todo estimado |
| Trayectoria (J1) | [career.ts](career.ts), [history.ts](history.ts) | `history.json` guarda, por jugador del snapshot, una fila por temporada previa: partidas en ligas principales, eventos internacionales jugados (Worlds, MSI, First Stand), títulos de liga e internacionales. `careerStrength` suma por temporada (partidas/80 con tope 1 + 0,5 por evento + 1 por título + 2 por título internacional), la pondera 0,85 por cada año de antigüedad y satura como p/(p+4). Esa fuerza (0–1) suma hasta +20 a experiencia, +6 a temple, +5 a resistencia, +4 a constancia y cierra hasta la mitad de la distancia entre el nivel y el techo de 94 (los atributos con trayectoria no pasan de 95). Sin historial, nada cambia |
| Fuerza de liga (J2) | [league-strength.ts](league-strength.ts) | Puntos de liga para los atributos (LCK +4 · LPL +3 · LEC 0 · LCP −2 · LCS −3 · CBLOL −6) y prior Elo para el sembrado global (LCK +150 … CBLOL −190), editables; ver [plan 11](../../docs/plans/11-datos-reales.md) |
| Pools y maestría (J3) | [player-team-content.ts](player-team-content.ts) | Mains: el más jugado y los de ≥3 partidas y ≥20 %. Con menos de 3 campeones, el resto sale de los más jugados del rol (maestría 30) |
| Equipos (J4) | [player-team-content.ts](player-team-content.ts) | Sembrado global: % de victorias suavizado (6 victorias y 6 derrotas previas) por la fuerza de su liga. Coach: el head coach de su última plantilla; sin coach, «—» y `balanced`. Roles sin jugador: relleno con `placeholder` y todo estimado |
| Coach (J5) | [coach-style.ts](coach-style.ts) | Personalidad = la señal de draft que más sube sobre la media de su liga (mínimo 8 drafts con orden conocido; si no, `balanced`). Usa una tabla mínima de arquetipos (TODO #249) |

Los valores que el snapshot no mide quedan por defecto: química 40–80 según partidas juntos, estrategia equilibrada, adaptación 50 y valoración de coach 2,5.

Datos de los colaboradores de Leaguepedia, **CC BY-SA 3.0 Unported**. El [aviso de licencia](../../packages/core/content/real/LICENSE) explica la atribución. Las [capturas de prueba](fixtures/leaguepedia/README.md) se completan con filas y respuestas sintéticas etiquetadas en los tests.

## Trayectoria de los jugadores

`pnpm data:snapshot` también escribe `packages/core/content/real/history.json` para los siete años anteriores a la temporada del snapshot. La ventana avanza con la temporada y consulta tres agregados por año con `GROUP BY` (partidas por jugador, eventos internacionales y títulos). La caché de años cerrados va aparte (`RIFT_LEGENDS_HISTORY_CACHE`, por defecto `<caché>/history`). El workflow restaura la última y guarda una nueva cuando incorpora consultas. La caché sustituye los desambiguadores personales por huellas y el historial publicado contiene solo los IDs de los jugadores del snapshot.

## Nacionalidad

`pnpm data:snapshot` guarda `nationalities.json` junto a las ligas. Consulta la tabla `Players` de Leaguepedia para quienes aparecen en los marcadores o en las plantillas de los torneos del snapshot. Usa la misma caché, paginación y espera de Cargo. Solo guarda IDs del snapshot y conserva la huella de los desambiguadores.

`pnpm data:content` cruza ese fichero por ID y añade `nationality` a `players.json` cuando hay un código válido. Para actualizar ambos ficheros, ejecuta desde la raíz:

```sh
mise exec -- pnpm data:snapshot && mise exec -- pnpm data:content
```

## Logos de equipos

```sh
mise exec -- pnpm data:logos
mise exec -- pnpm data:logos --offline
```

Lee los equipos de los JSON del snapshot, los empareja con la API web pública de lolesports.com (`getTeams`) y escribe `packages/core/content/real/logos.json` con la URL, el SHA-256, el tamaño y el tipo de cada logo. Acepta las mismas opciones y la misma caché que `data:snapshot`. Pausa de 1 s entre peticiones, sin redirects. Los equipos sin logo se listan en la salida. Los bytes de los logos no se guardan. Detalles y capturas: [plan 11](../../docs/plans/11-datos-reales.md#logos-de-equipos-en-la-caché-252-284) y [fixtures/lolesports](fixtures/lolesports/README.md).

## Fotos de jugadores

```sh
TMPDIR=/home/phobos/.cache/rift-tmp mise exec -- pnpm data:photos
```

Ejecuta el comando desde la raíz con acceso a los servidores de Riot. Reutiliza la respuesta `getTeams` de `data:logos` y lee `teams.json` y `players.json` del snapshot. Descarga cada URL válida para calcular sus metadatos y escribe `packages/core/content/real/photos.json`, ordenado por id de jugador. La caché solo guarda metadatos. El comando lista los jugadores que quedan sin foto.

Admite `--cache-dir`, `--max-attempts` y `--offline`. En modo offline solo puede regenerar el manifiesto cuando la caché ya tiene todos los metadatos de las imágenes válidas. [Plan 11](../../docs/plans/11-datos-reales.md#fotos-de-jugadores-en-la-caché-360).

## Logos de ligas y torneos internacionales

```sh
mise exec -- pnpm data:leagues
mise exec -- pnpm data:leagues --offline
```

Consulta `getLeagues` y escribe `packages/core/content/real/leagues.json` con procedencia y metadatos ordenados por id. Usa las mismas opciones, caché y límites que `data:logos`. `--offline` necesita la respuesta y los metadatos de imagen ya cacheados. El comando lista las competiciones que quedan sin logo.

## Torneos internacionales

```sh
mise exec -- pnpm data:internationals
mise exec -- pnpm data:internationals --offline
```

Lee la temporada de los snapshots de las seis ligas y trae de Leaguepedia, con el mismo cliente, límite y caché que `data:snapshot`, los torneos oficiales de First Stand, MSI y Worlds (`Tournaments`) y sus series (`MatchSchedule`: equipos, marcador, Bo y fecha). Las clasificatorias regionales que Leaguepedia archiva bajo Worlds (`LPL/2026 Season/Regional Finals`) quedan fuera. Escribe `packages/core/content/real/internationals.json` (validado con [real-internationals](../../packages/contracts/draft/real-internationals.ts)) y los formatos en `packages/core/content/real/formats/`.

Los formatos están curados en [international-formats.ts](international-formats.ts) (estructura) y las ventanas salen de las fechas reales. [international-check.ts](international-check.ts) reproduce cada serie real contra su formato (R1): equipos por fase, series, Bo por ronda y cruces con los cuadros del núcleo, y el Swiss por balance, revanchas y Bo de las series decisivas. Un test lo ejecuta con los datos del repo, así que si Riot cambia un formato, el PR del workflow semanal falla en `verify`. Los formatos llevan `verified: false` con sus motivos (R2) hasta que se lean los reglamentos. El generador conserva las referencias a plazas y resultados de fases del #424. Dos ejecuciones dan los mismos bytes.

## Actualización semanal

El [workflow](../../.github/workflows/data-snapshot.yml) se ejecuta los lunes a las 05:23 UTC y también se puede lanzar desde **Actions → Real data snapshot → Run workflow** en la rama por defecto. Las respuestas crudas viven en `actions/cache` (privada del repositorio, con clave por fecha UTC): no se suben como artefacto ni se commitean, porque los desambiguadores de `Link` pueden incluir nombres reales. Un día nuevo consulta de nuevo la fuente. Si solo cambian las fechas de consulta, se conservan los bytes y la procedencia de la última versión publicada.

El workflow regenera el snapshot, los jugadores, los equipos, los logos y los torneos internacionales. Si cambia algún fichero, abre o actualiza el PR de `chore/data-snapshot`. El resumen compara con la rama por defecto y avisa del cambio de temporada. Incluye fichajes, equipos nuevos, campeones nuevos en las partidas y recuentos por liga. La revisión y la fusión son manuales.

En **Settings → Actions → General**, el repositorio debe permitir que GitHub Actions cree pull requests. El `GITHUB_TOKEN` integrado no inicia el CI automáticamente. Si el PR muestra **Approve workflows to run**, aprueba la ejecución. Puedes volver a lanzar una ejecución existente desde Actions. Si GitHub no creó ninguna, cierra y vuelve a abrir el PR con una cuenta con permiso de escritura. [Comportamiento de `GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token)

## Campeones reales

```sh
mise exec -- pnpm data:champions [--offline] [--prior-games <n>] [--cache-dir <ruta>]
```

Lee los snapshots de las seis ligas y el `champion-summary.json` de CommunityDragon (parche fijado en [champions.ts](champions.ts), solo ids, claves y clases). Descarga además los datos de juego de cada campeón (`characters/<id>/<id>.bin.json` y `lol.stringtable.json`, a la subcarpeta `kits` de la caché; ver [rasgos desde los datos del juego](../../docs/plans/11-datos-reales.md#rasgos-desde-los-datos-del-juego-340)). Escribe `champions.json`, `matchups.json`, `counters.json`, `synergies.json`, `kits.json`, `traits.json` y `provenance.json` en `packages/core/content/real/champions/`. Sin caché de los kits en modo offline, los rasgos pasan a estimados y la procedencia lo registra. `--prior-games` fija cuántas partidas dan el mismo peso al kit y a los resultados pro (20 por defecto).

El tier es relativo a cada rol (#401): se ordena por la presencia con su prior y se reparte por cupos (S+ 3 %, S 8 %, A 17 %, B 27 %, C 30 %, D 15 %); con menos de 8 picks ponderados en el rol, como máximo B. Aprovecha dos temporadas anteriores con agregados de Cargo en la subcarpeta `history` de la caché. En modo offline el catálogo es obligatorio. Si faltan agregados históricos, el comando avisa, registra los años que faltan en la procedencia y genera con las temporadas disponibles. Las reglas, la mezcla y los mínimos de cobertura están en el [plan 11](../../docs/plans/11-datos-reales.md#base-de-reglas-y-mezcla-con-los-datos-pro-321).
