# S2 · Tabla densa de Mercado con 500 jugadores (T2)

- **Issue:** #74 · **Plan:** [03-spikes](../../plans/03-spikes.md) (T2) · **Rama:** `spike/74-dense-table` (no se fusiona; el código es desechable y queda como referencia).
- **Fecha:** 20-11-2026.
- **Commit medido:** `13a0d2a` (`feat(ui-kit): window DataTable rows with TanStack Virtual for spike S2`). El commit posterior `2a9ef0c` solo corrige formato y tipos del código del spike; no cambia el comportamiento medido.
- **Veredicto:** **Sin virtualización: NO CUMPLE T2** (FPS y p95 entre fotogramas fuera de presupuesto). **Con `@tanstack/react-virtual`: CUMPLE T2.** **Decisión: la `DataTable` de Mercado se virtualiza.**

## Equipo y entorno

| Dato | Valor |
| --- | --- |
| Máquina | Portátil HP, Intel Core i7-1185G7 (8 hilos), 16 GB de RAM |
| GPU | Intel Iris Xe (TigerLake-LP GT2), `00:02.0`, controlador de kernel `i915`, Mesa 26.2.5 (`vulkan-intel` 26.2.5, `intel-media-driver` 26.3.5). `glxinfo` no está instalado; el estado de la GPU en Chromium se capturó con `app.getGPUFeatureStatus()` (`gpu_compositing`, `rasterization`, `opengl`, `webgl` y `webgpu` activos; Vulkan desactivado) |
| SO / kernel | Arch Linux (Omarchy), Linux 7.2.15-1-omarchy |
| Compositor | Hyprland 0.56.2 (`v0.56.2`, commit `efb50993`), Wayland nativo (`xwayland: false` en `hyprctl clients`), Wayland 1.26.0 |
| Pantalla | eDP-1 1920×1080 a 60,01 Hz, escala 1,25 (`devicePixelRatio` 1,25) |
| Ventana | Flotante de 1366×768 px lógicos (`hyprctl`: `size 1366 768`; `innerWidth × innerHeight` = 1366×768) |
| Electron | 45.4.1 (Chromium 156.0.8078.100), build de producción con `electron-vite build` y `playwright._electron.launch` con `--ozone-platform=wayland` |
| Carga ambiente | Sesión del usuario abierta (navegador y terminales). Media de carga al empezar: 1,7; al terminar: 0,5 |
| Perfil de energía | **`power-saver`** (gobernador `powersave`, equipo conectado a la red). No se cambió, así que las medidas son prudentes para CPU |

## Protocolo

1. **Datos.** 500 jugadores ficticios con ID estable `p-0001`…`p-0500`, generados con `mulberry32` (semilla 74) en `apps/desktop/src/renderer/spike-players.ts`. Hay nombres repetidos a propósito, y la ordenación estable desempata por posición original. Sin datos de Riot.
2. **Build.** `electron-vite build` (sin virtualización) y `VITE_S2_VIRTUAL=1 electron-vite build` (con virtualización). La app se lanza desde el build, no desde el dev server.
3. **Flujo por teclado** (`apps/desktop/spike/s2-dense-table.spec.ts`; Playwright solo envía teclas, no hace clics). Cada tanda hace:
   1. Volver de Draft a Mercado con el teclado (Tab hasta la barra lateral, flechas y Intro).
   2. Ordenar por Valoración (Intro: ascendente y descendente) y por Jugador.
   3. Filtrar escribiendo «bruma» y comprobar el resultado.
   4. Recorrer las filas filtradas con flechas, Fin e Inicio.
   5. Limpiar el filtro (Ctrl+A y Retroceso).
   6. Pulsar ↓ 499 veces (una pulsación cada ~12 ms más el tiempo de ida y vuelta de CDP) hasta la fila 500.
   7. Saltar con Fin e Inicio 20 veces cada uno.
   8. Mantener ↓ pulsada 300 repeticiones (cadencia de 33 ms, ~30 Hz, la de un teclado normal) y luego ↑ 300 desde la fila 500.
