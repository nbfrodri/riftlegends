# Frameworks de UI de escritorio (sin motor de juego) para Rift Legends

> Notas de investigación, fecha de corte 19-11-2026. Presupuesto: unas 15 búsquedas y lecturas web. Las afirmaciones marcadas **[conocimiento previo, sin verificar]** salen del conocimiento del modelo (corte en junio de 2026) y no se comprobaron en esta sesión. Que nadie las cite como hechos verificados. No se incluye una recomendación final, por petición expresa.

## 1. Envoltorios con tecnología web (Tauri 2, Electron, Electrobun, Wails v3, Neutralinojs, NW.js y nuevos de 2025-2026)

### Conclusión
Las cinco opciones siguen vivas y publicando versiones en 2026. Wails v3 alcanzó la versión estable (v3.0.0, 26-10-2026) y Electrobun la 1.x (v1, febrero de 2026). La diferencia estructural es el motor web. Tauri, Wails, Electrobun por defecto y Neutralino usan el webview del sistema, que en Linux es **WebKitGTK** y tiene problemas conocidos de GPU y NVIDIA. Electron y NW.js empaquetan Chromium, lo que hace pesar más el instalador pero da un renderizado idéntico en las tres plataformas. Para un juego con Linux como plataforma de primera clase y animaciones pesadas, este es el compromiso central.

