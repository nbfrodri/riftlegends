# Plan 03 — Spikes de validación del stack

- **Estado:** ejecutado (20-11-2026); resultado: **go** ([ADR 0003](../decisions/0003-go-no-go-fase1.md)). Aprobado el 20-11-2026. Borrador de Codex (`gpt-6.2-astra`, high), revisado por Claude y aprobado por el usuario con los umbrales tal cual.
- **Fase:** 1 · Spikes de validación ([plan general](00-plan-general.md)).
- **Objetivo:** decidir si Electron + TypeScript + React permite producir y retocar el draft *broadcast*, mantener una carrera determinista y distribuir una app jugable sin conexión en Windows y Linux. El ADR 0003 recogerá la decisión antes del primer hito jugable.

## Decisiones vigentes

- La referencia visual ya está aprobada. Caja usa dos torres y una placa central en proporción 1:2:1, Unbounded para nombres, Archivo con cifras tabulares para reloj y tabla, y un barrido de *lock-in* de 320 ms. Con movimiento reducido, el cierre se anuncia de inmediato. [ADR 0002](../decisions/0002-estilo-visual.md) · [Maqueta Caja](../../design/visual-style/caja/index.html)
- El núcleo puro se ejecuta en un único `utilityProcess`, único escritor de un SQLite por carrera. El contenido ficticio permite jugar desde el primer arranque. El arte de Riot se descarga en ejecución. El plan B es Godot + C# si fracasa la prueba del draft *broadcast*. [ADR 0001](../decisions/0001-stack-tecnologico.md)
- La exención de TDD cubre los prototipos desechables. Se conservan las evidencias, los casos de prueba y las decisiones. Toda implementación que pase al producto se reescribe con el ciclo rojo → verde → refactor. [Guía del proyecto](../../AGENTS.md)

## Decisiones del usuario (20-11-2026)

- **Umbrales aprobados tal cual:** respuesta al confirmar ≤ 100 ms (p95), ≥ 55 FPS de media y p95 entre fotogramas ≤ 25 ms durante la animación; coste de retoque ≤ 30 min con un agente.
- **Equipos:** se mide en el **PC del usuario con Arch (Hyprland, Wayland)** y en el **CI de Windows**. El CI no tiene GPU real: en Windows valida el funcionamiento (T2, T4, T6 y T7 automatizables), pero **no** los presupuestos de FPS y latencia de T1–T3, que se exigen en Arch. Antes de la primera release pública se repetirá T1 a mano en un Windows con GPU (riesgo aceptado).
- **Orden:** #64 (endurecer Electron) y #66 (reloj del núcleo) van **antes** de los spikes; #65 y #67–#69 en paralelo.

## Fuera de alcance

IA definitiva, balance de la simulación, todas las variantes de draft, contratos IPC de producción (plan 04), infraestructura definitiva de determinismo (plan 05), caché completa de contenido (plan 10), actualizador y publicación. S4 y S5 corresponden a alternativas descartadas. S6 espera un volumen de historial representativo.

## Tests primero (criterios de aceptación)

El ADR 0001 cita 100 ms al confirmar y una pantalla en blanco reproducible en Wayland como ejemplos de descarte. Los presupuestos de FPS y tiempo de retoque de esta tabla son **propuestas para aprobación**. Cada plataforma debe cumplirlos por separado.