4. **Verificación del foco.** Tras cada paso, el script compara por ID el jugador enfocado con el esperado. El orden esperado se calcula en Node, de forma independiente al DOM (misma ordenación estable que TanStack Table). Además comprueba que la fila está completa dentro de la región con scroll y por debajo de la cabecera fija, que el estilo calculado es `outline-style: solid` con anchura > 0 y que cumple `:focus-visible`. También comprueba que cada fila montada está en el índice esperado.
5. **Latencia tecla → foco visible.** Se mide, en la página, desde `event.timeStamp` del `keydown` hasta la primera tarea posterior al `requestAnimationFrame` que sigue al cambio visible, con `performance.now()`. En ordenar, filtrar y limpiar, el cambio visible es el resultado esperado en el DOM (por ejemplo, `aria-sort` y primera fila correctos). Como segunda medida, más prudente porque llega hasta la presentación del fotograma (con granularidad de 8 ms), se recoge el Event Timing API (`PerformanceEventTiming.duration` de los `keydown`).
6. **FPS e intervalo entre fotogramas.** Un bucle `requestAnimationFrame` continuo anota las marcas de tiempo durante toda la tanda. Los FPS y el p95 se calculan sobre las fases de recorrido (ver CSV de fotogramas).
7. **Tandas.** 1 de calentamiento (descartada) y **3 medidas**, en la misma instancia de la app; cada una vuelve a montar Mercado desde Draft. Por variante y tanda: 1152 muestras de recorrido y 62 comprobaciones de corrección (248 en total con el calentamiento, **0 fallos en ambas variantes**).
8. **Control sin instrumentación** (`s2-bare.spec.ts`). Sin ningún listener en la página, solo el muestreo de fotogramas, para demostrar que la instrumentación no es la causa de los fotogramas perdidos. Mantiene ↓ 300 veces a ~30 Hz, 4 repeticiones.

### Limitaciones del protocolo

- La latencia no usa la traza del compositor de Hyprland (el plan lo pide para T1). Se aproxima con la tarea posterior al fotograma y con Event Timing; ninguna incluye el tiempo hasta el escaneo físico de la pantalla.
- `event.timeStamp` es la hora a la que el navegador recibió el evento de CDP, no la del evento físico del teclado.
- No se midió a 1280×720, con rueda de ratón, Re Pág / Av Pág ni en Windows.
- Con ↓ mantenida en el build sin virtualización, la latencia de la instrumentación completa crece por acumulación (mediana ~7 s, ver tabla). No es una cifra fiable de latencia: indica que el hilo principal no sostiene los 30 Hz. La cifra fiable de ese caso es la de FPS del control sin instrumentación.
- El build sin virtualización se midió con el árbol que ya incluía el código de virtualización con `virtualize = false` (el sobrecoste es un `useVirtualizer` con `count: 0`). Una sonda previa sobre el código sin ese cambio dio los mismos FPS (≈44).
- Las medidas se tomaron en perfil `power-saver`. Para el build sin virtualización, un perfil `balanced` o `performance` podría mejorar las cifras, pero la distancia al presupuesto (≈45 ms por paso frente a 16,7 ms) hace improbable que pase; conviene repetirlo en el equipo del usuario con otro perfil antes de cerrar.

## Resultados frente a los umbrales (T1 aplicado a T2)

Umbrales: p95 de tecla → foco visible ≤ 100 ms · FPS medios ≥ 55 · p95 entre fotogramas ≤ 25 ms. Tres tandas medidas (T1/T2/T3 en cada celda).

### Sin virtualización (500 filas montadas)