### Hallazgos con fuente
- **Tauri 2 en Linux**: renderiza con WebKitGTK. La documentación oficial reconoce ventanas en blanco, parpadeo y cierres inesperados, sobre todo con GPU NVIDIA. `WEBKIT_DISABLE_DMABUF_RENDERER=1` arregla parte de los casos *a costa de perder la ruta de renderizado rápida*. `__NV_DISABLE_EXPLICIT_SYNC=1` suele resolver el "Error 71" de Wayland sin coste de rendimiento — [Tauri docs: Linux Graphics Issues](https://v2.tauri.app/develop/debug/linux-graphics/) (página viva, consultada en 11-2026).
- Tauri 2.0 pasó Linux a webkit2gtk-4.1 — [Tauri blog, 2.0.0-alpha.3](https://v2.tauri.app/blog/tauri-2-0-0-alpha-3/).
- tauri-runtime-wry 2.10.0 (02-02-2026) mantiene vivo el WebContext en Linux para evitar procesos WebKit zombis al cerrar y reabrir ventanas. También actualiza webkit2gtk-rs a 2.0.2, un cambio incompatible para quien use `with_webview` — [Tauri release notes](https://v2.tauri.app/release/tauri-runtime-wry/v2.10.0/). Indica mantenimiento activo de la capa Linux.
- Tauri usa WKWebView en macOS, webkit2gtk en Linux y WebView2 (Chromium) en Windows — [Tauri: Webview Versions](https://v2.tauri.app/reference/webview-versions/). Son tres motores distintos, así que hay que probar el renderizado en cada uno.
- **Tauri con CEF/Chromium**: la organización tauri-apps mantiene `cef-rs` (bindings de Rust para Chromium Embedded Framework) — [tauri-apps/cef-rs](https://github.com/tauri-apps/cef-rs). **No encontré confirmación** de que exista un runtime CEF oficial y estable para Tauri en noviembre de 2026. Otros proyectos sí ofrecen un backend CEF: Deno desktop lo lista como alternativa al webview del sistema — [Deno docs: desktop backends](https://docs.deno.com/runtime/desktop/backends/). El proyecto Laufey informa de problemas de CEF en Linux: el menú de aplicación no funciona y el reparenting falla en XWayland — [Laufey backends](https://littledivy.github.io/laufey/backends.html). Es una sola fuente.
- **Electron**: Electron 39 (Chromium 142, Node 22.20, V8 14.2) estabilizó la integridad ASAR. Le siguieron las líneas 40.x (enero de 2026, Chromium 144), 41.x (febrero de 2026) y 42.x (mayo de 2026) — [Electron 39 blog](https://electronjs.org/blog/electron-39-0); [Electron releases](https://releases.electronjs.org/release/v39.8.9). La cadencia de una versión mayor cada 8 semanas sigue el ritmo de Chromium. No encontré cifras oficiales de tamaño de paquete en 2026.
- **Electrobun**: v1 anunciada el 06-02-2026. Usa TypeScript sobre Bun, con una capa nativa en Zig sustituida mayoritariamente por la FFI de Bun. Funciona en macOS, Windows y Ubuntu, genera instaladores y aplica actualizaciones con parches diferenciales (zig-bsdiff y zstd). El post de lanzamiento no da cifras de tamaño — [Electrobun v1 blog](https://electrobun.dev/blog/electrobun-v1/). El autor lo creó porque no le atraía el requisito de Rust de Tauri — [blackboard.sh / lavx news](https://news.lavx.hu/article/electrobun-reaches-v1-a-new-contender-in-desktop-app-frameworks). npm ya va por la 1.18.1 — [socket.dev](https://socket.dev/npm/package/electrobun/overview/1.18.1), [changelog](https://framework.blackboard.sh/electrobun/guides/changelog/). Iteración muy rápida y proyecto joven, con un solo mantenedor principal según el blog.
- **Wails v3**: v3.0.0 estable el 26-10-2026, v3.1.0 marcada como "Latest" el 01-11-2026 y nightlies de la 3.2.0. La v2 sigue mantenida (v2.17.1 del 01-11-2026, con un parche de seguridad para Linux). `go @latest` resuelve a la versión semanal más reciente — [GitHub wailsapp/wails releases](https://github.com/wailsapp/wails/releases). Usa Go como backend, lo que no encaja si el núcleo de simulación está en Rust u otro lenguaje, salvo como proceso aparte.
- **Experiencia real de empaquetar un juego JS para PC** (JSLegendDev, 27-08-2025) — [Substack](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript):
  - Electron: el IPC entre frontend y backend resulta engorroso para guardar ficheros; la integración con Steam va vía steamworks.js; Forge solo compila para el SO anfitrión.
  - Tauri: lo complejo exige Rust, lo que bloqueó su integración con Steam; el renderizado varía entre plataformas y obliga a probar mucho.
  - Neutralinojs: API JS simple; lo complejo requiere un backend aparte conectado por WebSockets.
  - Wails: en su prueba no podía compilar para Linux. Esto es anterior a v3 y puede estar obsoleto.
  - NW.js: lo considera "lo más fácil con diferencia" para un juego. SteamDB lista **más de 5.700 juegos con NW.js**, sobre todo de RPG Maker y Construct.
- **Nuevos de 2025-2026**: Electrobun (arriba) y el modo escritorio de Deno con backends de webview del sistema o CEF — [Deno docs](https://docs.deno.com/runtime/desktop/backends/). No investigué a fondo otros candidatos.

### Inferencias
- Para Rift Legends, el mayor riesgo técnico de los envoltorios con webview del sistema es **WebKitGTK en Linux**: rendimiento de canvas y WebGL, rutas DMABUF en NVIDIA y diferencias de CSS frente a Chromium. Electron o NW.js eliminan ese riesgo a cambio de más tamaño y memoria, irrelevantes para un juego gratuito offline de escritorio.
- Si el núcleo de simulación está en Rust, Tauri ofrece el IPC más directo: comandos y eventos tipados con serde. Con Electron o Electrobun, el núcleo Rust tendría que ir como addon nativo (napi-rs), como WASM dentro del frontend o como proceso hijo.
- Un núcleo de simulación compilado a **WASM** vuelve casi intercambiable el envoltorio y permite además una demo web. Es una opción arquitectónica a valorar con independencia del shell.
- Todo funciona offline, porque los assets van empaquetados en todos los casos.

### Lagunas
- No encontré benchmarks fiables de 2026 que comparen Tauri y Electron en Linux, ni sobre tamaño ni sobre FPS de animación. Los artículos de tech-insider.org y dev.to que comparan tamaños tienen metodología opaca y cifras contradictorias, así que no los cito como datos.
- No confirmé el estado de un runtime CEF oficial para Tauri ni si Electrobun permite empaquetar CEF en Linux. **[Conocimiento previo, sin verificar]**: Electrobun ofrecía empaquetar CEF de forma opcional.
- No tengo datos actuales de Neutralinojs (versión de 2026, actividad).
- **[Conocimiento previo, sin verificar]**: tamaños típicos de unos 3-10 MB para Tauri y unos 80-150 MB para Electron.

## 2. Frameworks de frontend, animación, gráficos 2D, tablas y estado (para el shell web)

### Conclusión
El ecosistema de animación web es muy maduro y en 2026 casi todo es gratuito. **GSAP es 100 % gratis, incluidos los antiguos plugins Club**, tras la compra por Webflow. Su licencia "No Charge" solo prohíbe productos que compitan con Webflow como constructor visual de animaciones, y Rift Legends no es uno. PixiJS v8 y Phaser 4 (abril de 2026) cubren el 2D acelerado para el draft o el minimapa. PixiJS publica incluso "skills" oficiales para agentes de IA.

### Hallazgos con fuente
- **GSAP**: Webflow lo hizo 100 % gratuito para todos, clientes de Webflow o no, con los plugins de pago incluidos (SplitText, MorphSVG...) y permitido el uso comercial — [Webflow blog](https://webflow.com/blog/gsap-becomes-free); [gsap.com/pricing](https://www.gsap.com/pricing/); [GSAP README](https://raw.githubusercontent.com/greensock/GSAP/master/README.md). La licencia "Standard No Charge" excluye los "Competitive Products", es decir, herramientas que crean, editan o gestionan animaciones mediante un constructor visual similar a Webflow — [GSAP standard license](https://gsap.com/community/standard-license/); [texto de la licencia en ScanCode](https://scancode-licensedb.aboutcode.org/gsap-standard-no-charge-2025.html). **No es licencia OSI**: es propietaria y gratuita, y conviene tenerlo en cuenta si el proyecto se publica como código abierto.
- **PixiJS v8**: sigue activo. v8.20.0 (agosto de 2026) se centra en la ruta WebGPU y v8.20.1 se publicó el 27-08-2026. En junio de 2026 el equipo publicó **25 "skills" oficiales para enseñar PixiJS v8 a agentes de IA** — [PixiJS June 2026](https://pixijs.com/blog/june-2026); [gamedev.net](https://gamedev.net/news/5221-pixijs-v8200-released/).
- **Phaser 4** "Caladan": v4.0.0 del 10-04-2026, con un renderizador WebGL nuevo basado en render nodes y filtros aplicables a cualquier objeto. Último parche visto: v4.2.1 — [CHANGELOG v4.0.0](https://raw.githubusercontent.com/phaserjs/phaser/HEAD/changelog/v4/4.0/CHANGELOG-v4.0.0.md).

### Inferencias
- Un patrón natural sería el DOM con un framework de componentes para menús y tablas, más un lienzo PixiJS (o Three.js) superpuesto solo en el draft o el minimapa, con GSAP o Motion para las transiciones. Eso aprovecha lo mejor de ambos mundos y es un terreno muy conocido para los agentes de IA. React tiene la mayor cantidad de ejemplos y datos de entrenamiento.
- Phaser es un motor de juego completo. Para una UI de gestión probablemente sobra, y PixiJS como capa de renderizado encaja mejor. Esto es inferencia, no un benchmark.

### Lagunas (sin verificar en esta sesión)
- **[Conocimiento previo, sin verificar]**:
  - **Frameworks**: React 19 es estable desde diciembre de 2024; Svelte 5 (runes) desde octubre de 2024; SolidJS 1.x tiene la 2.0 en desarrollo; Vue 3.5 tiene Vapor Mode en desarrollo; Qwik apunta sobre todo a web con SSR, y para un escritorio offline su ventaja (resumability) apenas aporta.
  - **Motion** (antes Framer Motion) es MIT y tiene versiones para React, Vue y JS puro.
  - **anime.js v4** salió en 2025 con licencia MIT.
  - **Rive** tiene runtime MIT y máquinas de estado interactivas. Encaja bien para animaciones de UI "de juego", y hay una skill de Rive instalada en este entorno.
  - **Lottie**: lottie-web, o dotLottie con un runtime en Rust/WASM.
  - **Tablas**: TanStack Table es headless y MIT; AG Grid Community es MIT y Enterprise es de pago.
  - **Estado**: Zustand o Jotai en React, stores o runes en Svelte.
  - Hay que verificar versiones y fechas exactas antes de citarlas.
- No encontré benchmarks de animación DOM (GSAP o Motion) específicamente sobre WebKitGTK.

## 3. UI nativa (Avalonia, Uno, MAUI, Qt/QML, Slint, Flutter, Compose MP, Dioxus, Iced, egui, GPUI, Makepad, Xilem)

### Conclusión
Varios toolkits nativos maduraron en 2026: Avalonia 12 y 12.1 con Wayland nativo, Slint 1.15 a 1.18 con animaciones de muelle (spring), y Dioxus 0.7 con hot-patching. Aun así, ninguno iguala al ecosistema web en bibliotecas de animación listas para usar, componentes de tablas y datos de entrenamiento para agentes de IA. Qt/QML sigue siendo la opción nativa más probada para UIs animadas, pero no la verifiqué en esta sesión.

### Hallazgos con fuente
- **Avalonia 12**: publicada, centrada en los cimientos (rendimiento, móvil). Elimina el soporte de .NET Framework y .NET Standard y exige .NET 8 o superior — [Avalonia 12 blog](https://avaloniaui.net/blog/avalonia-12); [breaking changes](https://docs.avaloniaui.net/docs/avalonia12-breaking-changes). **Avalonia 12.1** añade Wayland nativo y mejoras de rendimiento del render — [What's new in 12.1](https://avaloniaui.net/blog/release-12-1). Ofrece animaciones por keyframes y transiciones disparadas por selectores — [v12 docs: animations](https://v12.docs.avaloniaui.net/concepts/ui-concepts/animations). Existen paquetes de terceros con catálogos de animaciones de composición — [Xaml.Behaviors.Animations](https://www.nuget.org/packages/Xaml.Behaviors.Animations/). No encontré las fechas exactas de 12 y 12.1.
- **Slint** (Rust, C++, JS y Python con su propio DSL `.slint`):
  - 1.15 (04-02-2026) — [blog](https://slint.dev/blog/slint-1.15-released).
  - 1.16 (16-04-2026): gestos multitáctiles y mejores animaciones de Flickable — [blog](https://slint.dev/blog/slint-1.16-released).
  - 1.17 (24-06-2026): enfoque de escritorio con drag and drop, bandeja del sistema y tooltips — [blog](https://slint.dev/blog/slint-1.17-released).
  - 1.18: **animaciones spring**, elementos que se mueven y rotan a lo largo de una ruta, z-order en tiempo de ejecución y FlexboxLayout, con UIs de estilo videojuego como caso de uso. La fuente es secundaria (Stackademic, de pago) y no tengo la fecha exacta — [Stackademic](https://blog.stackademic.com/slint-1-18-brings-flexbox-spring-animations-and-a-new-renderer-e12417666f80).
- **Dioxus 0.7** (03-11-2025): hot-patching de Rust en tiempo de ejecución ("Subsecond"). En escritorio usa un webview por defecto, con renderizado WGPU o Freya/Skia experimental. La última versión vista es 0.7.8 y la rama principal ya avanza hacia la 0.8 — [AlternativeTo news](https://alternativeto.net/news/2025/11/dioxus-0-7-brings-hot-patching-wgpu-rendering-and-axum-integration); [docs.rs dioxus 0.7.8](https://docs.rs/crate/dioxus/0.7.8/source/README.md). Ojo: en modo webview, Dioxus desktop **hereda los mismos problemas de WebKitGTK en Linux** que Tauri, porque usa wry.
- **Iced 0.14**: solo encontré un agregador de foros que menciona su publicación, sin fecha ni changelog. Dato no fiable.
- **GPUI (Zed)**: no encontré noticias de 2026 sobre una versión independiente de GPUI. Lo único fue un cambio interno de Zed de blade a wgpu, de fuente débil.

### Inferencias
- Para una "sensación de juego" en nativo, Qt/QML (con animaciones y estados declarativos, partículas y shaders) y Slint (springs y paths en 1.18) son los más orientados a la animación. Avalonia ofrece animaciones de composición correctas pero menos expresivas sin código extra.
- Para tablas densas, Avalonia (con DataGrid y TreeDataGrid) y Qt tienen controles nativos. Slint, Iced, egui y Makepad exigen bastante trabajo propio.
- Los agentes de IA rinden peor con DSLs nicho (`.slint`, Makepad DSL) y con APIs que cambian a menudo (Iced, Xilem, Dioxus antes de 1.0) que con React o Svelte. Es una inferencia basada en el volumen de código público, no en un benchmark.

### Lagunas (sin verificar en esta sesión)
- **[Conocimiento previo, sin verificar]**:
  - **Qt 6/QML**: LGPLv3 o licencia comercial; una app gratuita puede usarlo bajo LGPL con enlace dinámico. Hay que comprobar la versión de noviembre de 2026.
  - **Flutter desktop**: estable en las tres plataformas, con Impeller y buena animación, pero exige Dart, y el núcleo Rust iría vía FFI o flutter_rust_bridge.
  - **Compose Multiplatform**: escritorio estable en la JVM; las animaciones de Compose son buenas.
  - **.NET MAUI**: no tiene soporte oficial de Linux.
  - **Uno Platform**: soporta Linux con Skia.
  - **egui**: modo inmediato, ideal para herramientas pero poco "pulido de juego".
  - **Makepad**: shaders y animación potentes, pero ecosistema pequeño.
  - **Xilem/Masonry**: experimentales, sin estabilidad de API.
- No encontré juegos de gestión publicados con estos toolkits nativos.

## 4. "Sensación de juego" (animación, transiciones, sonido) frente a productividad en pantallas de datos

### Conclusión
La evidencia apunta a que el stack web (DOM, una biblioteca de animación y canvas o WebGL puntual) es el que mejor combina productividad en pantallas de datos con animación espectacular. El riesgo diferencial de este stack es la **consistencia y el rendimiento del renderizado en Linux con WebKitGTK**. Los toolkits nativos ganan en consumo de recursos y control, pero pierden en ecosistema de animación y componentes.

### Hallazgos con fuente
- GSAP gratuito con todos sus plugins, PixiJS v8 con WebGPU y skills para agentes, y Phaser 4 con su nuevo renderizador WebGL: herramientas maduras y vivas en 2026 — fuentes en la sección 2.
- Problemas de rendimiento y gráficos de WebKitGTK en Linux, con workarounds que sacrifican la ruta rápida de renderizado — [Tauri docs](https://v2.tauri.app/develop/debug/linux-graphics/).
- Las diferencias de renderizado entre plataformas obligan a "probar mucho" con Tauri — [JSLegendDev, 08-2025](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript).
- Slint 1.18 añade springs y paths pensando en UIs de juego — [Stackademic](https://blog.stackademic.com/slint-1-18-brings-flexbox-spring-animations-and-a-new-renderer-e12417666f80).

### Inferencias
- El draft animado (splash arts, temporizadores, transiciones de pick/ban) cabe en CSS con GSAP o Motion para la mayor parte, con un canvas PixiJS para partículas y efectos.
- El sonido puede ir por Web Audio o Howler.js en web. En nativo dependería de una crate o biblioteca de audio aparte (rodio, kira, QtMultimedia). Esto no se verificó en esta sesión.
- Las splash arts de campeones pesan (muchas imágenes grandes). Con webview del sistema en Linux, la decodificación y composición de imágenes grandes con transformaciones CSS es justo donde WebKitGTK suele degradarse. Merece un prototipo de prueba en Linux con NVIDIA, AMD e Intel antes de comprometerse. Es una inferencia.

### Lagunas
- No hay benchmarks públicos de FPS de animaciones UI comparando WebKitGTK, Chromium y toolkits nativos en 2026.

## 5. Ejemplos reales de juegos publicados con tecnología web

### Conclusión
Hay miles de juegos en Steam con NW.js (más de 5.700 según SteamDB, citado en 08-2025) y Electron, sobre todo de RPG Maker y Construct, además de casos conocidos como Cookie Clicker (Electron) y CrossCode (NW.js). No encontré juegos comerciales relevantes hechos con Tauri.

### Hallazgos con fuente
- SteamDB tiene páginas de tecnología para Electron y NW.js. **Cookie Clicker** aparece en la de Electron — [SteamDB Electron](https://steamdb.info/tech/Container/Electron); [SteamDB NW.js](https://steamdb.info/tech/SDK/NWJS).
- Más de 5.700 juegos de Steam usan NW.js, en su mayoría de RPG Maker y Construct — [JSLegendDev, 27-08-2025](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript).
- **CrossCode** usa NW.js — [Summer Engine guide](https://www.summerengine.com/make-great-games/threejs-game-on-steam). Es una fuente secundaria.
- Integración con Steam en Electron mediante steamworks.js — [JSLegendDev](https://jslegenddev.substack.com/p/the-struggle-of-wrapping-a-javascript). Rift Legends probablemente no irá a Steam, porque es un fan project gratuito sujeto a la política de Riot.

### Lagunas
- No verifiqué qué tecnología usa **Teamfight Manager**, el referente directo del género. **[Conocimiento previo, sin verificar]**: probablemente un motor de juego como GameMaker o Unity, no un stack web.
- **[Conocimiento previo, sin verificar]**: los juegos de gestión deportiva web de ZenGM (Basketball GM, Football GM, ZenGM Hockey) son navegadores puros con React e IndexedDB. Son un buen precedente de juego de gestión denso en datos hecho en web, pero no son de escritorio.
- No encontré juegos publicados con Tauri, Wails o Electrobun.
