# S3 · Reproducción de una Bo3 por semilla

**T4 pasa en el Arch físico. La aceptación entre plataformas queda pendiente de los dos jobs de CI.** Las tres semillas reprodujeron los 182 hechos esperados, con cero bytes divergentes. Los comandos ilegales conservaron el turno, el marcador, ambos estados del RNG y el historial completo.

Issue #75 · 20-11-2026 · Rama de referencia `spike/75-deterministic-core`. Commit medido `8aeb689131f3cc5224b660ccebdcb8eb85348457`, sobre la base de `main` `1addd0633e4702dd12ead7ca923a3ab9184ce9ea`. El prototipo es desechable. Los vectores y logs completos sirven como casos de aceptación para los planes 04 y 05. [Plan 03](../../plans/03-spikes.md)

## Resultados frente al umbral

| Prueba | Umbral | Observación | Veredicto |
| --- | --- | --- | --- |
| T4 · Legalidad en Arch | Cero rechazos que avancen el RNG o el draft | Equipo y acción incorrectos, campeón desconocido, vetado o ya elegido. El snapshot completo coincide antes y después de cada rechazo. También se rechaza jugar tras la segunda victoria. | Pasa |
| T4 · Reproducción en Arch | Tres logs completos idénticos byte a byte | 3/3, ocho partidas, 6.764 bytes comparados. La Bo3 terminó en la segunda victoria en las tres series. | Pasa |
| T4 · Ubuntu y Windows | Ambos jobs pasan para el mismo SHA, con cero divergencias | Workflow temporal preparado. La ejecución comienza al publicar la rama. | Pendiente de CI |

T1–T3 se miden en los spikes visuales, T5 y T6 corresponden a #76 y T7 al spike de descargas. T4 ejecuta el núcleo en CPU. Una divergencia reproducible entre plataformas bloquea el avance según el plan.

## Equipo y protocolo

| Dato | Valor medido | Fuente local |
| --- | --- | --- |
| Equipo y CPU | HP EliteBook 840 G8, Intel Core i7-1185G7, x86_64, 8 CPU lógicas | DMI en sysfs y `lscpu` |
| Memoria | 16.038.876 KiB disponibles para el kernel | `MemTotal` en `/proc/meminfo` |
| GPU y controlador | Intel Iris Xe TigerLake-LP GT2, PCI 8086:9a49, i915, Mesa 1:26.2.5-1 | `lspci -nnk`, `pacman -Q mesa` |
| Sistema y sesión | Omarchy 4.5.0 (Arch), Linux 7.2.15-1-omarchy, Hyprland 0.56.2, Wayland | `/etc/os-release`, `uname -r`, `hyprctl version`, `XDG_SESSION_TYPE` |
| Herramientas | Node 26.13.1, pnpm 12.22.0, TypeScript 7.0.2, Vitest 5.1.1, pure-rand 8.4.2 | `mise.toml`, manifiestos y lockfile |

