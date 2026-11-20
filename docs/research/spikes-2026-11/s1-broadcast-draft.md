# S1 · Draft broadcast Caja

**T1 aprobado en la pasada completa con `power-saver`.** Con 60 confirmaciones, la latencia p95 fue de 27,3 ms, la media de 56,13 FPS y el intervalo p95 de 21,3 ms. La tanda más ajustada alcanzó 55,06 FPS. Una tanda preliminar cayó a 54,93 FPS, por lo que el margen de fluidez en batería es pequeño. La comparación con `balanced` sigue pendiente.

Ensayo del 20 de noviembre de 2026 para el issue #73. Escena desechable en `spike/73-broadcast-draft`, commit `19db294`. Build y medidor de la pasada por perfil en `54705d44d86255f758c4bb78b321099b111c866b`. La decisión conjunta sobre el stack corresponde al ADR 0003 tras T1–T7. [Plan 03](../../plans/03-spikes.md)

## Equipo y versiones

| Componente | Configuración observada |
| --- | --- |
| Equipo | HP EliteBook 840 G8, Intel Core i7-1185G7, 15,3 GiB de RAM utilizable. Batería en descarga durante la pasada. |
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

| Criterio T1 | Umbral o condición | `power-saver` · pasada completa | `balanced` |
| --- | --- | --- | --- |
| Respuesta visible estimada | p95 ≤100 ms | **Pasa** · p95 27,3 ms, máximo 29,0 ms | Pendiente |
| Fluidez durante el movimiento | Media ≥55 FPS | **Pasa** · 56,13 FPS | Pendiente |
| Intervalo entre fotogramas | p95 ≤25 ms | **Pasa** · p95 21,3 ms, máximo 24,3 ms | Pendiente |
| Pantallas en blanco | Cero reproducibles | **Pasa** · ninguna observada en las capturas de las tres tandas ni en la secuencia grabada | Pendiente |
| Movimiento reducido | Cierre inmediato | **Pasa** · «B4 confirmado · Veyra» en el primer callback, opacidad 1, cero animaciones de rótulo, barrido oculto y foco en el botón | Pendiente |
| Legibilidad a 1280×720 | Comparación visual con Caja | **Pasa** · reloj, B4, nombres y acción legibles. Columnas de 286,3 / 572,6 / 286,3 px y cero elementos examinados fuera de la ventana | Pendiente |
| **Veredicto T1** | Todos los criterios | **Aprobado en las tres tandas de la pasada completa** | **Pendiente** |

| Tanda en `power-saver` | Confirmaciones | Latencia p95 | Latencia máx. | FPS medios | Intervalo p95 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 20 | 26,4 ms | 27,3 ms | 55,97 | 21,3 ms |
| 2 | 20 | 27,7 ms | 28,2 ms | 55,06 | 21,5 ms |
| 3 | 20 | 27,3 ms | 29,0 ms | 57,37 | 21,1 ms |
| **Total** | **60** | **27,3 ms** | **29,0 ms** | **56,13** | **21,3 ms** |

Los CSV contienen 1580 intervalos. En la confirmación adicional trazada, Chromium registró 14,85 ms entre el inicio y el fin de `EventLatency` de la pulsación. El vídeo muestra el veto, el reloj pasando de 00:08 a 00:07, el barrido y el rótulo. En cada uno de sus 191 fotogramas decodificados, la diferencia entre el píxel más claro y el más oscuro de la zona central fue de al menos 192 niveles sobre 255.

**Alcance.** T3 queda pendiente del otro agente. T2 y T4–T7 corresponden a otros spikes. El presupuesto de GPU se evalúa en el Arch físico. El E2E de teclado queda disponible para la comprobación funcional en CI de Windows, pendiente de ejecución allí. En Linux pasaron `pnpm verify` (137 tests) y `pnpm e2e` (20 pasaron y se omitió la prueba exclusiva de Windows).

## Evidencias

Las marcas de tiempo de los CSV están en milisegundos desde el origen temporal de cada proceso. Los pares `run,confirmation` enlazan ambas tablas. [60 confirmaciones](s1-t1-power-saver.csv) · [Intervalos crudos](s1-t1-power-saver-frames.csv) · [Resultados, equipo y lecturas de energía](s1-t1-power-saver.json)

La traza comprimida contiene eventos de entrada y composición de Chromium y la marca `s1-confirm`. Las capturas y el vídeo recogen únicamente la ventana de Rift Legends. [Traza](s1-t1-power-saver-chromium.json.gz) · [Captura a 1366×768](s1-t1-power-saver-1366x768.png) · [Captura a 1280×720](s1-t1-power-saver-1280x720.png) · [Vídeo antes de T3](s1-t1-power-saver-before.webm)

**Ensayo preliminar.** El primer intento con `power-saver` completó las 60 mediciones y se interrumpió al abrir el vídeo por faltar FFmpeg 1013 en la caché de Playwright. Los FPS medios por tanda fueron 57,94, 54,93 y 55,03. Se conserva el resultado bajo el umbral. Se instaló el codificador de Playwright y se repitió desde el calentamiento con el mismo commit. La tabla principal usa exclusivamente la pasada completa. [Confirmaciones preliminares](s1-t1-power-saver-preliminar.csv) · [Intervalos preliminares](s1-t1-power-saver-preliminar-frames.csv)

## Encargo T3

> Adelantar 150 ms la entrada del rótulo posterior a la confirmación. Conservar el barrido de 320 ms, la respuesta inicial y el modo reducido. Vídeos antes/después aceptados y T1 en verde. Presupuesto propuesto de ≤30 min desde el encargo hasta la primera versión aceptable, incluidas las correcciones.

T3 queda pendiente del ejercicio cronometrado con otro agente. Registrar modelo, esfuerzo, hora de encargo, hora de aceptación, revisiones y ambos vídeos. Para la construcción de S1, `tack codex-used` registró `gpt-6.2-astra` con esfuerzo `high`. La escena y el primer medidor quedaron en el commit de las 12:45 CET, unos 12 minutos desde la preparación del worktree. El tiempo de T3 empieza al entregar el encargo. [Parámetros de la escena](../../../apps/desktop/src/renderer/draft/pacing.ts)

Desde la raíz, una vez seleccionado el perfil correspondiente, ejecutar `mise exec -- pnpm spike:t1 balanced` para obtener la segunda columna del ensayo base. Después del retoque, `mise exec -- pnpm spike:t1 power-saver-t3` repite T1 y escribe nuevas evidencias junto al informe. El primer componente de la etiqueta identifica el perfil activo y el sufijo distingue la revisión.
