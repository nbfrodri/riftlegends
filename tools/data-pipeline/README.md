# Snapshot de datos reales

Desde la raíz, con las dependencias del repositorio instaladas:

```sh
mise exec -- pnpm data:snapshot
mise exec -- pnpm data:snapshot --offline
```

El comando escribe un JSON por liga en `packages/core/content/real/`, tras validar las seis ligas. Usa la lista de torneos principales de 2026 de [scope.ts](scope.ts) y el catálogo EN de Data Dragon fijado allí. Descarga solo datos y metadatos de los logos.

| Opción | Uso |
| --- | --- |
| `--offline` | Lee solo la caché y aborta si falta una respuesta. La fecha de cada consulta viene de la caché, así que esos mismos datos dan los mismos bytes. |
| `--cache-dir <ruta>` | Usa una carpeta fuera del repositorio. También se puede indicar con `RIFT_LEGENDS_DATA_CACHE`. La ruta por defecto es `$XDG_CACHE_HOME/rift-legends/data-pipeline` o `~/.cache/rift-legends/data-pipeline`. |
| `--max-attempts <n>` | Número máximo de intentos por petición recuperable. Por defecto, 5. |

Para consultar datos nuevos, usa una caché vacía. En una descarga completa hay al menos 11 s entre peticiones Cargo, con páginas de hasta 500 filas. Los fallos recuperables esperan con retroceso exponencial de hasta 120 s o el `Retry-After` si es mayor. El tiempo de descarga depende de esa espera y de la API.

Los JSON separan el historial de plantillas de `seasonPlayers`, que asigna cada jugador a su último equipo por fecha e ID de partida. Sin partidos, se usa la última plantilla por fecha de torneo. `sub` indica que el jugador no inició más de la mitad de las partidas del equipo en ese rol. Los IDs de Leaguepedia con paréntesis conservan el handle y sustituyen el desambiguador por una huella, ya que puede incluir el nombre real. En los drafts, `null` indica un hueco, y `draftOrder: false` identifica listas de marcador cuyo orden de selección se desconoce.

## Jugadores y equipos

```sh
mise exec -- pnpm data:content
```

Lee solo los JSON de `packages/core/content/real/` (sin red) y escribe `players.json`, `teams.json` y `provenance.json` en la misma carpeta, con la forma del contenido ficticio. Dos ejecuciones dan los mismos bytes; un test comprueba que los ficheros del repo están al día.

| Pieza | Dónde | Resumen |
| --- | --- | --- |
| Atributos (J1, P4) | [attributes.ts](attributes.ts) | Cada atributo medible sale del percentil de una métrica por minuto dentro de su rol y liga, con 12 partidas previas que acercan las muestras pequeñas a la media (65). Los que no se miden (temple, resistencia, concentración, shotcalling, comunicación) y los proxies parten de esa media, ajustada por experiencia y resultados; van en `estimated`. Sin partidas: todo estimado |
| Fuerza de liga (J2) | [league-strength.ts](league-strength.ts) | Un coeficiente por liga (LCK 1,08 · LPL 1,06 · LEC 1 · LCP 0,98 · LCS 0,96 · CBLOL 0,9), editable, con su justificación |
| Pools y maestría (J3) | [player-team-content.ts](player-team-content.ts) | Mains: el más jugado y los de ≥3 partidas y ≥20 %. Con menos de 3 campeones, el resto sale de los más jugados del rol (maestría 30) |
| Equipos (J4) | [player-team-content.ts](player-team-content.ts) | Sembrado global: % de victorias suavizado (6 victorias y 6 derrotas previas) por la fuerza de su liga. Coach: el head coach de su última plantilla; sin coach, «—» y `balanced`. Roles sin jugador: relleno con `placeholder` y todo estimado |
| Coach (J5) | [coach-style.ts](coach-style.ts) | Personalidad = la señal de draft que más sube sobre la media de su liga (mínimo 8 drafts con orden conocido; si no, `balanced`). Usa una tabla mínima de arquetipos (TODO #249) |

Los valores que el snapshot no mide quedan por defecto: química 40–80 según partidas juntos, estrategia equilibrada, adaptación 50 y valoración de coach 2,5.

Datos de los colaboradores de Leaguepedia, **CC BY-SA 3.0 Unported**. El [aviso de licencia](../../packages/core/content/real/LICENSE) explica la atribución. Las [capturas de prueba](fixtures/leaguepedia/README.md) se completan con filas y respuestas sintéticas etiquetadas en los tests.

## Actualización semanal

El [workflow](../../.github/workflows/data-snapshot.yml) se ejecuta los lunes a las 05:23 UTC y también se puede lanzar desde **Actions → Real data snapshot → Run workflow** en la rama por defecto. Las respuestas crudas viven en `actions/cache` (privada del repositorio, con clave por fecha UTC): no se suben como artefacto ni se commitean, porque los desambiguadores de `Link` pueden incluir nombres reales. Un día nuevo consulta de nuevo la fuente. Si solo cambian las fechas de consulta, se conservan los bytes y la procedencia de la última versión publicada.

Cuando cambia la carpeta del snapshot, el workflow abre o actualiza el PR de `chore/data-snapshot`. El resumen compara con la rama por defecto. Cuenta los cambios de equipo en las plantillas de temporada, los equipos nuevos, los campeones que aparecen por primera vez en picks, bans o estadísticas y las partidas por liga. La revisión y la fusión son manuales.

En **Settings → Actions → General**, el repositorio debe permitir que GitHub Actions cree pull requests. El `GITHUB_TOKEN` integrado no inicia el CI automáticamente. Si el PR muestra **Approve workflows to run**, aprueba la ejecución. Puedes volver a lanzar una ejecución existente desde Actions. Si GitHub no creó ninguna, cierra y vuelve a abrir el PR con una cuenta con permiso de escritura. [Comportamiento de `GITHUB_TOKEN`](https://docs.github.com/en/actions/concepts/security/github_token)
