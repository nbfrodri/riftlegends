# Plan 10 — Contenido: dataset ficticio, iconos y caché de Data Dragon

- **Estado:** hecho (22-11-2026): #230–#236, PR #237–#245. Aprobado el 22-11-2026.
- **Fase:** 2 · Draft rápido completo ([plan general](../../plans/00-plan-general.md)).

## Objetivo

1. Jugar una **Bo5 con fearless hard** contra la IA con el contenido ficticio empaquetado (hoy, 41 campeones no llegan).
2. Dar a los campeones y equipos lo que hoy falta: **nombre, sembrado y coach**, validados con esquema.
3. Bajar de **Data Dragon** (y CommunityDragon para los iconos) el arte del modo LoL real a una caché local, reanudable y verificada, sin romper el juego sin red.

Queda fuera: datos de esports reales y atributos desde estadísticas (plan 11), meta y parches (plan 18), objetos (plan 23).

## Lista de tests

### Contenido ficticio

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| C1 | El pool tiene **70 campeones**, al menos 14 con cada rol como posición principal | Un campeón flex cuenta en todos sus roles para el pool, pero solo en uno como principal |
| C2 | Una Bo5 con fearless hard se juega entera IA contra IA con todas las semillas de una muestra (property test): ningún game se queda sin pick legal | Game 5 con los 40 picks anteriores bloqueados y los 10 bans |
| C3 | Todo campeón tiene nombre, roles, daño, curva de poder, arquetipos y perfil de combate; todo jugador tiene sus pools con ids existentes | Id repetido, pool con un id que no existe o campeón sin rol: el esquema lo rechaza con su ruta |
| C4 | Cada equipo tiene nombre, sembrado único y coach (personalidad y rating) | Dos equipos con el mismo sembrado: error de validación |
| C5 | Matchups y sinergias referencian campeones existentes y no se repiten | Par `a-b` y `b-a` en sinergias cuenta como repetido |
| C6 | La calibración K1–K5 del plan 08 sigue en verde con el pool nuevo | Si cambian los bytes de un golden, sube `content_version` (y `SIM_VERSION` solo si cambia la simulación) |

### Caché de Data Dragon (proceso principal)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| D1 | Sin caché ni red, la app arranca y el draft ficticio se juega | `ENETUNREACH` y `EACCES` no muestran error bloqueante |
| D0 | Con red, el arranque lanza la sincronización en segundo plano si falta la caché o hay versión nueva, sin bloquear la UI | Dos arranques seguidos no lanzan dos descargas a la vez |
| D2 | La sincronización baja la versión fijada (lista de campeones, retratos e iconos) a `staging-<versión>/` y solo activa la caché cuando todo coincide en tamaño y SHA-256 | Corte a mitad de archivo: no hay puntero `current.json` ni caché válida |
| D3 | Al reanudar se conservan los archivos completos y se pide el resto con `Range` + `If-Range` | Servidor que ignora `Range` (200): reinicia solo ese archivo; parcial alterado: se descarta y se baja entero |
| D4 | En el arranque sin red, la caché activa se revalida desde disco | Un archivo borrado o cambiado invalida la caché y la app vuelve a los placeholders |
| D5 | El renderer solo lee arte de la caché activa por un protocolo propio de solo lectura | Rutas con `..`, absolutas o fuera de la caché: 404 |
| D6 | Las URL de descarga se construyen solo desde la versión y los ids del manifiesto | Un id con `/` o `..` en `champion.json` se rechaza |

### UI

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| U1 | Los campeones muestran su **nombre** del contenido en draft, roles, partida y resultado | Nombre largo: se recorta con elipsis y el nombre completo queda en la etiqueta accesible |
| U2 | Con la caché lista, se ven los iconos oficiales de rol y objetivos; sin caché, los propios. `ChampionFace` muestra el retrato si existe y, si no, iniciales con color | Imagen que no carga: vuelve al propio sin saltos de maquetación |
| U3 | Ajustes muestra el estado de la caché (sin descargar, descargando con progreso, lista, error) y permite reintentar | Cerrar la app a mitad: al volver, el estado dice «a medias» y reanuda |
| U4 | La configuración de la serie ofrece los equipos por sembrado y permite fearless hard en Bo5 | El aviso de pool insuficiente desaparece con 70 campeones |
| E1 | El E2E del plan 09 pasa a **Bo5 fearless hard** | — |
| E2 | Capturas visuales de Ajustes con la caché y del draft con el pool nuevo | — |

## Diseño

### Contenido