| Métrica | Tanda 1 | Tanda 2 | Tanda 3 | Umbral | Resultado |
| --- | --- | --- | --- | --- | --- |
| FPS · ↓ pulsaciones sueltas (500) | 45,5 | 45,5 | 43,7 | ≥ 55 | **No cumple** |
| FPS · Inicio/Fin | 47,9 | 48,3 | 47,6 | ≥ 55 | **No cumple** |
| FPS · ↓ mantenida | 22,7 | 22,8 | 21,8 | ≥ 55 | **No cumple** |
| FPS · todo el recorrido | 36,8 | 37,0 | 35,6 | ≥ 55 | **No cumple** |
| p95 entre fotogramas · ↓ sueltas (ms) | 33,5 | 33,4 | 49,9 | ≤ 25 | **No cumple** |
| p95 entre fotogramas · Inicio/Fin (ms) | 66,6 | 59,1 | 66,6 | ≤ 25 | **No cumple** |
| p95 entre fotogramas · ↓ mantenida (ms) | 50,1 | 50,1 | 50,1 | ≤ 25 | **No cumple** |
| Máximo entre fotogramas · todo (ms) | 100,1 | 83,4 | 100,1 | — | — |
| p95 tecla → foco · ↓ sueltas (ms) | 74,9 | 74,6 | 77,6 | ≤ 100 | Cumple |
| p95 tecla → foco · Inicio/Fin (ms) | 80,6 | 79,7 | 84,0 | ≤ 100 | Cumple |
| p95 tecla → foco · ↓ mantenida (ms) | 13 045 | 12 914 | 13 598 | ≤ 100 | No fiable (acumulación; no cumple) |
| Event Timing `keydown`, p95 / máx. (ms) | 96 / 272 | 96 / 232 | 96 / 232 | ≤ 100 | Cumple por poco |
| Foco visible y en el jugador correcto | 0 fallos | 0 fallos | 0 fallos | 100 % | Cumple |
| Control sin instrumentación · ↓ mantenida: FPS / p95 intervalo | 22,7 / 50,1 | 23,0 / 50,1 | 22,7 / 50,1 | ≥ 55 / ≤ 25 | **No cumple** (4.ª repetición: 23,7 / 50,1) |

Con el filtro «bruma» (~50 filas) el mismo componente sí cumple: 60,0 FPS, p95 de 16,8 ms y p95 tecla → foco de ≈25 ms. El coste es proporcional a las filas montadas (cada paso con 500 filas tarda ~45 ms de hilo principal). Cada cambio de foco re-renderiza las 500 filas por el `setActiveId` del tab stop móvil. Ordenar 500 filas tarda 171–186 ms (p95) en llegar al foco visible, y limpiar el filtro, 157–162 ms.

### Con `@tanstack/react-virtual` 3.14.26 (34 filas montadas)

| Métrica | Tanda 1 | Tanda 2 | Tanda 3 | Umbral | Resultado |
| --- | --- | --- | --- | --- | --- |
| FPS · ↓ pulsaciones sueltas (500) | 60,0 | 60,0 | 60,0 | ≥ 55 | Cumple |
| FPS · Inicio/Fin | 60,0 | 60,0 | 60,0 | ≥ 55 | Cumple |
| FPS · ↓ mantenida | 60,0 | 60,0 | 60,0 | ≥ 55 | Cumple |
| FPS · todo el recorrido | 60,0 | 60,0 | 60,0 | ≥ 55 | Cumple |
| p95 entre fotogramas · todo (ms) | 16,7 | 16,7 | 16,7 | ≤ 25 | Cumple |
| Máximo entre fotogramas · todo (ms) | 17,5 | 17,5 | 17,9 | — | — |
| p95 tecla → foco · ↓ sueltas (ms) | 24,5 | 24,1 | 23,9 | ≤ 100 | Cumple |
| p95 tecla → foco · Inicio/Fin (ms) | 36,0 | 33,6 | 35,6 | ≤ 100 | Cumple |
| p95 tecla → foco · ↓ mantenida (ms) | 22,2 | 23,7 | 24,0 | ≤ 100 | Cumple |
| p95 tecla → foco · todo el recorrido (ms) | 27,0 | 26,4 | 26,7 | ≤ 100 | Cumple |
| Máximo tecla → foco · todo (ms) | 48,6 | 49,0 | 46,4 | — | — |
| Event Timing `keydown`, p95 / máx. (ms) | 48 / 80 | 48 / 72 | 48 / 80 | ≤ 100 | Cumple |
| Foco visible y en el jugador correcto | 0 fallos | 0 fallos | 0 fallos | 100 % | Cumple |
| Control sin instrumentación · ↓ mantenida: FPS / p95 intervalo | 60,0 / 16,7 | 60,0 / 16,7 | 59,9 / 16,7 | ≥ 55 / ≤ 25 | Cumple |
| Ordenar / filtrar / limpiar, p95 hasta el resultado (ms) | 28 / 32 / 34 | 34 / 30 / 26 | 27 / 31 / 26 | — | Informativo |

