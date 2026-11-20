# S1 · Draft broadcast Caja

**T1 aprobado en ambos perfiles de energía.** En `balanced` (con el cargador conectado), las 60 confirmaciones dieron 60,01 FPS medios, intervalo p95 de 16,7 ms y latencia p95 de 30,4 ms. En `power-saver` (con batería) dieron 56,13 FPS, 21,3 ms y 27,3 ms. La latencia apenas cambia entre perfiles. La fluidez sí: en `power-saver` el margen sobre el umbral de 55 FPS es de apenas 1 FPS, y una tanda preliminar quedó en 54,93. Con `balanced`, la Iris Xe mantiene los 60 Hz del panel sin perder fotogramas.

Ensayo del 20 de noviembre de 2026 para el issue #73. Escena desechable en `spike/73-broadcast-draft`, commit `19db294`. Se midió `power-saver` en `54705d44d86255f758c4bb78b321099b111c866b` y `balanced` en `5b3b091e20a390b97822a86df975fca7c60fd503` (el primer intento interrumpido, en `331536e`). Entre ambos commits se simplificó el observador de fotogramas. La escena era idéntica y ambos observadores dieron los mismos resultados al reproducir 108 secuencias de prueba. La decisión conjunta sobre el stack corresponde al ADR 0003 tras T1–T7. [Plan 03](../../plans/03-spikes.md)

## Equipo y versiones

| Componente | Configuración observada |
| --- | --- |
| Equipo | HP EliteBook 840 G8, Intel Core i7-1185G7, 15,3 GiB de RAM utilizable. En `power-saver` la batería estaba en descarga. Antes de lanzar `balanced`, `BAT0/status` indicaba `Discharging`. A las 19:55:09 CET, durante el ensayo, indicaba `Charging` y `AC/online` valía 1. Al conectarse la alimentación, el sistema volvió a poner `power-saver` y eso interrumpió el primer intento. La pasada completa de `balanced` (19:59–20:00 CET) se hizo con AC y el perfil estable en las ocho lecturas. |
| Sistema | Omarchy 4.5.0 (Arch), kernel 7.2.15-1-omarchy, Hyprland 0.56.2. |
| GPU y controlador | Intel Iris Xe Tiger Lake GT2, PCI `8086:9a49`, controlador `i915`, Mesa 26.2.5-1. El propio lienzo devolvió WebGL 2.0 con ANGLE sobre Intel y OpenGL ES 3.2. |
| Pantalla | Panel interno eDP-1, 1920×1080 físicos, 60,01 Hz, escala 1,25. El cliente Wayland era nativo (`xwayland: false`). Las resoluciones de ensayo son píxeles lógicos del contenido de la ventana. |
| Herramientas | Node 26.13.1 y pnpm 12.22.0 mediante mise. Electron 45.4.1, Chromium 156.0.8078.100, electron-vite 6.0.0, React 19.3.1 y Playwright 1.65.1. |

**Nota de catálogo de la rama.** Motion `14.13.0` (MIT, publicado el 12/11) coordina el barrido y la entrada del rótulo. PixiJS `8.23.0` (MIT, publicado el 11/11) dibuja el barrido sobre una capa WebGL2 transparente. Las dos versiones exactas pasaron la instalación congelada con la política de antigüedad. La rama incluye dos parches de declaraciones TypeScript para mantener la comprobación estricta con las versiones fijadas. Las fuentes locales Archivo y Unbounded son `5.3.0`. [Catálogo del proyecto](../../libraries.md)

## Escena y protocolo

Ascua veta a Nimbo. El reloj de ocho segundos inicia el turno de Bruma. Al confirmar a Veyra, la carta B4 y el texto de elección cambian de inmediato. Motion recorre la placa con la curva `cubic-bezier(.23,1,.32,1)` durante 320 ms. El rótulo inferior empieza a los 480 ms y entra en 120 ms. Con movimiento reducido, el mismo evento actualiza la región de estado con el rótulo completo. Los campeones son ficticios. La ilustración geométrica reutiliza el diseño de la maqueta Caja. [Referencia visual](../../../design/visual-style/caja/tokens.md)

