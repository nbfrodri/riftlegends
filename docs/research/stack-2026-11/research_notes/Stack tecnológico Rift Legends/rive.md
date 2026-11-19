# Rive (rive.app) como opción tecnológica para Rift Legends (estado a nov-2026)

Notas: [Skill] = dato procedente del skill "rive" cargado (texto de marketing del proveedor, no verificado de forma independiente); [Web] = verificado en páginas oficiales de rive.app / GitHub / pub.dev. Las páginas de docs se consultaron vía WebFetch (resumen automático), así que los detalles finos pueden perder matices. No hay recomendación final.

## 1. Qué es Rive en 2026 (editor, formato, state machines, data binding, scripting, layouts, 3D, audio, CLI)

### Takeaway
Rive se presenta ya como "motor interactivo" (2D+3D, "agent-native game engine"), no solo como herramienta de animación: un .riv contiene vectores, raster, 3D, state machines, data binding, layouts, scripting (Luau), audio y shaders. La CLI genera proyectos desde texto (RML + Luau + WGSL), pensada para agentes de IA.

### Cited Findings
- Posicionamiento: la página de juegos de Rive lo describe como motor 2D y 3D con data binding (view models, listas), scripting, 3D con cámaras/luces/shaders, audio disparable desde keyframes/transiciones/listeners, layouts responsivos (incl. RTL), listas con scroll, momentum y virtualización, joysticks, gamepad listeners, focus navigation, text input y localización — [rive.app/games](https://rive.app/games). Solo afirmaciones cualitativas; sin benchmarks ni cifras de FPS.
- Scripting: "Scripting is live in Rive" (13-ene-2026); el scripting usa Luau ("Why Scripting runs on Luau", 20-nov-2025); hay AI Coding Agent integrado en el editor (FAQ 12-ene-2026) — [Blog Rive](https://www.rive.app/blog). Los scripts se conectan a data bindings, artboards e inputs — [docs scripting](https://rive.app/docs/scripting/getting-started). El skill lo llama "AnimaScript" en la página de juegos; los docs dicen Luau (discrepancia de nombre, probablemente marketing vs. técnico).
- Data binding: "permite a la app leer y actualizar valores en un archivo Rive en runtime"; bindings a texto, número, booleano; también listas, imágenes y artboards ("Data Binding, supercharged", 17-jul-2025) — [docs data binding](https://rive.app/docs/runtimes/data-binding), [Blog Rive](https://www.rive.app/blog). La escucha de eventos y el seteo de text runs por runtime están marcados como deprecados a favor de data binding — [docs feature support](https://rive.app/docs/feature-support).
- Layouts/scroll: existen Layouts con scroll y Scroll Constraints (listas de data binding con scroll y barras arrastrables) — [índice docs](https://rive.app/docs/llms.txt).
- Rive CLI: crea/previsualiza/construye proyectos; `rive create` genera `rive.yaml`, `AGENTS.md`, `CLAUDE.md`, `.gitignore` y `scene.rml` (artboard, timeline, state machine); preview en vivo con rebuild al guardar, salida `build/<nombre>.riv`; formatos .riv, .rml, .luau, .wgsl, imágenes y fuentes; convierte .rev (export del editor) a proyecto y viceversa. Plataformas: macOS Apple Silicon, Linux x86_64, Windows. Build local offline y sin login; `--publish`, `--rev`, `push/pull` exigen `rive login`. Publicar añade marca de agua salvo plan Cadet o superior. Scripts para web deben compilarse con `--publish` (los no firmados los rechazan el CDN y los runtimes web). No indica si es beta — [CLI getting started](https://rive.app/docs/cli/getting-started).
- RML: "Rive Markup Language", XML que describe una escena Rive en texto — [índice docs](https://rive.app/docs/llms.txt).
- Rive AI Agent en el editor: disponible para todos incluido Free desde 30-abr-2026, con capacidad que se recarga cada hora; Cadet sin créditos IA nuevos; Voyager con modelos premium y créditos. Rive estudia conectar agentes externos al editor y MCP/BYO API key (solo explorando) — [Blog 30-abr-2026](https://rive.app/blog/free-rive-ai-agent).
- [Skill] Scripts pueden descargar de hosts HTTPS públicos con `rive . --allow-net` (solo macOS por ahora). Accesibilidad: semántica para lectores de pantalla, foco teclado/gamepad, reduced motion.
- [Skill] El skill indica que las pantallas estáticas también pueden hacerse en Rive ("build every screen in Rive") — afirmación de marketing.

### Inferences
- Para un agente de IA, el flujo texto -> .riv (RML/Luau) es un diferenciador real frente a Lottie/Spine, pero la madurez de la CLI no está documentada (no se dice si es beta) y el formato RML es propio, con menos corpus de entrenamiento que HTML/CSS: esperar iteración y verificación visual por preview.
- La combinación state machine + view model encaja con un patrón "núcleo de simulación empuja datos -> Rive los pinta".

### Gaps
- Estabilidad/versionado de RML y de la CLI, y cobertura real de features del editor desde texto: no hallado.
- Calidad del control de versiones de .riv (binario) frente a RML (texto): no hay doc encontrada; inferencia: versionar RML/Luau y tratar .riv como artefacto de build (la CLI ya genera `.gitignore`, `build/`).
- Rendimiento medido de scripting Luau en runtimes nativos: no hallado.

## 2. Runtimes y madurez (web, React, Flutter, C++, Unity, Unreal, Godot, Rust, Apple/Android; Linux)

### Takeaway
Runtimes oficiales MIT: web (JS/WASM), React, React Native, Apple, Android, Flutter, C++ (Mac/Linux/Windows), Unity, Unreal, Defold. Godot no tiene runtime oficial (solo extensión comunitaria alpha). Rust: rive-rs y rive-bevy existen pero con backend Vello y limitaciones. Linux de escritorio está soportado vía C++ y Flutter (rive_native); Unreal/Unity no declaran Linux nativo.

### Cited Findings
- Lista oficial (MIT): Web (@rive-app/canvas, webgl2, canvas-lite), React (react-canvas, react-webgl2...), React Native, Apple (SPM/CocoaPods), Android (Maven), Flutter (pub.dev `rive`), Unity, Unreal, C++ (`rive-cpp`, Mac/Linux/Windows), C# (UWP/WinUI). Comunitarios: Angular, C# UWP, Qt/QtQuick (hypernuclear), RiveCMP. No listados: Godot, Rust, runtime Linux independiente — [docs runtimes](https://rive.app/docs/runtimes/getting-started).
- rive-runtime (C++ core): licencia MIT; prerequisitos macOS/Linux/Windows; cross-compila a iOS/Android/WASM; backends del renderer GPU: Metal, Vulkan, D3D11, D3D12, OpenGL/WebGL; 1.3k estrellas, 3.782 commits en main; build con premake5 y C++17 — [GitHub rive-runtime](https://github.com/rive-app/rive-runtime).
- Flutter `rive_native`: tabla de plataformas con Linux soportado con renderer Flutter y Rive Renderer; las libs precompiladas de Linux no incluyen arm64; el paquete no está aún público en GitHub (se desempaqueta de pub.dev) — [docs rive-native](https://rive.app/docs/runtimes/flutter/rive-native.md).
- Unreal: UE 5.7.3+; Windows D3D11/D3D12, PC Vulkan, macOS Metal, PS5, Switch/Switch 2, Xbox Series X, Steam Deck (vía Proton D3D11); Linux nativo no listado; móvil "planeado"; soporta animación, state machines, ViewModels, texto, imágenes, múltiples artboards, scripting — [docs Unreal](https://rive.app/docs/game-runtimes/unreal/unreal.md).
- Unity: "Rive for Unity: Updated and in the Unity Asset Store" (15-ene-2026); caso "Pay 2 Win" con Rive y Unity (22-ene-2026) — [Blog Rive](https://www.rive.app/blog). (No se pudo cargar la página de docs de Unity; plataformas Linux de Unity no verificadas.)
- Defold: extensión oficial Rive (alianza con Defold Foundation); foro habla de integrar Rive 2.0 — [Defold forum](https://forum.defold.com/t/the-defold-foundation-partners-with-rive-inc/67571) (fechas no confirmadas).
- Godot: solo `kibble-cabal/godot-rive`, GDExtension en alpha, Godot 4.1+, binarios solo macOS universal, probado solo en M1; pide testers para Linux/Windows; sin fecha de último commit visible; la propia Rive tiene un feature request de "Godot runtime" en foro (propuesta, no compromiso) — [GitHub godot-rive](https://github.com/kibble-cabal/godot-rive), [foro Rive](https://rive.app/community/forums/feature-requests/fsyCzA4A9Yar/godot-runtime/ftuSSFcZAlqR). No se halló evidencia de runtime Godot oficial en 2026.
- Rust/Bevy: `rive-app/rive-bevy` (MIT, 131 estrellas, 33 commits) usa el runtime Rust con backend Vello; README advierte de problemas: mallas de imagen con huecos, clips muy numerosos renderizados mal, strokes siempre con round joins/caps; "se trabaja" en incorporar el Rive Renderer como backend — [GitHub rive-bevy](https://github.com/rive-app/rive-bevy). `rive-rs` (~110 estrellas, listado de terceros, actividad dudosa) enlaza rive-cpp con Vello opcional — [relatedrepos](https://relatedrepos.com/gh/rive-app/rive-rs). Existe además `Bantarus/rive-rust` (no oficial) con bindings al renderer C++/Vulkan — resultado de búsqueda, sin verificar.
- Web: `@rive-app/webgl2` usa el Rive Renderer (igual que el editor) y soporta todas las features; `canvas` usa Canvas2D (casi igual; diferencias en fill rules, feathering sin dither); `canvas-lite` omite texto, layout, audio, scripting y feathering; límite de contextos WebGL para webgl2 (mitigable con `useOffscreenRenderer: true`); modos de mezcla distintos de Normal son costosos en webgl2 — [canvas vs webgl](https://rive.app/docs/runtimes/web/canvas-vs-webgl.md).
- GPU Canvas requerido para 3D/shaders y layer masks; en Apple/RN es opt-in; en la web webgl2 ofrece mejor soporte — [feature support](https://rive.app/docs/feature-support), [choose a renderer](https://rive.app/docs/runtimes/choose-a-renderer/overview).
- [Skill] Consolas (PS5/Xbox/Switch) solo para desarrolladores aprobados vía support@rive.app. La página de juegos afirma ejecución nativa C++ en iOS, Android, Windows, macOS, Linux, Steam y Steam Deck — [rive.app/games](https://rive.app/games).

### Inferences
- Linux de escritorio de primera clase hoy se materializa por tres vías verificables: (1) runtime web dentro de un webview, (2) Flutter `rive_native` (Linux x64 con Rive Renderer), (3) C++ directo (rive-runtime con Vulkan/GL). Unity/Unreal/Godot son más dudosos o inexistentes para Linux.
- Con núcleo Rust, la vía "oficial" a un renderer nativo es C++ vía FFI propio; rive-rs/Vello es de menor fidelidad.
- Si el motor fuera Godot, Rive sería arriesgado (extensión alpha de un solo mantenedor); si fuera Bevy, el backend Vello tiene bugs conocidos.

### Gaps
- Versión actual exacta de cada runtime a nov-2026 y fecha del último commit de rive-runtime / rive-rs / rive-bevy / godot-rive: no visibles en las páginas obtenidas.
- Matriz de soporte por runtime (qué runtimes soportan scripting, listas data binding, 3D): la tabla de Feature Support no se renderizó en el fetch. Solo confirmado: Unreal soporta ViewModels y scripting; Flutter rive_native soporta scripting desde 0.1.1 según búsqueda (no verificado en la fuente primaria).
- Soporte Linux de Unity y calidad del runtime C++ en Linux (Wayland/Vulkan) en la práctica: no hallado. La docs C++ (renderers, external renderer) existe pero no se leyó.
- Qt/QtQuick comunitario: estado y licencia no verificados.

## 3. Integración con stacks candidatos (Tauri/Electron/Wails, Godot, Unity, Bevy, Avalonia/Slint, núcleo Rust/C#)

### Takeaway
La integración más directa y bien soportada es en un webview (JS/WASM + view models) alimentado por el núcleo vía IPC; en Linux hay riesgo específico con Tauri/WebKitGTK por WebGL. Unity tiene runtime oficial; Godot y Bevy tienen soluciones comunitarias/inmaduras; Avalonia/Slint no tienen runtime Rive (solo se encontró uno C# UWP/WinUI y uno Qt).

### Cited Findings
- Tauri en Linux usa WebKitGTK; la doc de Tauri avisa de ventanas en blanco/flicker con NVIDIA (workaround `WEBKIT_DISABLE_DMABUF_RENDERER`, que desactiva una ruta rápida), de que WebGL/canvas pueden caer silenciosamente a una ruta lenta y de que WebKitGTK enmascara el renderer string; recomienda fallback sin WebGL en Linux — [Tauri Linux graphics](https://v2.tauri.app/develop/debug/linux-graphics/).
- Rive recomienda `webgl2` en general, pero `canvas` evita WebGL y su límite de contextos, y el cambio de paquete es una línea — [canvas vs webgl](https://rive.app/docs/runtimes/web/canvas-vs-webgl.md).
- Foro Rive: informe de que el editor en Linux es "browser edition" con mal rendimiento en un portátil (bien en otro); otro informe de degradación no lineal al aumentar `artboard.draw()` usando webgl avanzado en Firefox, solucionado cambiando a canvas — [foro bugs](https://rive.app/community/forums/bugs/fsLjspgTHYcR/rive-editorsite-bad-performance-on-linux-machine/ft6zrBzmF8BG), [foro draw calls](https://rive.app/community/forums/bugs/fsLjspgTHYcR/performance-degrades-non-linearly-as-artboarddraw-calls-increase/fttz0HflZbgy). Anécdotas individuales.
- Electron (Chromium empaquetado) no se investigó explícitamente; Wails usa WebKitGTK en Linux (conocimiento general, no verificado aquí).
- Unity: runtime oficial en Asset Store (ene-2026) — [Blog Rive](https://www.rive.app/blog).
- Godot y Bevy: ver sección 2 (comunitario alpha / runtime con Vello y limitaciones).
- Qt/QtQuick: runtime comunitario (hypernuclear) — [docs runtimes](https://rive.app/docs/runtimes/getting-started). Para Avalonia/Slint no se halló runtime; el C# oficial es UWP/WinUI (Windows).
- [Skill] "Una app puede usar Rive donde quiera destacar; mantener en app solo carga de archivo, datos y eventos".

### Inferences
- Modo (a) Rive como app completa: la ruta más plausible en Linux sería Flutter (rive_native con Rive Renderer, Linux x64 oficial) o web en navegador/webview; la CLI de Rive habla de entregar apps iOS/Android/web ([Skill]), no escritorio nativo, por lo que "app entera en Rive en escritorio" no está respaldada directamente por la CLI. Ver gap.
- Modo (b) incrustado: webview (Tauri/Electron/Wails) con núcleo Rust/C#/TS vía IPC y view models es el camino con menos piezas comunitarias; el riesgo principal es WebKitGTK/Linux (probar `canvas` vs `webgl2`). Electron evitaría la variabilidad de WebKitGTK al llevar su propio Chromium (inferencia).
- Un núcleo en TypeScript encajaría de forma natural con el runtime web.

### Gaps
- Pruebas reales de Rive en Tauri/Electron/Wails: no hallado.
- Cómo se entrega una app "Rive pura" en escritorio (Linux/Windows/macOS) desde la CLI: no documentado en lo leído; solo Flutter/C++ como vías.
- Integración con Slint/Avalonia: sin fuentes.

## 4. Pantallas con muchos datos (tablas, listas, texto dinámico) frente a piezas animadas

### Takeaway
Rive declara listas virtualizadas con scroll, layouts flex y texto data-bound, así que técnicamente cubre tablas/listas; no se encontró evidencia independiente de que escale bien a pantallas densas tipo hoja de cálculo ni cómo se comporta en accesibilidad, selección de texto o edición.

### Cited Findings
- Listas con virtualización ("solo se construyen filas en pantalla"), momentum scroll, layouts reflow, text input y localización — [rive.app/games](https://rive.app/games) (claims de proveedor).
- Listas generadas por data binding (artboards como items) y scroll constraints — [índice docs](https://rive.app/docs/llms.txt), [Blog Rive jul-2025](https://www.rive.app/blog).
- `canvas-lite` carece de texto/layout/scripting; el web `canvas` completo sí los soporta — [canvas vs webgl](https://rive.app/docs/runtimes/web/canvas-vs-webgl.md).
- Accesibilidad: semántica Rive (VoiceOver en RN iOS 0.5.0+) — [feature support](https://rive.app/docs/feature-support); [Skill] hay semántica de lector de pantalla y foco.
- Casos públicos son casi todos animados/interactivos (juegos, mascotas, Megadeth interactivo, BUCK LinkedIn Year in Review) — [Blog Rive](https://www.rive.app/blog), [case studies](https://rive.app/blog/case-studies). No se halló ningún caso de UI de gestión densa en tablas.

### Inferences
- Para un manager con muchas tablas ordenables, filtros, búsqueda, formularios y teclado, la UI nativa del stack anfitrión (HTML/CSS, Qt, etc.) probablemente es más productiva y accesible; Rive lo haría mejor en draft, HUD, transiciones, celebraciones y quizá minimapa/timeline. Es una inferencia, no medición.
- Una tabla con cientos de filas y texto dinámico en Rive exigiría diseñar plantillas de artboard + listas; el trabajo de diseño en editor sería alto y los agentes verían el resultado solo por preview.

### Gaps
- Benchmarks de listas grandes, texto abundante, ordenación/filtrado, IME, selección/copia de texto, fuentes CJK (relevante: LCK/LPL) y fallback fonts: no hallado (el feature support menciona "fallback fonts" pero sin detalle).

## 5. Licencias y precios (proyecto fan gratuito no comercial)

### Takeaway
Runtimes MIT sin royalties. El editor es gratuito para aprender, pero exportar para producción requiere plan de pago según el blog de oct-2025; la página de precios actual muestra un plan Free con splash screen en los .riv exportados, y la CLI permite builds locales ilimitados sin cuenta. Hay discrepancia entre fuentes que hay que aclarar.

### Cited Findings
- Precios (por asiento/mes): Free 0 $ (50 publicaciones/push CLI al mes, 3 archivos colaborativos, 1 proyecto, 10 MB por asset; .riv exportados con splash screen de Rive; 3 páginas rive.to que expiran a 3 días); Cadet 9 $ (3 asientos máx., 500 publicaciones, sin splash, archivos ilimitados, 100 MB/asset); Voyager 32 $ (25 asientos, 5.000 publicaciones, Libraries, hosting de embed, colaboración en tiempo real); Enterprise 120 $ (SSO, SOC2, runtime personalizado; orientado a organizaciones con +10 M$ de ingresos) — [rive.app/pricing](https://rive.app/pricing).
- Runtimes: MIT, "no runtime fees, no royalties" — [pricing](https://rive.app/pricing), [rive-runtime](https://github.com/rive-app/rive-runtime). [Skill] idem.
- Builds locales con la CLI: ilimitados y sin cuenta; publicación (`--publish`) añade marca de agua salvo Cadet+ — [CLI getting started](https://rive.app/docs/cli/getting-started), [pricing](https://rive.app/pricing).
- Blog "Rive's new $9/mo plan" (20-oct-2025): "las exportaciones pasan a planes de pago"; Cadet 9 $/mes anual o 17 $/mes mensual; el editor sigue gratis para aprender; fuentes y audio gratis en todos los planes; para producción (app, juego, producto, web) hace falta plan de pago; "tus exports siguen funcionando para siempre" sin suscripción activa; estudiantes pueden pedir acceso a exportación — [Blog](https://rive.app/blog/rive-s-new-9-mo-plan).
- Contradicción: el blog dice que exportar requiere plan de pago; la página de precios dice que Free exporta con splash screen — [pricing](https://rive.app/pricing) vs [blog](https://rive.app/blog/rive-s-new-9-mo-plan). Puede ser que la página de precios se refiera a la vía CLI/publicación y el blog al export manual del editor, o que hayan cambiado después; no resuelto.
- Para un proyecto fan sin monetización no hay categoría "no comercial" o "open source" explícita en lo leído; el blog usa criterio "en producción", no "comercial".

### Inferences
- Coste mínimo realista para un juego gratuito distribuido: 9 $/mes (Cadet) si se quiere eliminar splash/marca de agua y exportar sin ambigüedad; el uso 100 % local con CLI es gratuito pero puede incluir splash según plan al publicar (por aclarar con soporte de Rive).
- Los .riv ya exportados no caducan, y el runtime es MIT: no hay riesgo de pérdida de licencia a futuro del runtime; sí riesgo de dependencia del editor/CLI de Rive (cerrados, con login para ciertas funciones; cuotas Free 50 publicaciones/mes).

### Gaps
- Si el editor/CLI son de código abierto o cerrados y licencia de uso del software de edición: no verificado (el runtime es MIT; la CLI se distribuye como binario).
- Términos exactos de la licencia de uso/EULA del editor para proyectos gratuitos de fans: no hallados.
- Cambios de precios posteriores a nov-2026 o reglas de grandfathering: no verificados.

## 6. Rendimiento, tamaño de archivo y flujo de trabajo (diseñador, agente vía CLI, control de versiones)

### Takeaway
Rive afirma .riv compactos y un renderer vectorial GPU propio; la evidencia independiente de rendimiento en escritorio es escasa. El flujo agente + CLI está diseñado explícitamente, con preview en vivo y proyecto en texto; el control de versiones puede apoyarse en RML/Luau.

### Cited Findings
- Claims: Rive Renderer dibuja "enorme cantidad de vectores" con antialiasing analítico, Vector Feathering sin coste de blur, .riv compactos — [rive.app/games](https://rive.app/games) (sin cifras).
- Benchmark de Callstack en móvil: Rive ~60 FPS frente a Lottie 17 FPS (test único, cercano al proveedor) — [Callstack](https://callstack.com/blog/lottie-vs-rive-optimizing-mobile-app-animation) (citado vía búsqueda, no abierto).
- Limitaciones de rendimiento web: webgl2 con MSAA y coste de blend modes; límite de contextos — [canvas vs webgl](https://rive.app/docs/runtimes/web/canvas-vs-webgl.md).
- Flujo de proyecto CLI: `rive.yaml`, `scene.rml`, `.luau`, `.wgsl`; `AGENTS.md` y `CLAUDE.md` generados; `rive --verify` comprueba que compila sin escribir salida — [CLI](https://rive.app/docs/cli/getting-started). Conversión .rev <-> proyecto permite alternar entre editor y texto.
- Colaboración en editor en tiempo real solo en Voyager+; Free limita a 3 archivos colaborativos y 1 proyecto — [pricing](https://rive.app/pricing).

### Inferences
- Para agentes: texto (RML/Luau/YAML) diffable en Git; el .riv resultante es binario compilado (reproducible desde fuente). Si el diseñador trabaja en el editor, el archivo vive en la nube de Rive (colaborativo) y se exporta a .rev/.riv; mezclar ambos flujos requiere pasar por `.rev` (no se verificó cuán sin pérdida es).
- No hay tamaño típico de .riv documentado en lo hallado; las imágenes (arte de campeones, splash arts) dominarían el peso, y existe límite de 10 MB/asset en Free (100 MB Cadet) para assets importados (relevante para arte de 170+ campeones; además licencias Riot).

### Gaps
- Benchmarks reales en escritorio Linux (CPU/GPU, memoria) con escenas densas (draft con 20 retratos, timeline): no hallados.
- Tamaños reales de .riv, tiempo de arranque WASM (el WASM se carga por defecto del CDN de Rive en Flutter web; para offline en un juego de escritorio habría que empaquetarlo — no verificado en docs web).
- Fiabilidad del paso editor <-> CLI (.rev) y cómo se resuelven conflictos de merge: no hallado.

## 7. Juegos y apps reales; opinión de la comunidad 2025-2026

### Takeaway
Rive muestra 13 juegos jugables propios/de terceros y casos de marketing/medios; hay poca evidencia de juegos comerciales grandes con UI de gestión hecha íntegramente en Rive. La opinión pública encontrada es mayormente de proveedor o blogs promocionales.

### Cited Findings
- 13 juegos listados (Doomswipe, Sentinel, Rive City, Ghost, Mech Mayhem...), sin cifras de descargas — [rive.app/games](https://rive.app/games).
- Casos 2025-2026: Manchester City (Web3D con Hiber3D y Rive, 16-ene-2025), Megadeth lore interactivo (25-sep-2025), Pay 2 Win indie con Rive y Unity (22-ene-2026), BUCK LinkedIn Year in Review (4-jun-2026) — [Blog Rive](https://www.rive.app/blog), [case studies](https://rive.app/blog/case-studies).
- Hilo de r/MotionDesign (2025): la elección Spline/Rive depende de 3D frente a 2D; un comentarista prefería Rive para UI — [Redlib](https://redlib.astrial.org/r/MotionDesign/comments/1jmnil8/spline_rive_or_lottie_which_is_easier_to_learn). Sin hilos 2026 sobre Rive para juegos hallados.
- Bevy runtime con 131 estrellas y Godot ext. con ~124 estrellas: tracción pequeña en ecosistemas de código abierto — [rive-bevy](https://github.com/rive-app/rive-bevy), [godot-rive](https://github.com/kibble-cabal/godot-rive).

### Inferences
- La escasez de testimonios independientes en escritorio/Linux obliga a un prototipo propio (p. ej. una pantalla de draft) antes de cualquier decisión.

### Gaps
- Reseñas de desarrolladores independientes 2025-2026 (HN, Reddit, Discord) sobre fricciones con Rive en juegos: no encontradas; los resultados fueron sobre todo contenido de Rive/Dev.to promocional.
- No se verificó si los 13 juegos corren en Linux o se publicaron en Steam.

## 8. Comparación breve con Lottie/dotLottie, Spine, GSAP y animación nativa del motor

### Takeaway
Rive es el único de los comparados que combina interactividad (state machines), datos en runtime, layout y varios runtimes en un archivo; Lottie es lineal y portable; Spine es el estándar de personajes esqueletales con runtimes de motor; GSAP y la animación nativa del motor viven en código sin editor visual compartido.

### Cited Findings
- Rive vs Lottie: Lottie para animaciones lineales (loaders, iconos) desde After Effects; Rive para gráficos interactivos que reaccionan a datos/personas — [Rive](https://rive.app/blog/rive-as-a-lottie-alternative) (fuente interesada); contraposición de LottieFiles — [LottieFiles](https://lottiefiles.com/blog/lottie-animations/lottiefiles-or-rive) (no leída en detalle). Los players oficiales de Lottie no incluyen Unity/Unreal (según resumen de búsqueda).
- Rive vs Spine: Spine se centra en animación esquelética 2D para juegos y se dirige por código; Rive propone coexistir (personajes Spine + HUD Rive) — [Rive vs Spine](https://rive.app/rive-vs-spine) (fuente interesada). Spine tiene GDExtension oficial para Godot — [Esoteric Software](https://esotericsoftware.com/blog/spine-godot-GDExtension) (aparece en resultados; no leído).
- GSAP y animación nativa: no se investigaron en fuente primaria en este ciclo.

### Inferences
- Para el draft: Rive aportaría timeline visual + estados (hover, pick, ban, lock-in) + datos vinculados; GSAP/CSS o tweens nativos (Godot AnimationPlayer, Unity DOTween) bastan para transiciones sencillas y están en el mismo código que la lógica, con mejor soporte de IA por corpus. Esto es una inferencia razonada, no una medición.
- Dotlottie/Lottie sirven bien para celebraciones/confeti lineal, sin necesidad de lógica.

### Gaps
- Comparativa verificada de GSAP y de animación nativa; estado de dotLottie 2026 (runtime dotlottie-rs, state machines): no investigado.