- **Esquemas:** siguen en `packages/contracts` (`AiContent`, `MatchContent`) y se amplían con `name` del campeón, y `seed` y `coach` del equipo. Se valida al cargar la sesión en el `core-host`; un contenido inválido no abre la sesión. No se crea `packages/content` todavía (YAGNI): se moverá si el plan 11 lo pide.
- **Datos:** `packages/core/content/` pasa de TypeScript con helpers a **un JSON por bloque** (`champions.json`, `teams.json`, `players.json`, `matchups.json`) validado con Zod. Así el plan 11 genera los mismos ficheros desde el pipeline. `content_version` se calcula del hash de los ficheros.
- **Pool:** 70 campeones originales (14 por rol principal, unos 15 flex), con tiers repartidos para que la IA tenga picks prioritarios y de nicho. Nombres inventados, sin parecido con campeones de Riot.
- **Equipos:** 8 (los dos actuales y seis nuevos), cada uno con coach, sembrado y cinco jugadores.

### Caché de Data Dragon

- Vive en el **proceso principal** (red y disco); el núcleo sigue puro. Reutiliza el diseño validado en el [spike S8](../../research/spikes-2026-11/s77-resumable-download.md): `node:https`, `.part` con ETag, `Range` + `If-Range`, `Accept-Encoding: identity`, `staging-<versión>/` y puntero `current.json` atómico.
- **Versión:** la última de `versions.json` al sincronizar; el manifiesto (tamaños y SHA-256) se genera al terminar la descarga y se verifica en cada arranque. Sin red, se usa la última caché válida.
- **Qué se baja:** `champion.json` (es_ES y en_US), retratos cuadrados y los iconos de rol y objetivos de CommunityDragon. Cada origen (Data Dragon, CommunityDragon y, en el plan 11, Leaguepedia) tiene su carpeta y su manifiesto. Nada se versiona en el repo ni va en los binarios ([NOTICE.md](../../../NOTICE.md)).
- **Renderer:** protocolo `rift-asset://` registrado como privilegiado y de solo lectura, que resuelve rutas dentro de la caché activa. Sin acceso a `fs` desde el renderer.
- **IPC:** `assets.status` (query) y `assets.sync` (comando con progreso), en el puente existente, validados con Zod.

### UI

- Un componente `ChampionFace` en `ui-kit` sustituye a los helpers de `board/champions.ts` (retrato o iniciales con color). Los no disponibles siguen en gris con raya diagonal.
- `MapIcon` y los iconos de rol eligen el oficial si la caché lo tiene y el propio si no.
- Ajustes, sección «Contenido»: estado de la caché y botón de reintento. Textos en ES y EN.

## Decisiones del usuario (22-11-2026)

1. **Modo LoL real:** el plan 10 deja la caché lista y usa ya los iconos oficiales de rol y objetivos. Los retratos se descargan, pero se usan cuando el plan 11 traiga los campeones reales jugables (todos, con sus datos).
2. **Equipos ficticios:** 8 por ahora. Con datos reales (plan 11), todos los equipos de las ligas mayores: LCK, LPL, LEC, LCP, LCS y CBLOL.
3. **Pool ficticio:** 70 campeones inventados (14 por rol), para jugar sin red y en los tests. Los ~170 reales llegan con el plan 11.
4. **Descarga automática:** en segundo plano en cada arranque con red, si falta la caché o cambia la versión. Ajustes muestra el estado y permite reintentar.
5. El juego usará los **assets reales** de LoL y de los equipos de esports. Los logos de equipos vienen de Leaguepedia (plan 11); la caché del plan 10 se diseña para alojarlos también.

## Troceado en issues (Tarea de plan · milestone «Fase 2 — Draft rápido completo»)

| Orden | Issue | Test que lo cierra |
| --- | --- | --- |
| 1 | #230 · Esquemas de contenido con nombre, sembrado y coach; contenido a JSON | C3–C5 |
| 2 | #231 · Pool de 70 campeones, equipos y calibración | C1, C2, C6 |
| 3 | #232 · `ChampionFace` y nombres en todas las pantallas | U1 |
| 4 | #233 · Configuración con sembrado y fearless hard; E2E Bo5 hard | U4, E1 |
| 5 | #234 · Caché de Data Dragon en main con reanudación, verificación y sincronización automática | D0–D4, D6 |
| 6 | #235 · Protocolo `rift-asset://` e IPC `assets.*` | D5 |
| 7 | #236 · Ajustes «Contenido», retratos e iconos oficiales; capturas | U2, U3, E2 |

## Riesgos

- **Calibración:** más campeones cambian los resultados de K1–K5. Se recalibra en el issue 2, no después.
- **CommunityDragon** cambia rutas sin aviso: el manifiesto lista las rutas usadas y un fallo deja los iconos propios.
- **Legal:** sin assets de Riot en el repo ni en los binarios; todo se baja en tiempo de ejecución.

## Pendiente al cerrar

- U3 «a medias»: el contrato de estado no distingue una descarga interrumpida; al reabrir, la descarga se reanuda sola y Ajustes muestra «descargando».
- Los retratos se descargan pero aún no se muestran: llegan con los campeones reales del plan 11 (`useAssetSrc` + `ChampionFace src`).