1. Compilar con `electron-vite build`. Abrir el build con Playwright `_electron`, sandbox de Chromium, `--ozone-platform=wayland`, idioma español y un directorio de usuario nuevo por ejecución. Contrastar tamaño, frecuencia y cliente con Hyprland, y consultar el renderer del contexto WebGL2.
2. Consultar `powerprofilesctl get` al inicio, antes y después de cada tanda y tras la revisión visual. Rechazar una lectura distinta de la etiqueta solicitada. Las ocho lecturas y sus horas quedan en el JSON.
3. A 1366×768, ejecutar cinco confirmaciones de calentamiento por proceso y descartarlas. Medir otras veinte con clic de Playwright. Repetir con tres procesos independientes. Separar las capturas, el vídeo y la traza de las 60 muestras cronometradas.
4. Para cada confirmación, registrar `pointerdown.timeStamp`, el primer callback de `requestAnimationFrame` que encuentra a Veyra en B4 con «Elección confirmada», y el callback siguiente. La latencia publicada usa este último como aproximación a la primera presentación tras la actualización. El reloj empieza cuando Chromium recibe la entrada. La traza complementaria permite contrastar una confirmación con el compositor.
5. Registrar los intervalos entre callbacks que tocan el barrido (0–320 ms) o la entrada del rótulo (480–600 ms). Calcular FPS como 1000 × número de intervalos / suma de sus duraciones en ms. Calcular p95 por rango más próximo. Los valores conjuntos usan todas las muestras individuales.
6. A 1280×720, grabar veto, cuenta atrás y confirmación. Comprobar las fuentes y los límites de cartas, nombres y botón. Con movimiento reducido, confirmar por teclado y comprobar en el primer callback el texto del anuncio, su opacidad, el foco y la ausencia del barrido. La prueba de accesibilidad cubre el contenido de la región viva. La verbalización depende del lector de pantalla.

## Resultados por perfil

| Criterio T1 | Umbral o condición | `power-saver` · pasada completa | `balanced` · pasada completa |
| --- | --- | --- | --- |
| Respuesta visible estimada | p95 ≤100 ms | **Pasa** · p95 27,3 ms, máximo 29,0 ms | **Pasa** · p95 30,4 ms, máximo 31,6 ms |
| Fluidez durante el movimiento | Media ≥55 FPS | **Pasa** · 56,13 FPS | **Pasa** · 60,01 FPS |
| Intervalo entre fotogramas | p95 ≤25 ms | **Pasa** · p95 21,3 ms, máximo 24,3 ms | **Pasa** · p95 16,7 ms, máximo 16,8 ms |
| Pantallas en blanco | Cero reproducibles | **Pasa** · ninguna observada en las capturas de las tres tandas ni en la secuencia grabada | **Pasa** · mismas comprobaciones, ninguna observada |
| Movimiento reducido | Cierre inmediato | **Pasa** · «B4 confirmado · Veyra» en el primer callback, opacidad 1, cero animaciones de rótulo, barrido oculto y foco en el botón | **Pasa** · mismo resultado |
| Legibilidad a 1280×720 | Comparación visual con Caja | **Pasa** · reloj, B4, nombres y acción legibles. Columnas de 286,3 / 572,6 / 286,3 px y cero elementos examinados fuera de la ventana | **Pasa** · mismo resultado |
| **Veredicto T1** | Todos los criterios | **Aprobado en las tres tandas de la pasada completa** | **Aprobado en las tres tandas de la pasada completa** |

| Tanda en `power-saver` | Confirmaciones | Latencia p95 | Latencia máx. | FPS medios | Intervalo p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 20 | 26,4 ms | 27,3 ms | 55,97 | 21,3 ms |
| 2 | 20 | 27,7 ms | 28,2 ms | 55,06 | 21,5 ms |
| 3 | 20 | 27,3 ms | 29,0 ms | 57,37 | 21,1 ms |
| **Total** | **60** | **27,3 ms** | **29,0 ms** | **56,13** | **21,3 ms** |

| Tanda en `balanced` | Confirmaciones | Latencia p95 | Latencia máx. | FPS medios | Intervalo p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 20 | 29,1 ms | 30,6 ms | 60,00 | 16,8 ms |
| 2 | 20 | 29,7 ms | 31,1 ms | 60,01 | 16,7 ms |
| 3 | 20 | 30,4 ms | 31,6 ms | 60,01 | 16,7 ms |
| **Total** | **60** | **30,4 ms** | **31,6 ms** | **60,01** | **16,7 ms** |

Los CSV contienen 1580 intervalos en `power-saver` y 1683 en `balanced`. En la confirmación adicional trazada, Chromium registró 14,85 ms entre el inicio y el fin de `EventLatency` de la pulsación. El vídeo muestra el veto, el reloj pasando de 00:08 a 00:07, el barrido y el rótulo. En cada uno de sus 191 fotogramas decodificados, la diferencia entre el píxel más claro y el más oscuro de la zona central fue de al menos 192 niveles sobre 255.

