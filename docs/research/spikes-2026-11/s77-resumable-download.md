# S8 · Descarga reanudable de Data Dragon

**T7 pasa en el AppImage de Arch.** En cuatro escenarios de corte (reinicio de conexión, `SIGKILL` de la app, parte manipulada y servidor sin `Range`) no hubo ninguna caché incompleta marcada como válida, el draft ficticio siguió jugable sin red y, tras reconectar, los 8 archivos finales coincidieron byte a byte con una descarga íntegra hecha aparte con `curl`. **En el NSIS de Windows también pasa** en el escenario de conexión cortada (run [44809729205](https://github.com/nbfrodri/riftlegends/actions/runs/44809729205)).

Issue #77 · 20-11-2026 · Rama desechable `spike/77-resumable-download`, sobre `spike/76-packaging-save`. Código medido en `e11d24efb661fcf99046eb1fc485d4d100a37fc8`; el único cambio posterior es la comparación del manifiesto en el script de medida. [Plan y criterios](../../plans/03-spikes.md) · [S7 · Empaquetado y guardado](s76-packaging-save.md)

## Resultados frente al umbral

| Parte de T7 | Umbral | Observación | Veredicto |
| --- | --- | --- | --- |
| Corte a mitad de archivo | Cortar Data Dragon a mitad de un archivo | Corte real a 1.500.000 de 2.240.929 bytes de `championFull.json` por reinicio de conexión (S1, S3, S4) o por proceso matado con `SIGKILL` mientras el servidor retenía la conexión (S2). Los 4 archivos anteriores estaban completos y verificados. | Pasa |
| Reinicio sin red + draft ficticio | La app arranca sin red y el draft sigue disponible | 4/4 reinicios bajo `unshare -cn` (cero interfaces con dirección; el intento de descarga falló con `ENETUNREACH`). El draft reabrió en el turno 5 y avanzó hasta el 10 con el mismo escritor SQLite de #76 en cada escenario. | Pasa |
| Cero cachés incompletas válidas | Ninguna marcada como válida | En los 8 estados intermedios (tras el corte y tras el reinicio offline) no existe `current.json`, no existe el directorio de versión y los parciales viven solo en `staging-16.23.1/*.part`. `cacheState` informó «no pointer» en todos. | Pasa |
| Conservar completos y recuperar el pendiente | No volver a bajar lo completo | La reanudación reutilizó los 4 archivos completos (`kept-verified`) y bajó solo el pendiente: 955.168 bytes en S1 y S2 (740.929 del archivo cortado más 3 archivos pendientes). | Pasa |
| Comparar con descarga íntegra | Mismo resultado | Los 8 archivos de la caché activa de los 4 escenarios tienen el mismo SHA-256 que la descarga de referencia con `curl` (`identicalToReference: true` x4). Esa referencia coincide con el manifiesto fijado. | Pasa |
| Caché reabre válida en otro arranque offline | La caché sobrevive al reinicio | Paso `4-verify-offline`: `cacheState` revalida tamaño y SHA-256 de los 8 archivos desde disco, sin red: válida 4/4. | Pasa |
| Servidor sin `Range` | Reiniciar solo el archivo incompleto | S4 (proxy que oculta `Accept-Ranges` y descarta `Range`): respuesta 200, reinició solo `championFull.json` (restarted=1) y mantuvo los 4 completos. | Pasa |
| T7 · NSIS en Windows | Misma prueba en el instalador | Escenario S1 en el NSIS instalado: corte a 1.500.000 bytes (`ECONNRESET`), arranque con salida bloqueada por el firewall (`EACCES`), sin puntero y solo con parciales en *staging*. Al reanudar se conservaron 4 archivos, se reanudó `championFull.json` y se bajaron 955.168 bytes. La caché quedó válida con 8 archivos, siguió válida en el arranque sin red y coincide con el manifiesto. El draft ficticio avanzó de 0 a 20 a lo largo de los cuatro arranques. [Muestras](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s77-windows-samples.json) | Pasa |

## Entorno y protocolo

Mismo equipo, sistema y paquete que en #76: HP EliteBook 840 G8 (i7-1185G7), Omarchy 4.5.0 sobre Arch, Linux 7.2.15-1-omarchy, Hyprland/Wayland. Red real (wifi, CloudFront en Madrid). AppImage `RiftLegends-0.76.1.AppImage` reconstruido para esta medida: 117.839.231 bytes, SHA-256 `113200dd3d6a57fe303e98b8b17357983658ff3b4e80051dc3d58920093de496`. Electron 45.4.1, Node embebido 24.22.3.

**Versión fijada de Data Dragon: `16.23.1`**, la primera de `versions.json` el 20-11-2026. Conjunto de 8 archivos, 2.696.524 bytes en total (nombres, tamaños y hashes en [manifest.json](https://github.com/nbfrodri/riftlegends/blob/spike/77-resumable-download/apps/desktop/spike77/manifest.json); ningún contenido se versiona): `data/es_ES/champion.json`, `img/champion/{Aatrox,Ahri,Akali}.png`, `data/en_US/championFull.json` (2.240.929 bytes, el archivo que se corta), `data/en_US/champion.json` e `img/champion/{Zed,Zyra}.png`. Se descargan en ese orden.

**Descarga.** `node:https` sin dependencias nuevas (no se usó `net` de Electron, así que no hubo API de Electron que consultar en Context7). Cada archivo se guarda como `<ruta>.part` en `userData/ddragon/staging-<versión>/`, junto con el ETag. Al reanudar pide `Range: bytes=<tamaño del .part>-` con `If-Range: <ETag>` y `Accept-Encoding: identity`. Si el servidor responde 200, descarta el parcial y reinicia ese archivo; si responde 416 también. Cada archivo se verifica por tamaño y SHA-256 contra el manifiesto antes de renombrar el `.part` a su nombre final. Un hash que no coincide borra el parcial y repite (hasta 3 intentos). Solo con los 8 archivos verificados dos veces se hace `rename` del directorio de staging a `userData/ddragon/<versión>/` y, al final, se escribe el puntero `current.json` con `fsync` y `rename` atómico. La caché es válida solo si existe el puntero y todos los archivos de su directorio pasan tamaño y SHA-256. [Descarga](https://github.com/nbfrodri/riftlegends/blob/spike/77-resumable-download/apps/desktop/spike77/download.cjs) · [Modo en la app](https://github.com/nbfrodri/riftlegends/blob/spike/77-resumable-download/apps/desktop/spike76/main.cjs)

**Corte reproducible.** [proxy.cjs](https://github.com/nbfrodri/riftlegends/blob/spike/77-resumable-download/apps/desktop/spike77/proxy.cjs) escucha en loopback y reenvía a `ddragon.leagueoflegends.com`. Corta una vez a 1.500.000 bytes de `championFull.json` con `cut` (destruye el socket) o `stall` (deja de enviar y mantiene la conexión abierta; el arnés mata el grupo de procesos de la app con `SIGKILL` al ver progreso por encima de 1.000.000). El modo `norange` oculta `Accept-Ranges` y descarta `Range`. [Arnés](https://github.com/nbfrodri/riftlegends/blob/spike/77-resumable-download/apps/desktop/spike77/linux-download.sh) · [Resumen](https://github.com/nbfrodri/riftlegends/blob/spike/77-resumable-download/apps/desktop/spike77/summarize.mjs)

Cada escenario usa un perfil nuevo y cuatro arranques del mismo AppImage, y en cada uno la app juega 5 turnos del draft de #76 antes de tocar la descarga:

1. `1-cut`, con red a través del proxy: la descarga se corta (o se mata la app).
2. `2-offline`, bajo `unshare -cn`: intento de descarga contra el servidor real, que falla.
3. `3-resume`, con red directa (S4 a través de `norange`): reanuda hasta activar la caché. En S3 se alteró antes un byte (offset 100) del parcial de 1.500.000 bytes.
4. `4-verify-offline`, bajo `unshare -cn`: revalida la caché sin red.

Entre pasos el arnés hace una instantánea independiente con `find` y `sha256sum`, y al final compara el árbol de `userData/ddragon/16.23.1` con la descarga de referencia hecha con `curl` (que además se cotejó con el manifiesto).

## Comportamiento observado del servidor

Data Dragon (S3 detrás de CloudFront) admite rangos:

| Petición | Respuesta |
| --- | --- |
| `GET` normal | 200, `Accept-Ranges: bytes`, `ETag: "f82fdbaf0b78c420c17bb735cb92e3fe"` (`championFull.json`), `Content-Length: 2240929` |
| `Range: bytes=1500000-` + `If-Range: <ETag>` | 206, `Content-Range: bytes 1500000-2240928/2240929`, `Content-Length: 740929`, mismo ETag |
| `Range: bytes=1000-` (sonda con `curl`) | 206, `Content-Range: bytes 1000-2240928/2240929` |
| `Range: bytes=9999999-` (fuera de rango) | 416, `Content-Range: bytes */2240929` |
| `Range` con `If-Range` distinto del ETag | 200 con el archivo completo (comportamiento HTTP correcto) |
| `Accept-Encoding: gzip` | `Content-Encoding: gzip`; por eso la app pide `identity`, porque los rangos y los hashes del manifiesto son sobre bytes sin comprimir |

## Resultados por escenario

| Escenario | Corte | Tras `2-offline` | `3-resume` | Referencia |
| --- | --- | --- | --- | --- |
| S1 · reinicio de conexión | `ECONNRESET aborted`, parcial de 1.500.000 bytes | Sin puntero. Draft 5→10. | 206 desde 1.500.000. kept=4, resumed=1, bajados 955.168 bytes. | Idéntica |
| S2 · `SIGKILL` | Matada tras 5 marcas de progreso, parcial de 1.500.000 bytes | Igual | Igual que S1 | Idéntica |
| S3 · parcial alterado | Como S1 | Igual | 206 reanudado, hash final incorrecto, se descartó el parcial y se rebajó el archivo completo (discarded=1, 2.455.168 bytes) | Idéntica |
| S4 · sin `Range` | Como S1 | Igual | 200 completo de `championFull.json` (2.240.929 bytes), restarted=1, kept=4 | Idéntica |

La app no tiene registros de tiempo propios; la medida es de corrección, no de rendimiento. Los números por paso, las peticiones con sus encabezados, los árboles de archivos y los hashes están en [s77-linux-samples.json](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s77-linux-samples.json) y [s77-linux-samples.csv](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s77-linux-samples.csv).

## Reproducción en Arch

Desde la raíz, en una sesión Wayland con red y con `node` en el PATH del arnés. El script imprime el directorio de resultados.

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- node apps/desktop/spike76/build.mjs 0.76.1
PATH="$(dirname "$(mise which node)"):$PATH" bash apps/desktop/spike77/linux-download.sh
mise exec -- node apps/desktop/spike77/summarize.mjs <directorio-de-resultados> <prefijo>
mise exec -- pnpm verify
```

`pnpm verify` pasó (Biome, tipos y 143 tests). No se ejecutó `pnpm e2e`: el spike no toca el código de la app salvo los modos de prueba del paquete desechable.

## Límites y pendiente

- **Windows (NSIS).** [windows-download.ps1](https://github.com/nbfrodri/riftlegends/blob/spike/77-resumable-download/apps/desktop/spike77/windows-download.ps1) corre tras `windows-smoke.ps1` en el job `nsis` de `spike-packaging.yml` y deja `release/windows-evidence-77` (JSON por paso, `proxy-cut.log` y `cache-vs-manifest.csv`). Solo cubre el escenario S1. Se desconoce si la regla de firewall de salida afecta al proxy en loopback (lo normal es que no); si fallara, habría que tratarlo como incidencia del arnés y no como fallo de T7. Veredicto: **pasa** (ver tabla). Sin red, en Windows el firewall bloquea la salida del ejecutable, pero las interfaces siguen activas; el error observado es `EACCES`.
- **Caché ya activada y dañada después.** `cacheState` revalida tamaño y hash, pero no se probó un daño posterior a la activación (disco corrupto). No forma parte del umbral de T7.
- **Cortes de energía.** Se hizo `fsync` del puntero y del directorio, pero el `SIGKILL` no emula pérdida de caché de página del sistema operativo. El hash final protege frente a un parcial incompleto, no se midió con un corte eléctrico.
- **Manifiesto.** Los hashes se fijan desde una descarga de la misma versión (Data Dragon es inmutable por versión). En el juego real, el manifiesto debe generarse en el empaquetado o publicarse junto a la release; el spike no resuelve cómo se firma ni cómo se actualiza.
- **Alcance.** Son 8 archivos y 2,7 MB, no el catálogo completo de Data Dragon, y la descarga es secuencial.