| # | Comportamiento | Test | Tipo |
| --- | --- | --- | --- |
| T1 | La secuencia *ban → cuenta atrás → lock-in* se lee y responde en ambos sistemas | Comparar con Caja. Desde la entrada de confirmación hasta el primer fotograma visible de respuesta, p95 ≤100 ms. Durante la animación, ≥55 FPS medios a 60 Hz y p95 de intervalo entre fotogramas ≤25 ms. Cero pantallas en blanco reproducibles. Con movimiento reducido se anuncia el cierre inmediatamente. | Medición + revisión visual |
| T2 | Se vuelve de Draft a Mercado y se navegan 500 jugadores solo con teclado | Ordenar, filtrar, limpiar, recorrer con flechas y saltar con Fin a la fila 500 e Inicio a la primera. El foco permanece visible y corresponde al jugador esperado. Durante el desplazamiento se cumplen los presupuestos de T1, incluida la latencia tecla → foco visible. | E2E + medición |
| T3 | Un agente puede retocar el ritmo sin romper la escena | Adelantar 150 ms la entrada del rótulo posterior a la confirmación. Conservar el barrido de 320 ms, la respuesta inicial y el modo reducido. Vídeos antes/después aceptados y T1 en verde. Presupuesto propuesto de ≤30 min desde el encargo hasta la primera versión aceptable, incluidas las correcciones. | Ensayo cronometrado |
| T4 | Un draft legal y una serie Bo3 producen los mismos hechos en Windows y Linux | Rechazar turno incorrecto, campeón vetado o repetido sin consumir RNG. Con tres semillas fijas, ambos jobs de CI comparan el log completo con los mismos *goldens*, byte a byte. Cero divergencias. | Unitario + golden en CI |
| T5 | Interrumpir un guardado permite reabrir y terminar la misma serie | En la app empaquetada, cortar el escritor antes de `COMMIT` y después de `COMMIT` antes de responder. Reabrir, reintentar y continuar. Estado, RNG y log final coinciden con la ejecución ininterrumpida. Cero jornadas parciales y cero hechos duplicados. | Integración con SQLite real |
| T6 | El primer arranque permite terminar un draft ficticio sin red | Instalar NSIS en Windows limpio y abrir AppImage en Arch limpio, sin herramientas de desarrollo, caché ni red. Completar el draft, cerrar y reabrir. Instalar también la compilación B sobre A y continuar una carrera creada con A en ambos sistemas. | Manual sobre paquetes |
| T7 | Una descarga cortada puede reanudarse sin publicar datos incompletos | Cortar Data Dragon a mitad de un archivo y reiniciar la app sin red. El draft ficticio sigue disponible. Reconectar, conservar los archivos completos, recuperar el pendiente y comparar el resultado con una descarga íntegra. Cero cachés incompletas marcadas como válidas. | Integración + manual |

## Diseño

### S1 + S2 · Draft *broadcast* y tabla densa

**Preguntas.** ¿Se percibe la confirmación a tiempo mientras se dibujan los efectos? ¿Se puede volver a una tabla densa y recorrerla con precisión? ¿Cuánto cuesta una corrección real de dirección visual?

Usar el shell de `apps/desktop`, su navegación en memoria y los catálogos ES/EN. El DOM contiene cartas, reloj, botones, foco y anuncios. Motion coordina las transiciones y una capa PixiJS/WebGL2 dibuja el efecto de confirmación. En Mercado, alimentar la `DataTable` existente con 500 jugadores ficticios de ID estable. Medir primero sin virtualización. Si falla T2, repetir con TanStack Virtual y comprobar el foco al saltar a una fila fuera de pantalla.

Ejecutar el build de producción en Windows y Arch/Hyprland con Wayland nativo, a 1366×768 y 60 Hz. Tras un calentamiento, recoger tres tandas de veinte confirmaciones y recorridos de tabla por máquina. En la traza del compositor, medir desde el evento de entrada hasta la presentación del primer fotograma que muestra el cambio. Registrar p95, máximo, FPS y tiempos entre fotogramas durante el movimiento. Comprobar también la legibilidad a 1280×720. Para T3, entregar al agente la misma escena y un encargo escrito. Registrar modelo, *effort*, tiempo inicial de construcción, tiempo de retoque y número de revisiones.

**Destino.** Se desechan la escena, la instrumentación temporal y los 500 registros. Se conservan los vídeos, las trazas, el coste del retoque y la decisión sobre virtualización.

### S3 · Núcleo, determinismo y guardado

**Pregunta.** ¿Puede una carrera interrumpida continuar con exactamente los mismos hechos, incluso al cambiar de sistema operativo?

En `packages/core`, construir un draft por turnos y una Bo3 que termina al alcanzar dos victorias. Usar enteros, orden explícito y un PRNG de algoritmo fijado y estado serializable, por ejemplo `xoroshiro128plus` de `pure-rand`. Derivar semillas por hash estable de `(semilla raíz, ámbito, ID de serie, ID de partida)`. Fijar la codificación de entrada y el orden de los hechos. Ejecutar los mismos *goldens* en Ubuntu y Windows sobre el mismo commit de `main`, respetando la matriz de CI existente.