**Alcance.** T3 queda pendiente del otro agente. T2 y T4–T7 corresponden a otros spikes. El presupuesto de GPU se evalúa en el Arch físico. El E2E de teclado queda disponible para la comprobación funcional en CI de Windows, pendiente de ejecución allí. En Linux pasaron `pnpm verify` (137 tests) y `pnpm e2e` (20 pasaron y se omitió la prueba exclusiva de Windows).

## Evidencias

Las marcas de tiempo de los CSV están en milisegundos desde el origen temporal de cada proceso. Los pares `run,confirmation` enlazan cada confirmación con sus intervalos. La traza comprimida contiene eventos de entrada y composición de Chromium y la marca `s1-confirm`.

| Perfil | Muestras crudas | Resultados y lecturas de energía | Evidencias visuales |
| --- | --- | --- | --- |
| `power-saver` | [Confirmaciones](s1-t1-power-saver.csv) · [Intervalos](s1-t1-power-saver-frames.csv) | [JSON](s1-t1-power-saver.json) · [Traza](s1-t1-power-saver-chromium.json.gz) | [1366×768](s1-t1-power-saver-1366x768.png) · [1280×720](s1-t1-power-saver-1280x720.png) · [Vídeo anterior a T3](s1-t1-power-saver-before.webm) |
| `balanced` | [Confirmaciones](s1-t1-balanced.csv) · [Intervalos](s1-t1-balanced-frames.csv) | [JSON](s1-t1-balanced.json) · [Traza](s1-t1-balanced-chromium.json.gz) | [1366×768](s1-t1-balanced-1366x768.png) · [1280×720](s1-t1-balanced-1280x720.png) · [Vídeo anterior a T3](s1-t1-balanced-before.webm) |

**Primer intento en `balanced`.** La consulta inicial y las de ambos extremos de la primera tanda confirmaron `balanced`. Tras cinco calentamientos, las primeras 20 confirmaciones dieron 28,2 ms de latencia p95, 29,6 ms de máxima, 59,60 FPS medios y 16,8 ms de intervalo p95. Al finalizar la segunda tanda, `powerprofilesctl get` devolvió `power-saver` y el medidor interrumpió la ejecución antes de incorporar esas muestras. El intento quedó fuera de la comparación y se repitió completo con AC. [20 confirmaciones válidas](s1-t1-balanced-interrumpida.csv) · [560 intervalos](s1-t1-balanced-interrumpida-frames.csv)

**Ensayo preliminar.** El primer intento con `power-saver` completó las 60 mediciones y se interrumpió al abrir el vídeo por faltar FFmpeg 1013 en la caché de Playwright. Los FPS medios por tanda fueron 57,94, 54,93 y 55,03. Se conserva el resultado bajo el umbral. Se instaló el codificador de Playwright y se repitió desde el calentamiento con el mismo commit. La tabla principal usa exclusivamente la pasada completa. [Confirmaciones preliminares](s1-t1-power-saver-preliminar.csv) · [Intervalos preliminares](s1-t1-power-saver-preliminar-frames.csv)

## Encargo T3

> Adelantar 150 ms la entrada del rótulo posterior a la confirmación. Conservar el barrido de 320 ms, la respuesta inicial y el modo reducido. Vídeos antes/después aceptados y T1 en verde. Presupuesto propuesto de ≤30 min desde el encargo hasta la primera versión aceptable, incluidas las correcciones.

T3 queda pendiente del ejercicio cronometrado con otro agente. Registrar modelo, esfuerzo, hora de encargo, hora de aceptación, revisiones y ambos vídeos. Para la construcción de S1, `tack codex-used` registró `gpt-6.2-astra` con esfuerzo `high`. La escena y el primer medidor quedaron en el commit de las 12:45 CET, unos 12 minutos desde la preparación del worktree. El tiempo de T3 empieza al entregar el encargo. [Parámetros de la escena](https://github.com/nbfrodri/riftlegends/blob/spike/73-broadcast-draft/apps/desktop/src/renderer/draft/pacing.ts)

Después del retoque, ejecutar desde la raíz `mise exec -- pnpm spike:t1 power-saver-t3` o `mise exec -- pnpm spike:t1 balanced-t3` según el perfil activo. Cada comando repite el ensayo completo y guarda los CSV, la traza, el vídeo y las capturas con el sufijo `-t3` junto al informe.
