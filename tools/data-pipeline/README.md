# Snapshot de datos reales

Desde la raíz, con las dependencias del repositorio instaladas:

```sh
mise exec -- pnpm data:snapshot
mise exec -- pnpm data:snapshot --offline
```

El comando escribe un JSON por liga en `packages/core/content/real/`, tras validar las seis ligas. Usa la lista de torneos principales de 2026 de [scope.ts](scope.ts) y el catálogo EN de Data Dragon fijado allí. Descarga solo datos y metadatos de los logos (el campo `logo` de Leaguepedia ya no lo usa la app; los logos salen de `data:logos`).

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

Lee solo los JSON de `packages/core/content/real/` (sin red) y escribe `players.json`, `teams.json` y `provenance.json` en la misma carpeta, con la forma del contenido ficticio. Dos ejecuciones dan los mismos bytes; un test comprueba que los ficheros del repo están al día.

| Pieza | Dónde | Resumen |
| --- | --- | --- |
| Atributos (J1, P4) | [attributes.ts](attributes.ts) | Cada atributo medible sale del percentil de una métrica por minuto dentro de su rol y liga, con 12 partidas previas que acercan las muestras pequeñas a la media (65). Los que no se miden (temple, resistencia, concentración, shotcalling, comunicación) y los proxies parten de esa media, ajustada por experiencia y resultados; van en `estimated`. Sin partidas: todo estimado |
| Trayectoria (J1) | [career.ts](career.ts), [history.ts](history.ts) | `history.json` guarda, por jugador del snapshot, una fila por temporada previa: partidas en ligas principales, eventos internacionales jugados (Worlds, MSI, First Stand), títulos de liga e internacionales. `careerStrength` suma por temporada (partidas/80 con tope 1 + 0,5 por evento + 1 por título + 2 por título internacional), la pondera 0,85 por cada año de antigüedad y satura como p/(p+4). Esa fuerza (0–1) suma hasta +20 a experiencia, +6 a temple, +5 a resistencia, +4 a constancia y hasta +8 al nivel. Sin historial, nada cambia |
| Fuerza de liga (J2) | [league-strength.ts](league-strength.ts) | Puntos de liga para los atributos (LCK +4 · LPL +3 · LEC 0 · LCP −2 · LCS −3 · CBLOL −6) y prior Elo para el sembrado global (LCK +150 … CBLOL −190), editables; ver [plan 11](../../docs/plans/11-datos-reales.md) |
| Pools y maestría (J3) | [player-team-content.ts](player-team-content.ts) | Mains: el más jugado y los de ≥3 partidas y ≥20 %. Con menos de 3 campeones, el resto sale de los más jugados del rol (maestría 30) |
| Equipos (J4) | [player-team-content.ts](player-team-content.ts) | Sembrado global: % de victorias suavizado (6 victorias y 6 derrotas previas) por la fuerza de su liga. Coach: el head coach de su última plantilla; sin coach, «—» y `balanced`. Roles sin jugador: relleno con `placeholder` y todo estimado |
| Coach (J5) | [coach-style.ts](coach-style.ts) | Personalidad = la señal de draft que más sube sobre la media de su liga (mínimo 8 drafts con orden conocido; si no, `balanced`). Usa una tabla mínima de arquetipos (TODO #249) |

Los valores que el snapshot no mide quedan por defecto: química 40–80 según partidas juntos, estrategia equilibrada, adaptación 50 y valoración de coach 2,5.

Datos de los colaboradores de Leaguepedia, **CC BY-SA 3.0 Unported**. El [aviso de licencia](../../packages/core/content/real/LICENSE) explica la atribución. Las [capturas de prueba](fixtures/leaguepedia/README.md) se completan con filas y respuestas sintéticas etiquetadas en los tests.

## Trayectoria de los jugadores

`pnpm data:snapshot` también escribe `packages/core/content/real/history.json` (tras el snapshot, con la misma caché y el mismo límite de Cargo). Mira los 7 años anteriores a la temporada del snapshot (`snapshotSeason` e `historySpan` en [scope.ts](scope.ts); al avanzar la temporada, la ventana se mueve sola). Son tres consultas agregadas por año con `GROUP BY` (partidas por jugador, eventos internacionales y títulos), unas 1 500 filas por año y nada partida a partida. Los años cerrados no cambian: su caché va aparte (`RIFT_LEGENDS_HISTORY_CACHE`, por defecto `<caché>/history`) y el workflow la restaura con clave estable, de modo que cada lunes solo se pide el año nuevo. Solo se guardan los ids del snapshot (con huellas); los demás nombres se descartan antes de escribir la caché. Después, `pnpm data:content` regenera jugadores y equipos.

## Logos de equipos

```sh
mise exec -- pnpm data:logos
mise exec -- pnpm data:logos --offline
```

Lee los equipos de los JSON del snapshot, los empareja con la API web pública de lolesports.com (`getTeams`) y escribe `packages/core/content/real/logos.json` con la URL, el SHA-256, el tamaño y el tipo de cada logo. Acepta las mismas opciones y la misma caché que `data:snapshot`. Pausa de 1 s entre peticiones, sin redirects. Los equipos sin logo se listan en la salida. Los bytes de los logos no se guardan. Detalles y capturas: [plan 11](../../docs/plans/11-datos-reales.md#logos-de-equipos-en-la-caché-252-284) y [fixtures/lolesports](fixtures/lolesports/README.md).

## Actualización semanal

El [workflow](../../.github/workflows/data-snapshot.yml) se ejecuta los lunes a las 05:23 UTC y también se puede lanzar desde **Actions → Real data snapshot → Run workflow** en la rama por defecto. Las respuestas crudas viven en `actions/cache` (privada del repositorio, con clave por fecha UTC): no se suben como artefacto ni se commitean, porque los desambiguadores de `Link` pueden incluir nombres reales. Un día nuevo consulta de nuevo la fuente. Si solo cambian las fechas de consulta, se conservan los bytes y la procedencia de la última versión publicada.

Cuando cambia la carpeta del snapshot, el workflow abre o actualiza el PR de `chore/data-snapshot`. El resumen compara con la rama por defecto. Cuenta los cambios de equipo en las plantillas de temporada, los equipos nuevos, los campeones que aparecen por primera vez en picks, bans o estadísticas y las partidas por liga. La revisión y la fusión son manuales.

En **Settings → Actions → General**, el repositorio debe permitir que GitHub Actions cree pull requests. El `GITHUB_TOKEN` integrado no inicia el CI automáticamente. Si el PR muestra **Approve workflows to run**, aprueba la ejecución. Puedes volver a lanzar una ejecución existente desde Actions. Si GitHub no creó ninguna, cierra y vuelve a abrir el PR con una cuenta con permiso de escritura. [Comportamiento de `GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token)

## Campeones reales

```sh
mise exec -- pnpm data:champions [--offline] [--min-sample <n>] [--cache-dir <ruta>]
```

Lee los JSON de `packages/core/content/real/` y el `champion-summary.json` de CommunityDragon (parche fijado en [champions.ts](champions.ts), solo ids, claves y clases; se cachea como el resto). Escribe `packages/core/content/real/champions/` con `champions.json`, `matchups.json`, `synergies.json` y `provenance.json`. Las fórmulas y la muestra mínima están en el [plan 11](../../docs/plans/11-datos-reales.md#campeones-reales-cómo-se-generan-249).