Los 60,0 FPS son el techo de la pantalla: el bucle de `requestAnimationFrame` fuerza fotogramas continuos, de modo que un valor de 60 indica que ningún paso del recorrido hizo perder un fotograma.

## Foco al saltar a una fila fuera de pantalla (con virtualización)

La fila activa (el único tab stop del `tbody`) se mantiene siempre montada: el `rangeExtractor` añade su índice a la ventana y se insertan filas espaciadoras para que cada fila montada quede en su desplazamiento real. Al saltar con Fin a la fila 500 desde la 1, la fila de destino no está montada: se marca como activa, el siguiente render la monta, un `useLayoutEffect` le da el foco y el navegador la desplaza hasta verse. Resultados sobre 3 tandas × 20 saltos (Inicio/Fin) y 2 × 300 repeticiones mantenidas:

- El foco acaba siempre en el ID esperado (`p-…` de la fila 500 o la 1 en el orden activo), con anillo `:focus-visible` calculado de 3 px y la fila completa visible por debajo de la cabecera fija. 0 fallos en las 62 comprobaciones de cada tanda.
- Tab desde fuera de la tabla vuelve a la última fila activa aunque esté lejos de la ventana, porque sigue montada (se comprobó tras limpiar el filtro: el tab stop se conserva, es decir, en el jugador activo y no necesariamente en la primera fila).
- Con la ordenación y el filtro activos, el 100 % de las filas montadas están en el índice esperado.

## Decisión sobre virtualización

**Se virtualiza la tabla de Mercado con `@tanstack/react-virtual`.** Sin virtualización, 500 filas incumplen el presupuesto de FPS y de intervalo entre fotogramas en todas las tandas (36 FPS de media; p95 de 50 ms; con ↓ mantenida, 22 FPS y el hilo principal acumula pulsaciones). La latencia de pulsaciones sueltas sí cumple (p95 75–84 ms), pero en el límite. Con virtualización, la misma tabla cumple con margen en todos los criterios: 60 FPS, p95 de 16,7 ms entre fotogramas y p95 de latencia ≤ 36 ms. El umbral del catálogo («cuando una tabla supere unas cien filas visibles») queda confirmado: el límite práctico en este equipo y perfil está entre ~50 filas (cumple sin virtualizar) y 500.

## Qué debe conservar la implementación real de Mercado

(La implementación real se reescribe con TDD; este código no se fusiona.)

