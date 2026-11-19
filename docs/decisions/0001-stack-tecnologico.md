# ADR 0001 — Stack tecnológico de Rift Legends

- **Estado:** aceptada (pendiente de validar con los spikes S1+S2, S3 y S7+S8)
- **Fecha:** 2026-11-19
- **Entradas:** [IDEA.md](../../IDEA.md), [informe de stack](../research/stack-2026-11/reports/Stack%20tecnológico%20Rift%20Legends.md), revisión crítica de Codex (gpt-6.2-astra, effort high, dos rondas) y debate con Claude, respuestas del desarrollador.

## Decisión

**Combinación D: Electron + núcleo TypeScript + UI web (React).**
**Plan B: combinación A (Godot + núcleo C#)**, solo si el spike S1 demuestra que producir o retocar el draft *broadcast* en D resulta demasiado caro. F (Avalonia + C#) queda tercera, y volvería a competir si se reduce el alcance visual.

| Capa | Elección | Notas |
|---|---|---|
| Envoltorio | **Electron** (Chromium empaquetado) | El mismo renderizado en Windows y Linux, así que se evita WebKitGTK. |
| Lenguaje | **TypeScript** en todo el proyecto | Un solo lenguaje para el núcleo, la UI y el pipeline de datos. |
| Núcleo | Módulo TS puro, sin DOM ni Electron, ejecutado en **un único `utilityProcess`** | Es la única autoridad de la carrera y el único escritor de SQLite. Recibe comandos y emite hechos. |
| Determinismo | PRNG de biblioteca con algoritmo fijado y estado serializable (`pure-rand` u otro equivalente); semillas derivadas por hash; **enteros acotados o punto fijo** en las rutas que deciden resultados | Prohibido dentro del núcleo: `Math.random`, leer el reloj e iterar sin un orden explícito. |
| Persistencia | **SQLite, un fichero por carrera**: `node:sqlite` validado en el build empaquetado, con `better-sqlite3` como respaldo | Se guardan el estado actual, el estado del PRNG y los **hechos append-only** de cada jornada en una sola transacción. **Sin event sourcing integral.** |
| Compatibilidad | Las carreras guardadas siguen cargando tras actualizar el juego, **mediante migraciones** | Cada carrera registra `game_version`, `content_version`, `sim_version` y `schema_version`. Los partidos antiguos no se vuelven a simular. |
| UI | **React 19** + TanStack Table (y TanStack Virtual cuando la tabla lo necesite) | Zustand queda aplazado hasta que dos pantallas compartan estado transitorio. |
| Animación | CSS para lo sencillo, **Motion** (MIT) para transiciones de UI y **PixiJS/WebGL2** para los efectos *broadcast* del draft y el minimapa | **Sin GSAP**, porque su licencia no es OSI. Rive web queda como opción incrustada más adelante. |
| Contenido | Datos validados con esquema (Zod/JSON Schema). Arte de LoL descargado en tiempo de ejecución desde Data Dragon (y CommunityDragon cuando haga falta) a una caché local. Datos de esports desde un snapshot offline de Leaguepedia en JSON, con fecha, procedencia y atribución CC BY-SA | El repo y los binarios **no contienen assets de Riot**. Un dataset ficticio mínimo (dos equipos y suficientes campeones para un draft legal) permite jugar sin red y ejecutar tests y CI. |
| Tests | **TDD obligatorio** (red → green → refactor; los spikes quedan exentos). Vitest + fast-check, golden tests de log de hechos, Testing Library, Playwright `_electron` para E2E y Stryker para mutation testing del núcleo | Propiedades clave: legalidad del draft, y que guardar, reabrir y continuar dé el mismo resultado que continuar sin guardar. |
| Empaquetado | electron-builder: **NSIS** (Windows), **AppImage + tar.gz** (Linux) | La actualización es manual al principio. |
| Firma | **Sin firma** al principio; se documentará el aviso de SmartScreen. Se solicitará SignPath cuando el proyecto sea público y tenga reputación | |
| Idioma | Código e identificadores en inglés; documentación, ADR y planes en español | |

## Respuestas del desarrollador que fijan el contexto

- **PI de Riot:** se usará contenido real de LoL (campeones, ligas, jugadores) **asumiendo el riesgo**.
- **Nombre:** se mantiene "Rift Legends", aunque coincide con la ERL oficial de Polonia.
- **Distribución:** solo GitHub Releases (itch.io queda descartado por ahora).
- **Licencia:** código MIT/Apache. **Repositorio privado** (ver los puntos abiertos).
- **DraftSim:** no se reutiliza su código; solo sus funcionalidades e ideas, que se irán redefiniendo una a una. No hay paridad numérica.
- **Lenguaje:** sin preferencia; la elección es técnica.
- **Draft:** de nivel *broadcast*, con cartas y transiciones. El detalle se definirá más adelante.
- **Hardware mínimo:** un PC gaming medio (8-16 GB de RAM), así que la memoria que consume Electron es aceptable.
- **Equipo de pruebas en Linux:** Omarchy/Arch con Wayland (Hyprland), además de Windows.
- **Visualización de partida:** primero un timeline de eventos y después un minimapa animado 2D.
- **Primer hito jugable:** un **draft rápido completo** (draft *broadcast* contra la IA, simulación de una serie y pantalla de resultado).
- **Ligas:** primero las top (LCK, LPL, LEC, LCS, CBLOL, LCP) y después las menores.
- **Jugadores:** reales al inicio y **regens ficticios** con el paso de los años. **No** habrá despido ni draft local para dos jugadores en el alcance inicial.

## Opciones descartadas

| Opción | Motivo |
|---|---|
| B · Godot + Rust (gdext) | Exige conversiones y depuración a través de la FFI en cada cambio de dominio, con una binding anterior a la 1.0. A ofrece el mismo draft sin ese coste. |
| C · Tauri + Rust | Supone dos lenguajes y dos motores web (WebKitGTK en Linux) solo para ahorrar tamaño de instalación, que no es un requisito. |
| E · Envoltorio web + núcleo WASM | Añade otra frontera de serialización y depuración. Ningún requisito pide una demo web ni portar un núcleo existente. |
| G · Rive como UI completa | No hay evidencia de una UI de gestión densa (tablas, foco, teclado) hecha en Rive, y el editor es cerrado. |
| H · Unity + C# | Es código cerrado, está en plena transición a Unity 7 y tiene historial de cambios de términos. Solo se justificaría con experiencia previa o con 3D. |
| NW.js | Aporta poco frente a Electron, que tiene mejor tooling. |
| GSAP | Su licencia no es OSI, lo que choca con SignPath. Motion y PixiJS cubren las mismas necesidades. |
| Event sourcing integral | Sobreingeniería: el historial se apoya en los hechos guardados, y el estado actual se persiste directamente. |

## Debate Claude ↔ Codex (resumen)

Codex propuso D en la primera ronda. En la segunda, con el requisito *broadcast* sobre la mesa, **subió A por encima de F**: el criterio deja de ser solo la fluidez y pasa a ser también *cuánto cuesta retocar el ritmo de la secuencia*. Aceptó las siete propuestas de Claude con estos matices: un único `utilityProcess` que es el único escritor, `node:sqlite` validado en el build empaquetado, Zustand aplazado, una separación de contenido con alcance pequeño (Data Dragon primero y CommunityDragon solo cuando haga falta) y SignPath condicionado a su revisión.

## Validación: spikes mínimos y criterios de descarte

1. **S1 + S2 (draft broadcast y tabla densa).** Acordar antes una referencia visual (ver el estilo visual delegado). Construir *ban → cuenta atrás → lock-in*, volver con teclado a una tabla de 500 jugadores y pedir al agente un retoque de ritmo. **Se descarta D** si incumple el presupuesto acordado de fluidez (por ejemplo, una respuesta visual de más de 100 ms al confirmar o una pantalla en blanco reproducible en Linux Wayland) o si cada retoque cuesta demasiado. En ese caso se repite la escena en A.
2. **S3 (núcleo determinista).** Interrumpir una serie durante el guardado y reabrirla en Windows y Linux. Bloquea el avance cualquier jornada parcial, hecho duplicado o divergencia con las mismas reglas, contenido y semilla.
3. **S7 + S8 reducido (instalación y contenido).** Instalar en máquinas limpias, completar un draft ficticio sin red e interrumpir y reanudar la descarga de los assets reales. Bloquea la release que la instalación dependa de herramientas de desarrollo, que se acepte como válida una caché incompleta o que deje de abrir una carrera anterior.

S4 y S5 se omiten porque G y B están descartadas. S6 (tamaño del log) se aplaza hasta tener volumen representativo.

## Riesgos residuales (por prioridad)

1. Retirada por PI o conflicto de nombre en el único canal de distribución (riesgo aceptado).
2. Coste de producir y revisar cada secuencia *broadcast* en solitario.
3. Tirones, consumo de memoria o fallos gráficos en Linux.
4. Carreras que divergen tras actualizar reglas o contenido.
5. Abandono en el primer arranque por SmartScreen o por una descarga interrumpida.

## Puntos abiertos

- **Repo privado frente a distribución (propuesta, pendiente de confirmar):** el repo principal es **privado**, con la documentación en español y el código en inglés. Un **repo público solo de releases** (por ejemplo `riftlegends-releases`), con un README, notas de versión, LICENSE y aviso de Riot en inglés, recibe los binarios desde un workflow del repo privado. Si algún día el repo principal se hace público, se traducirán los documentos, y solo entonces se solicitará SignPath. Hay que vigilar los minutos de Actions en el repo privado: la matriz de Windows se ejecutará solo en `main` y en las releases.
- **Estilo visual:** delegado a Codex (rama `design/visual-style`). Se elegirá entre cuatro direcciones.
- Detalle del draft *broadcast*, de la IA de draft y de cada sistema: se definirán en planes específicos derivados del plan general.