El adaptador SQLite vive fuera del paquete puro. El `utilityProcess` escribe estado, RNG y hechos *append-only* en una transacción y registra `game_version`, `content_version`, `sim_version` y `schema_version`. En T5, intercambiar además una carrera cerrada entre Windows y Linux y continuarla. Validar `node:sqlite` dentro de ambos paquetes instalados. Si falla ahí, empaquetar `better-sqlite3` para Electron y repetir T5–T6 en ambos sistemas.

**Destino.** Se desechan el IPC, el esquema y el simulador experimentales. Los vectores de semillas, logs esperados y puntos de interrupción pasan como casos de aceptación a los planes 04 y 05 y al de persistencia.

### S7 + S8 reducido · Instalación y contenido

**Preguntas.** ¿Qué recibe quien instala el juego sin red? ¿Puede recuperar una descarga interrumpida y seguir usando su carrera tras actualizar?

Generar NSIS y AppImage con `electron-builder`. Incluir dos equipos ficticios y campeones suficientes para completar todos los turnos. En T7, fijar la versión de Data Dragon y descargar a una ubicación temporal. Verificar integridad antes de activar la caché. Si el servidor no permite continuar por bytes, reiniciar solo el archivo incompleto. Registrar el comportamiento observado y el aviso de SmartScreen en Windows.

**Destino.** Se descartan el descargador y la configuración experimental de empaquetado. Se conservan la carrera ficticia de compatibilidad, las sumas de comprobación y el procedimiento de instalación y recuperación.

## Troceado en issues (Tarea de plan · milestone «Fase 1 — Spikes de validación»)

| Orden | Issue | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | Medir la escena Caja y un retoque de ritmo | `type:task`, `area:draft` | T1 y T3 documentados en ambos sistemas |
| 2 | Medir Mercado con 500 jugadores | `type:task`, `area:ui` | T2 y decisión sobre virtualización |
| 3 | Reproducir una Bo3 por semilla | `type:task`, `area:draft` | T4 con enlaces a ambos jobs |
| 4 | Instalar los paquetes y recuperar una serie interrumpida | `type:task`, `area:infra` | T5 y T6 con driver identificado |
| 5 | Reanudar la descarga de Data Dragon | `type:task`, `area:infra` | T7 en ambos paquetes |
| 6 | Resolver el go/no-go en el ADR 0003 | `type:docs`, `area:infra` | Veredicto trazable a T1–T7 y registro actualizado |

Un resultado negativo reproducible también cierra el experimento. El issue 4 usa el núcleo del 3. El 5 usa los paquetes del 4. El 6 reúne los resultados.

## Riesgos

Xvfb, el CI de Windows y una VM sin aceleración sirven para comprobar comportamiento, pero distorsionan las medidas de GPU: los presupuestos de T1–T3 solo se miden en el Arch físico. Usar equipos físicos para T1–T3 e imágenes limpias para T6. Guardar en `docs/research/spikes-2026-xx/` el commit, hardware, GPU, controlador, SO, protocolo, muestras y resultado por prueba. Enlazar artefactos pesados y conservar en el repo solo evidencias sin arte de Riot.

## Decisión go/no-go

**Go:** T1–T7 cumplen en ambas plataformas. El ADR 0003 confirma el stack y el driver, enlaza las evidencias y da paso a Fase 2.

**No-go:** si el *broadcast* incumple el presupuesto acordado, reproduce una pantalla en blanco en Wayland o excede el coste de retoque, repetir **la misma escena y el mismo encargo en Godot + C#**. Comparar con idéntico hardware, referencia y umbrales antes de decidir el cambio. Un fallo aislado de tabla exige resolver S2. Una divergencia o guardado parcial bloquea el avance. Una instalación dependiente de herramientas, una caché incompleta aceptada o una carrera anterior ilegible bloquea la distribución. El ADR 0003 identificará la prueba que debe repetirse para levantar cada bloqueo.

## Preguntas abiertas

Resueltas por el usuario el 20-11-2026 (ver «Decisiones del usuario»). La configuración del agente para T3 se elige al lanzar el issue, como el resto de delegaciones.