1. **Fila activa siempre montada** (`rangeExtractor` con el índice del tab stop) con filas espaciadoras (`aria-hidden`) para mantener los desplazamientos reales. Sin esto, Tab no puede entrar a la tabla si la fila activa quedó fuera de la ventana.
2. **Ruta de foco diferido:** si la fila de destino no está montada, marcarla como activa y darle el foco en `useLayoutEffect` cuando aparezca (Fin, Inicio, RePág/AvPág).
3. **`scrollMargin` igual a la altura de la cabecera fija** y `scroll-pt-8` en la región, para que el foco no quede bajo la cabecera.
4. **Altura de fila medida (`measureElement`)**, porque es `clamp(24px, 3vh, 30px)` y varía con el alto de la ventana.
5. **Semántica accesible:** `aria-rowcount` en la tabla y `aria-rowindex` en cada fila (no se probó con un lector de pantalla). Verificar el comportamiento antes del primer hito.
6. **Ganchos de prueba estables:** `data-row-id` y `data-index` en cada fila. El E2E de T2 se apoya en ellos para comprobar el foco por ID. La línea cada cinco filas debe basarse en el índice (`data-fifth`), no en `:nth-child`, que cambia con la ventana y las filas espaciadoras.
7. **Tab stop conservado tras limpiar el filtro:** es el último jugador activo; si se prefiere volver a la primera fila, es una decisión de producto.
8. Mantener el E2E de T2 (`apps/desktop/spike/s2-dense-table.spec.ts`) como base, con una versión reducida que corra en CI bajo Xvfb. Esa versión solo debe validar la corrección del foco, no los presupuestos de FPS ni de latencia, como ya dice el plan.

## Archivos de evidencia

CSV y JSON archivados en Git. La tanda 0 corresponde al calentamiento y se excluye de la medición.

| Archivo | Contenido |
| --- | --- |
| [`s2-plain-latency.csv`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-plain-latency.csv), [`s2-virtual-latency.csv`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-virtual-latency.csv) | Una fila por tecla: `run,phase,kind,key,t0_ms,tFrame_ms,latency_ms,id,inView,outline,hasFocus`. `kind=focus` son movimientos de fila; `kind=action` son ordenar/filtrar/limpiar. `t0_ms` es el `event.timeStamp` y `tFrame_ms`, la primera tarea tras el `requestAnimationFrame` siguiente |
| [`s2-plain-frames.csv`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-plain-frames.csv), [`s2-virtual-frames.csv`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-virtual-frames.csv) | Intervalo entre fotogramas por fase: `run,phase,t_ms,interval_ms` |
| [`s2-plain-eventtiming.csv`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-plain-eventtiming.csv), [`s2-virtual-eventtiming.csv`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-virtual-eventtiming.csv) | Event Timing de los `keydown` (≥ 16 ms): `run,startTime,duration` |
| [`s2-plain-summary.json`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-plain-summary.json), [`s2-virtual-summary.json`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-virtual-summary.json) | Entorno (ventana, GPU, versiones), comprobaciones de corrección y agregados por tanda |
| [`s2-plain-bare.json`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-plain-bare.json), [`s2-virtual-bare.json`](https://github.com/nbfrodri/riftlegends/blob/b9cacab637026e481880578b6ccdb33941754fb7/docs/research/spikes-2026-11/s2-virtual-bare.json) | Control sin instrumentación: FPS, p95 e intervalo máximo con ↓ mantenida, 4 repeticiones |

Reproducir: `mise exec -- pnpm --filter @rift-legends/desktop build` (con `VITE_S2_VIRTUAL=1` para la variante virtual) y, desde `apps/desktop`, `S2_VARIANT=plain|virtual S2_OUT=<dir> pnpm exec playwright test -c spike/playwright.config.ts`. El script flota y fija la ventana a 1366×768 con `hyprctl dispatch` (Hyprland 0.56 usa Lua: `hl.dsp.window.float({ ... window = "address:0x…" })`; **nunca** sin `window`, porque actúa sobre la ventana activa).

## Comprobaciones del repo en la rama

`pnpm verify`: Biome y `tsc -b` pasan. Fallan los 5 tests de `apps/desktop/test/market.test.tsx`, porque esperan los 36 jugadores de muestra y el spike alimenta la tabla con 500; el E2E de Mercado (`e2e/market.spec.ts`) falla por la misma razón y no se ejecutó. La rama no se fusiona, así que no se corrigieron.