Desde la raíz de la rama, con el commit indicado o su descendiente que solo añade este informe, ejecutar:

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm exec vitest run --project core packages/core/test/series-golden.test.ts --reporter=verbose
mise exec -- pnpm verify
mise exec -- pnpm e2e
```

La instalación congelada pasó la política de antigüedad del proyecto. La suite focalizada pasó sus seis casos. `verify` pasó Biome, tipos y 143 tests. La compilación de escritorio y 19 E2E pasaron en el equipo físico. Playwright omitió el caso exclusivo de Windows. El workflow pasó `actionlint` 1.7.12.

## Reglas y codificación reproducibles

- **Entrada.** Para cada flujo se codifican cuatro enteros sin signo de 32 bits en little-endian, por orden de semilla raíz, ámbito (1 para draft, 2 para partida), ID de serie e ID de partida. FNV-1a de 32 bits procesa esos 16 bytes con base 2166136261 y primo 16777619. El resultado inicializa `xoroshiro128plus` de `pure-rand@8.4.2`. Para la semilla 2, serie 75 y partida 1, los hashes son 2489897068 y 469212319, respectivamente.
- **Draft.** Los dos equipos y los 24 campeones son ficticios. Con A para Sable Choir y R para Copper Wake, cada partida sigue los bloques de vetos `ARARAR`, selecciones `ARRAAR`, vetos `RARA` y selecciones `RAAR`. Un campeón usado sale del conjunto disponible hasta el siguiente draft. Los goldens usan selección automática uniforme sobre el catálogo en orden fijo. Un comando con campeón explícito se valida antes de cualquier tirada.
- **Partida.** Cada selección aporta `1 + (índice del campeón % 5)` puntos, con índice desde cero. Se suma una tirada entera de 0 a 99 por equipo, primero azul y después rojo. Gana la suma mayor y el empate favorece al azul. Tras la segunda victoria se emite el ganador de la serie.
- **Hechos.** Cada línea es una tupla JSON compacta codificada en UTF-8 sin BOM, con LF incluido al final. El orden es apertura de serie, apertura de partida, veinte comandos aceptados y resultado. Tras el resultado se abre otra partida o se cierra la serie. La tupla de resultado registra ID de partida, fuerza y tirada azul, fuerza y tirada roja, y ganador. La posición de cada línea fija su secuencia.

## Muestras crudas

Los enlaces contienen todos los bytes que lee el test. Vitest compara dos buffers en memoria. El SHA-256 permite cotejar una copia de cada muestra y el atributo Git `eol=lf` conserva los finales de línea en ambos sistemas.

| Semilla raíz (serie 75) | Victorias en orden | Hechos | Bytes | SHA-256 |
| --- | --- | ---: | ---: | --- |
| [0](../../../packages/core/test/goldens/0.golden) | R, R | 46 | 1704 | `b1c7c559a6811a275cb3e105b20495b23cca2ef452e8546384b285319054b4a5` |
| [2](../../../packages/core/test/goldens/2.golden) | R, A, A | 68 | 2526 | `45e0d1b6fae64922e74eb4a3eabd79d48d5ace2804ab54c52501c032dd43556d` |
| [4294967295](../../../packages/core/test/goldens/4294967295.golden) | A, R, R | 68 | 2534 | `cb5156fcb7bdc935a2dea13476207a6fee2071c66ccccecb2de203f19f87ad60` |

Una lectura independiente de los tres archivos comprobó el orden de acciones y equipos, la unicidad de los veinte campeones de cada partida, los ocho ganadores a partir de sus sumas y el cierre al alcanzar dos victorias. [Implementación](../../../packages/core/index.ts) · [Tests](../../../packages/core/test/series-golden.test.ts)

## Lectura del resultado en CI

Tras el push, abrir la ejecución de **Spike goldens** para `spike/75-deterministic-core` y comprobar el SHA. Abrir **T4 (ubuntu-latest)** y **T4 (windows-latest)**. El paso de Vitest debe mostrar las tres semillas y seis casos aprobados en cada job. Registrar ambos enlaces de job en #75. Un fallo de comparación identifica la semilla en la traza de Vitest y da un veredicto **falla** para T4. Un fallo de instalación deja la comparación pendiente. [Workflow](../../../.github/workflows/spike-goldens.yml) · [Ejecuciones en GitHub](https://github.com/nbfrodri/riftlegends/actions/workflows/spike-goldens.yml)

## Entrega a persistencia (#76)

El snapshot de la serie admite JSON. Contiene `rootSeed`, `seriesId`, victorias por equipo y partida activa con `id`, vetos y selecciones en orden de aceptación, fuerza acumulada por equipo y `rng`. La suma de vetos y selecciones da el índice del siguiente turno. En `rng.draft` y `rng.match` se conservan, en el orden de `getState()`, cuatro enteros con signo de 32 bits por flujo. Para restaurar, `xoroshiro128plusFromState` recibe esas cuatro palabras. Por ejemplo, antes del primer turno de la semilla 2:

```json
{"draft":[-1,1805070227,-1805070228,0],"match":[-1,-469212320,469212319,0]}
```

El log está en `facts`. Para #76, guardar estado y ambos flujos junto con los hechos nuevos en una transacción, con una posición estable por serie para reintentos. Registrar `game_version`, `content_version`, `sim_version` y `schema_version`. La versión de contenido identifica equipos, campeones y orden del catálogo. La de simulación identifica el orden de turnos, el hash y su codificación, el algoritmo y versión del PRNG, la puntuación y el desempate.

En memoria se serializó y recuperó la semilla 2 tras 27 turnos, ya en la segunda partida. Al continuar, el estado, ambos RNG y el log completo coincidieron con la serie ininterrumpida. T5 queda pendiente de probar en #76 los cortes antes y después de `COMMIT`, el reintento y el intercambio de la carrera entre sistemas.
