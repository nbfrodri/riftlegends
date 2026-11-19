# Tooling, build, empaquetado y distribución para Rift Legends (estado a noviembre de 2026)

> Notas de investigación, no una recomendación. Fecha de consulta: 2026-11-19. Cuando un dato viene de foros, de prensa o de mi conocimiento previo y no lo verifiqué en esta sesión, se indica.
>
> **Aviso transversal (fuera del alcance estricto, pero condiciona toda la distribución):** la política actual de Riot ("Legal Jibber Jabber", última actualización indicada: agosto de 2018) dice textualmente "We prohibit the use of our IP in games and apps", salvo con licencia escrita o con una clave válida de la API de Riot que cumpla sus API Terms. También prohíbe publicar proyectos en la Apple App Store o en Google Play sin esas dos condiciones. Ver la sección 1.

## 1. Canales de distribución para un juego fan gratuito, e implicaciones de usar IP de Riot

### Takeaway
El mayor riesgo no está en las tiendas, sino en la propia política de Riot: prohíbe usar su IP en "games and apps" salvo con licencia escrita o una clave de API válida. Ninguna tienda revisada tiene una regla que autorice expresamente juegos fan. itch.io y GitHub Releases actúan solo cuando el titular reclama (DMCA). Steam y Flathub exigen derechos sobre el contenido y no permitir que el nombre o el icono sugieran afiliación. Flathub, además, tiene en 2026 una política sobre IA que afecta a un desarrollador que trabaja con agentes.

### Cited Findings
**Política de Riot**
- La política de fans es una licencia condicionada "strictly for noncommercial … community use" y revocable. Si Riot retira el permiso, hay que dejar de desarrollar y distribuir de inmediato. Página fechada en "August 2018" — [Riot Games Legal](https://www.riotgames.com/en/legal)
- Sección "games and apps": Riot prohíbe usar su IP (aspecto de personajes, habilidades, mapas, iconos, objetos) en juegos y apps salvo con (a) licencia escrita o (b) una clave válida de la API de Riot y cumplimiento de los API Terms and Policies. No hay excepción específica para juegos fan — [Riot Games Legal](https://www.riotgames.com/en/legal)
- "we do not allow any Projects on the Apple Store or Google Play Store unless" haya licencia escrita o clave de API válida. La página no menciona Steam, itch.io ni otras tiendas de PC — [Riot Games Legal](https://www.riotgames.com/en/legal)
- Se consideran comerciales, y requieren licencia, la financiación colectiva, los proyectos con entidad empresarial y el contenido tras un muro de pago (Patreon, etc.) — [Riot Games Legal](https://www.riotgames.com/en/legal)
- Aviso obligatorio al compartir el proyecto: "[Title] was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project." No se pueden registrar dominios ni cuentas sociales con nombres o marcas de Riot — [Riot Games Legal](https://www.riotgames.com/en/legal)
- Precedentes: "League of Guessing", un trivial no oficial de LoL, se anunció en Steam con un descargo en su página. Riot no participaba (2016) — [Kotaku](https://kotaku.com/unofficial-league-of-legends-game-coming-to-steam-1787374634); [PC Gamer](https://pcgamer.com/competitive-league-of-legends-quiz-game-coming-to-steam-somehow-hasnt-been-shut-down-yet). Riot envió un cease-and-desist al servidor fan Chronoshift (2021) — [PC Gamer](https://pcgamer.com/riot-shuts-fan-made-league-of-legends-legacy-project-denies-complaints-of-extortion); [Business Insider NL](https://www.businessinsider.nl/a-league-of-legends-fan-made-game-has-shut-down-after-developer-riot-games-issued-legal-threats/)

**itch.io**
- Las condiciones hacen al publicador "solely responsible" de su contenido, y la cuenta puede retirarse sin aviso. Un administrador explica que itch.io no busca infracciones de forma activa (puerto seguro DMCA), pero retira el contenido cuando le avisan. Un moderador dice: "Fan games are in a legal gray area, but we don't care unless the owner … issues a DMCA request". Son posts de foro, no política formal — [itch.io forum](https://itch.io/t/2405034/can-i-use-copyrighted-characters-or-royalty-free-assets-in-my-indie-game); [itch.io post](https://itch.io/post/9619079/view-in-topic)

**Steam**
- Steam Direct cuesta 100 USD por app, no reembolsables pero recuperables. La cifra de 1.000 USD de ingresos brutos ajustados para recuperarlos viene de la cobertura de 2017 y de la versión china de la página de Steamworks. No la confirmé en la versión inglesa actual — [Steamworks: App fee](https://partner.steamgames.com/doc/gettingstarted/appfee); [PC Gamer 2017](https://www.pcgamer.com/valve-reveals-steam-direct-fee-upcoming-changes-to-the-store)
- Un juego gratuito no genera ingresos, así que esos 100 USD nunca se recuperarían. Es una inferencia a partir de la regla anterior.
- Valve rechaza juegos cuyo contenido pueda infringir IP de terceros. Ejemplo documentado: assets generados con IA de propiedad dudosa ("we cannot ship your game while it contains these AI-generated assets"). Valve exige que el desarrollador no infrinja copyrights existentes — [PC Gamer](https://www.pcgamer.com/valve-is-scrutinizing-games-with-ai-assets-on-steam-says-avoiding-copyright-violation-is-the-developers-responsibility); [Tom's Hardware](https://www.tomshardware.com/news/valve-banning-games-using-ai-art)
- Valve también ha retirado, mediante DMCA, proyectos fan de su propia IP (Team Fortress: Source 2, Portal 64), aunque antes los toleraba. A la vez, ha permitido vender en Steam fan projects con licencia (Black Mesa, Portal: Revolution) — [Engadget](https://www.engadget.com/valve-squashes-team-fortress-2-and-portal-fan-projects-after-years-of-leniency-181517580.html); [GamesRadar](https://www.gamesradar.com/after-years-of-supporting-mods-and-fan-games-valve-takes-action-against-team-fortress-and-portal-fan-projects)

**Flathub / Flatpak**
- Requisitos: todo el contenido alojado "must allow legal redistribution". Lo no redistribuible debe ir como `extra-data`. El nombre y el icono "must be distinct", y no se puede insinuar afiliación oficial con el nombre de un vendor (por ejemplo, un fork de Firefox no puede llamarse "Firefox"). Prohíbe infringir "laws, trademarks and copyrights". Los proyectos propietarios usan `LicenseRef-proprietary`. El dominio se verifica con `.well-known/org.flathub.VerifiedApps.txt` — [Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements)
- Política de IA generativa vigente en la página: los manifiestos no pueden contener contenido generado o asistido por IA. Hay que declarar el código, la documentación o el empaquetado generados con IA. Los agentes de IA no pueden abrir ni automatizar los PR de envío. Las infracciones repetidas pueden acabar en "permanent ban" — [Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements)
- Cronología: en mayo de 2026, Flathub prohibió casi todas las apps hechas con IA generativa. El 8 de octubre de 2026 lo sustituyó por una política de declaración, con criterio del revisor, manteniendo la prohibición en manifiestos y PR automatizados — [GamingOnLinux mayo 2026](https://www.gamingonlinux.com/2026/05/flathub-moves-to-ban-nearly-all-apps-and-submissions-made-with-generative-ai/); [GamingOnLinux octubre 2026](https://www.gamingonlinux.com/2026/10/flathub-walked-back-their-generative-ai-ban-replaced-with-a-disclosure-policy/)

**Microsoft Store**
- Desde septiembre de 2025, el registro de desarrolladores individuales es gratuito en casi 200 mercados y se aceptan apps Win32 (incluidas .NET WPF y WinForms) sin cambios de código — [Windows Developer Blog, 2025-09-10](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/)
- Microsoft vuelve a firmar las apps de la Store, que obtienen reputación completa en SmartScreen — [Microsoft Learn: SmartScreen reputation](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation)
- Apple sigue cobrando 99 USD al año por el Developer Program — [Windows Central](https://www.windowscentral.com/microsoft/windows-11/microsoft-store-drops-fees-for-individual-developers-apple-still-charges-usd99-per-year)

### Inferences
- Tabla orientativa por canal (combina lo citado con conocimiento general; lo no citado arriba está sin verificar en esta sesión):

| Canal | Coste | Revisión previa | Riesgo con IP de Riot | Notas |
|---|---|---|---|---|
| itch.io (+ butler) | 0 € | No (reactiva) | Bajo/medio: retirada si Riot envía DMCA | butler permite subidas incrementales y canales por plataforma (sin verificar en esta sesión) |
| GitHub Releases | 0 € | No | Bajo/medio: DMCA de GitHub | Encaja con CI y con los updaters (Tauri, Velopack, electron-updater) |
| Steam | 100 USD sin recuperación posible si es gratis | Sí (humana) | Alto: Valve exige derechos, y "free fan project" no es una licencia | Riot no autoriza expresamente las tiendas, aunque solo nombra Apple y Google |
| Flathub | 0 € | Sí | Medio/alto: exige redistribución legal y nombre e icono sin confusión | La política de IA exige declarar el código generado con agentes |
| Microsoft Store | 0 € (individual) | Sí | Medio/alto: revisión de contenido y propiedad (sin verificar) | Resuelve SmartScreen y la firma |
| AUR | 0 € | No | Bajo | PKGBUILD mantenido por la comunidad o el autor, que descarga el binario de GitHub. Natural para un dev en Arch |
| AppImage | 0 € | No | — | Formato, no tienda. Se puede publicar en GitHub o itch |
| Snap Store | 0 € | Automática + manual para ciertos permisos | Medio | Poco usado para juegos fuera de Ubuntu (sin verificar) |
| winget / Scoop | 0 € | PR revisado / bucket propio | Bajo | Los manifiestos apuntan a binarios de GitHub. Un binario sin firma puede generar fricción en la validación de winget (sin verificar) |
| Homebrew (cask/tap) | 0 € | Tap propio sin revisión | Bajo | Desde 2025-2026, Homebrew endurece los casks sin notarizar (sin verificar en esta sesión) |
| Apple App Store / Google Play | — | — | Prohibido por Riot | Exclusión explícita en la política |

- La prohibición de Riot sobre "games and apps" es el factor dominante. Conviene que el informe la eleve al apartado legal, porque condiciona si tiene sentido usar cualquier tienda curada. La vía de la "clave de API de Riot" se refiere a productos que consumen la Riot API. No está claro si un juego offline podría acogerse a ella.
- Un repositorio de código separado de los assets de Riot permite que el binario base sea distribuible y que el contenido IP se descargue o importe por separado (patrón `extra-data` en Flathub). Esto reduciría la exposición en las tiendas, pero no resuelve la cuestión de fondo con Riot.

### Gaps
- No encontré ninguna regla de Steam, itch.io ni Microsoft Store específica para juegos fan de IP ajena, ni un caso de un juego fan de LoL rechazado o aceptado en Steam después de 2017.
- No verifiqué el texto actual en inglés del umbral de 1.000 USD de Steam Direct.
- No consulté las políticas de contenido de Snapcraft, winget-pkgs ni Homebrew.

## 2. Empaquetado e instaladores por stack

### Takeaway
Cada stack trae su propio empaquetador: Tauri bundler (MSI, NSIS, AppImage, deb, rpm y DMG), electron-builder o Forge, plantillas de exportación de Godot, y `dotnet publish` con Velopack. Para Rust sin Tauri existen `dist` (antes cargo-dist) y cargo-packager. Velopack es la opción multistack más completa (instalador y actualizaciones con deltas).

### Cited Findings
- Tauri 2: el bundler genera artefactos de actualización para AppImage (`.AppImage.tar.gz` + `.sig`) y para MSI y NSIS (`.zip` + `.sig`). La firma de la CLI cubre NSIS, MSI, AppImage, deb y rpm. Changelog del bundler con correcciones de octubre y noviembre de 2026 (bloqueo de downgrade en NSIS, bundling como SYSTEM) — [Tauri updater plugin](https://v2.tauri.app/plugin/updater/); [tauri-bundler releases](https://v2.tauri.app/release/tauri-bundler/all-versions/)
- `dist` (antes cargo-dist): última versión encontrada, 0.30.3 (2025-12-14). La 0.29.0 (2025-07-31) incorporó el fork de Astral y retiró "Axo Releases". No encontré actividad en 2026 — [dist changelog](https://axodotdev.github.io/cargo-dist/changelog); [GitHub releases](https://www.github.com/axodotdev/cargo-dist/releases)
- Velopack: un directorio de herramientas de terceros (consultado en abril de 2026) lo describe como instalador y framework de autoactualización multiplataforma (Windows, macOS y Linux), con una release cada 12 días aproximadamente, y señala que su documentación es más escasa que la de herramientas veteranas. El paquete PyPI publicaba prereleases hasta el 14 de abril de 2026 — [dev-tools-portal](https://dev-tools-portal.pages.dev/tools/velopack/); [PyPI RSS](https://pypi.org/rss/project/velopack/releases.xml)

### Inferences
Resumen por stack. Viene de conocimiento general previo y **no lo verifiqué en esta sesión**; habría que contrastarlo con la documentación oficial antes de citarlo:
- **Rust + Tauri:** `tauri build` produce MSI (WiX) o NSIS en Windows, AppImage, deb y rpm en Linux, y .app o DMG en macOS. No compila de forma cruzada con soltura: lo habitual es una matriz de CI con un runner por sistema (tauri-action en GitHub Actions).
- **Rust nativo (Bevy, egui, iced…):** `dist` genera tarballs, instaladores shell/PowerShell, MSI y fórmulas de Homebrew, además de su propio workflow de GitHub Actions. cargo-packager (de los autores de Tauri) genera instaladores y trae su propio updater. Velopack tiene SDK de Rust.
- **TypeScript + Electron:** electron-builder (NSIS, AppImage, deb, rpm, Snap, DMG; incluye electron-updater) frente a Electron Forge (oficial, con makers como Squirrel.Windows, deb, rpm, zip y DMG). Los binarios rondan 80–150 MB.
- **Godot:** las plantillas de exportación oficiales generan ejecutable más .pck para Windows, Linux y macOS desde Linux. La exportación a macOS desde Linux es posible, pero firmar y notarizar exige herramientas extra (rcodesign) o un Mac. Godot no trae updater. El editor .NET de Godot limita algunas plataformas (C# no exporta a web en Godot 4).
- **C#/.NET (Avalonia, MonoGame, Godot-C#…):** `dotnet publish` con `-p:PublishSingleFile=true` y `--self-contained`, o con NativeAOT (requiere compilar en cada sistema destino y es incompatible con algunas librerías basadas en reflexión). Velopack nació como sucesor de Squirrel/Clowd.Squirrel para .NET.
- **Instaladores Windows genéricos:** Inno Setup (sencillo, gratuito), WiX (MSI, curva alta), MSIX (necesario para la Store y requiere firma; la Store firma por ti). NSIS es el que usan Tauri y electron-builder.
- **Linux:** con AppImage y tar.gz suele bastar para itch y GitHub. Flatpak requiere un manifiesto aparte y el proceso de Flathub. Un PKGBUILD para AUR es trivial si ya hay tarball.

### Gaps
- No verifiqué en esta sesión las versiones actuales (noviembre de 2026) de electron-builder, Forge, Godot (4.5 o 4.6), .NET 10, NativeAOT ni Velopack estable. No encontré un changelog oficial de Velopack de 2026.
- El estado de mantenimiento de `dist` en 2026 no está claro: no encontré releases de 2026.

## 3. Autoactualización y actualizaciones delta

### Takeaway
Tauri updater (firmas propias minisign/ed25519, actualización completa), electron-updater (con descargas diferenciales blockmap en NSIS y AppImage) y Velopack (deltas reales, multiplataforma y multilenguaje) son las opciones principales. Sparkle sirve para macOS. itch (butler) y Steam ya parchean de forma incremental si se distribuye por ellos.

### Cited Findings
- Tauri updater: se activa con `bundle.createUpdaterArtifacts: true`. Las claves se pasan con `TAURI_SIGNING_PRIVATE_KEY` y `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. La CLI comprueba que la clave privada coincide con `plugins > updater > pubkey`. Para migrar desde v1 existe `"v1Compatible"` — [Tauri updater plugin](https://v2.tauri.app/plugin/updater/)
- Velopack se presenta como "next-gen cross-platform installer and auto-update framework" para Windows, macOS y Linux — [dev-tools-portal](https://dev-tools-portal.pages.dev/tools/velopack/)

### Inferences
- Sin verificar en esta sesión: Velopack genera paquetes delta entre versiones y tiene SDKs para .NET, Rust, JS/Node (Electron) y C++. Puede publicar en GitHub Releases o en S3. electron-updater soporta GitHub Releases como feed. Sparkle 2 es el estándar en macOS y requiere firma EdDSA. Las firmas propias del updater (Tauri, Sparkle) son independientes de Authenticode y de la notarización: protegen la integridad de la actualización, pero no evitan SmartScreen ni Gatekeeper.
- Para un juego distribuido por itch, el app de itch y butler ya ofrecen parches binarios. Steam, igual. Un updater propio solo aporta valor para descargas directas desde GitHub o la web.
- Si el juego descarga datos de meta o contenido (campeones, parches) aparte del binario, puede actualizarlos sin reinstalar. Encaja con "contenido como datos" del IDEA.md.

### Gaps
- No obtuve documentación oficial actual sobre el soporte delta de Velopack en Linux y macOS ni sobre los blockmaps de electron-updater.

## 4. Firma de código en 2026: costes, opciones y SmartScreen

### Takeaway
Para un individuo fuera de EE. UU. y Canadá (el desarrollador parece estar en España), Azure Artifact Signing, antes Trusted Signing, no parece disponible para validación individual. SignPath Foundation es gratis, pero exige licencia OSI y prohíbe componentes propietarios: eso choca con incluir assets de Riot en el paquete firmado. Desde 2024, los certificados EV ya no saltan SmartScreen. Firmar en macOS exige el Apple Developer Program (99 USD al año).

### Cited Findings
- Azure Artifact Signing (nuevo nombre de Trusted Signing) alcanzó la disponibilidad general en enero de 2026 para organizaciones de EE. UU., Canadá y Europa — [DevClass, 2026-01-14](https://www.devclass.com/security/2026/01/14/code-signing-windows-apps-may-be-easier-and-more-secure-with-new-azure-artifact-service/4079554); [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/microsoft-security-blog/-/4482789)
- Para individuos, respuestas de Microsoft Q&A (marzo y junio de 2026; comunitarias, una marcada como generada por IA, por tanto no autoritativas) indican soporte solo en EE. UU. y Canadá. Un usuario francés no encontraba su país en el formulario de validación individual, y hay informes de renovaciones individuales bloqueadas — [MS Q&A: Irish sole trader](https://learn.microsoft.com/en-us/answers/questions/5915697/can-an-irish-sole-trader-(non-incorporated)-qualif); [MS Q&A: can't create individual identity](https://learn.microsoft.com/en-us/answers/questions/5810735/cant-create-a-new-trusted-signing-individual-ident); [MS Q&A](https://learn.microsoft.com/answers/a/2028104)
- Microsoft recomienda Artifact Signing como "typically the better choice" para firmar apps Windows nuevas, y dice que pagar el sobrecoste de EV (más de 400 USD al año) solo para evitar SmartScreen "no longer justified" — [Microsoft Learn: code signing options](https://learn.microsoft.com/windows/apps/package-and-deploy/code-signing-options)
- Según Microsoft, ya no existe el antiguo comportamiento por el que los archivos firmados con EV obtenían reputación positiva por defecto. Con OV o EV hay que construir reputación. Los archivos sin firmar la construyen por hash, así que cada build nueva empieza de cero. Smart App Control (Windows 11) bloquea los archivos sin firma que no tengan reputación positiva — [Microsoft Learn: SmartScreen reputation](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation); [DigiCert KB](https://knowledge.digicert.com/alerts/ev-signed-application-showing-microsoft-defender-smartscreen-warnings); [ToDesktop](https://www.todesktop.com/blog/posts/windows-apps-psa-ev-certs-do-not-grant-immediate-reputation-anymore)
- Microsoft no ofrece ningún proceso para transferir reputación de SmartScreen entre un certificado y su renovación (Q&A 2026) — [MS Q&A](https://learn.microsoft.com/en-us/answers/questions/5900208/smartscreen-reputation-reset-following-ev-certific)
- Condiciones de SignPath Foundation (página marcada como borrador, sin fecha): licencia aprobada por la OSI "without commercial dual-licensing" para todos los componentes; ningún componente propietario o no open source; el proyecto debe estar mantenido y ya publicado; se exige "a certain verifiable reputation" a los ejecutables; el editor que figura en la firma es "SignPath Foundation"; atribución obligatoria "Free code signing provided by SignPath.io, certificate by SignPath Foundation"; política de firma publicada, MFA, aprobación manual de releases; SignPath puede rechazar a su discreción — [SignPath Foundation terms](https://signpath.org/terms)
- Apple Developer Program: 99 USD al año — [Windows Central](https://www.windowscentral.com/microsoft/windows-11/microsoft-store-drops-fees-for-individual-developers-apple-still-charges-usd99-per-year)
- La Microsoft Store firma las apps y les da reputación completa, y el registro individual es gratuito — [Microsoft Learn: SmartScreen reputation](https://learn.microsoft.com/windows/apps/package-and-deploy/smartscreen-reputation); [Windows Developer Blog](https://blogs.windows.com/windowsdeveloper/2025/09/10/free-developer-registration-for-individual-developers-on-microsoft-store/)

### Inferences
- Opciones para Windows: (a) no firmar y documentar el aviso "Más información → Ejecutar de todos modos" (lo habitual en juegos de itch); (b) SignPath si el código es OSI y los assets de Riot quedan fuera del binario firmado; (c) certificado OV comercial, con un coste anual de cientos de euros (sin cifra verificada) y HSM o nube obligatorios desde 2023; (d) Microsoft Store, si la política de contenido lo permite; (e) Artifact Signing, solo si se constituye una entidad en una geografía admitida o si Microsoft amplía la validación individual.
- Para macOS sin pagar 99 USD, el usuario tendrá que saltarse Gatekeeper a mano (en macOS 15 o superior ya no basta con clic derecho → Abrir; hay que ir a Ajustes del sistema; sin verificar en esta sesión). Esto pesa en la decisión de si macOS es un objetivo.
- En Linux no hace falta firma de plataforma. Las firmas del updater o las sumas SHA256 bastan.

### Gaps
- No encontré documentación oficial actual que confirme la disponibilidad de Artifact Signing para individuos en la UE en noviembre de 2026. Sus precios (unos 9,99 USD al mes en el nivel básico durante la preview) no los verifiqué en esta sesión.
- No sé si SignPath consideraría "componente propietario" los assets de Riot descargados aparte del binario.

## 5. Compilación cruzada y CI

### Takeaway
En repositorios públicos, GitHub Actions ofrece gratis y sin límite runners nativos de Linux, Windows y macOS en x64 y arm64. Así se evita compilar de forma cruzada: se usa una matriz con un runner por sistema. El cargo propuesto por minuto para runners self-hosted se aplazó.

### Cited Findings
- Runners estándar para repos públicos: `ubuntu-latest/24.04/22.04/26.04` (4 vCPU, 16 GB), `ubuntu-*-arm`, `ubuntu-slim` (1 vCPU), `windows-latest/2025/2025-vs2026/2022`, `windows-11-arm`, `macos-15-intel`/`macos-26-intel`, y `macos-latest/15/26` arm64 (3 vCPU M1, 7 GB). "Use of the standard GitHub-hosted runners is free and unlimited on public repositories" — [GitHub Docs: GitHub-hosted runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
- Desde el 1 de enero de 2026, los precios de los runners alojados bajan hasta un 39 % (relevante solo para repos privados) — [GitHub changelog 2026-01-01](https://github.blog/changelog/2026-01-01-reduced-pricing-for-github-hosted-runners-usage/)
- GitHub anunció en diciembre de 2025 un cargo de 0,002 USD por minuto para runners self-hosted a partir de marzo de 2026, y después lo aplazó "to re-evaluate our approach". El uso en repos públicos seguiría siendo gratuito — [GitHub changelog 2025-12-16](https://github.blog/changelog/2025-12-16-coming-soon-simpler-pricing-and-a-better-experience-for-github-actions/); [GitHub resources](https://resources.github.com/actions/2026-pricing-changes-for-github-actions/); [DevClass](https://www.devclass.com/development/2025/12/17/github-to-charge-for-self-hosted-runners-from-march-2026/1734518)

### Inferences
- Sin verificar en esta sesión: cachés útiles por stack: `Swatinem/rust-cache` o sccache (Rust), `actions/setup-node` con caché de pnpm o bun, `actions/setup-dotnet` con caché de NuGet, y la caché de plantillas de exportación de Godot (por ejemplo `chickensoft-games/setup-godot` o `firebelley/godot-export`).
- Toolchains reproducibles: **mise** (versiones de rust, node, dotnet, godot… en `mise.toml`, más tareas; ligero y amigable en Arch), **Nix flakes** (máxima reproducibilidad, curva alta, con problemas conocidos para apps gráficas en distros no NixOS por OpenGL y Vulkan), **devcontainers** (útiles para agentes en la nube y Codespaces, pero incómodos para probar una GUI de escritorio). Para agentes de IA, `mise install` más una tarea de comprobación única es lo que menos fricción tiene.
- La compilación cruzada real (Linux→Windows con `cargo-xwin` o mingw, o con `zig cc` mediante `cargo-zigbuild`) es viable para Rust nativo, pero no para firmar y notarizar en macOS. Godot sí exporta las tres plataformas desde Linux.
- Si el repositorio es privado, los minutos de macOS se facturan con un multiplicador alto. Hacer público el código elimina ese coste.

### Gaps
- No verifiqué los límites actuales de la caché de Actions (10 GB por repo, tradicionalmente) ni si cambiaron en 2026.

## 6. Monorepo y gestores de tareas

### Takeaway
Para un solo desarrollador con un único juego, lo habitual es un gestor de tareas ligero (just, mise tasks o Taskfile) más el workspace nativo del lenguaje (cargo, pnpm o bun workspaces, solución .NET). Nx y Turborepo resuelven problemas de equipos grandes o de muchos paquetes JS.

### Cited Findings
- No busqué fuentes en esta sesión. Ver Gaps.

### Inferences
Sin verificar en esta sesión, desde conocimiento general:
- **just:** justfile sencillo, multiplataforma (en Windows necesita sh o PowerShell configurado) y muy legible para agentes.
- **mise tasks:** combina versiones de herramientas y tareas en un único `mise.toml`, con dependencias entre tareas.
- **Taskfile (go-task):** YAML con caché por checksums de ficheros.
- **cargo workspaces:** separar el motor de simulación (`core`, sin dependencias de UI y determinista) de la app. Encaja con "reglas separadas de la interfaz" del IDEA.md.
- **pnpm o bun workspaces:** para Tauri o Electron con paquetes `sim-core`, `ui` y `data`.
- **Turborepo y Nx:** caché remota y grafos de tareas. Probablemente sea YAGNI para un proyecto individual, salvo que el stack sea TS con varios paquetes.
- **.NET:** una solución `.sln` o `.slnx` con proyectos separados (Core, App, Tests) y `Directory.Build.props`.

### Gaps
- No consulté documentación ni versiones de 2026 de estas herramientas.

## 7. Calidad de código: linters, hooks, changelog, crash reporting y telemetría

### Takeaway
Cada stack tiene un linter y un formateador canónicos (clippy y rustfmt; Biome u oxlint con o sin ESLint; `dotnet format` con analizadores Roslyn; gdtoolkit para GDScript). Los hooks se gestionan con lefthook o pre-commit, y los changelogs con git-cliff, release-please o changesets. Para crash reporting, Sentry ofrece un plan gratuito y existe la opción autoalojada. La telemetría en un juego fan exige consentimiento y aviso de privacidad.

### Cited Findings
- No busqué fuentes en esta sesión. Ver Gaps.

### Inferences
Sin verificar en esta sesión:
- **Rust:** `cargo clippy -D warnings`, `rustfmt`, `cargo nextest` y `cargo deny` (licencias y advisories, útil para la compatibilidad de licencias).
- **TS:** Biome (formateador y linter en un binario) u oxlint (muy rápido, compatible con reglas de ESLint). ESLint con typescript-eslint para reglas de tipos. `tsc --noEmit` como comprobación.
- **.NET:** `dotnet format`, analizadores con `TreatWarningsAsErrors` y nullable activado.
- **Godot:** gdtoolkit (gdlint y gdformat) para GDScript. GUT o gdUnit4 para tests.
- **Hooks:** lefthook (binario Go, rápido, ejecución paralela) frente a pre-commit (Python, gran ecosistema).
- **Changelog y versionado con Conventional Commits:** git-cliff (local, en Rust, configurable), release-please (GitHub Action con PR de release), changesets (orientado a monorepos JS).
- **Crash reporting:** Sentry tiene SDK para Rust, .NET, Electron y Godot (sentry-godot), y GlitchTip es una alternativa autoalojada compatible con su API. En un juego gratuito sin backend, una alternativa mínima es escribir un minidump o log local con un botón "copiar informe".
- **Telemetría:** el desarrollador está en la UE, así que aplica el RGPD. Desactivada por defecto o con opt-in explícito, y con política de privacidad. SignPath también exige una declaración de privacidad.

### Gaps
- No verifiqué los límites del plan gratuito de Sentry en 2026 ni el estado del SDK sentry-godot.

## 8. Licencia del código frente a assets de Riot

### Takeaway
El código propio puede llevar licencia libre (MIT, Apache-2.0 o GPL), pero los assets y las marcas de Riot no se pueden relicenciar y se usan con una licencia revocable y no comercial. Separar el repositorio de código del contenido protegido facilita la firma gratuita, Flathub y la eventual retirada.

### Cited Findings
- La licencia de Riot es no comercial, revocable y condicionada. Prohíbe usar logos y marcas sin licencia escrita — [Riot Games Legal](https://www.riotgames.com/en/legal)
- SignPath exige una licencia OSI sin doble licencia comercial y ningún componente propietario — [SignPath Foundation terms](https://signpath.org/terms)
- Flathub exige redistribución legal de todo el contenido alojado y permite `extra-data` para lo no redistribuible — [Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements)

### Inferences
- Patrón común (sin fuente en esta sesión): código bajo MIT o Apache-2.0 (o GPL-3.0 si se quiere evitar que otros cierren forks), y contenido de fans (nombres, datos de campeones, iconos de CommunityDragon) en un paquete aparte, con un `NOTICE` y el aviso de Riot, sin licencia libre. El juego podría arrancar con datos neutros o ficticios e importar el paquete de LoL. Eso reduciría la superficie de IP en el binario firmado y distribuido.
- Una licencia GPL no impide que un código MIT o Apache se use con assets propietarios. La cuestión es solo qué se redistribuye y bajo qué términos.
- Las licencias de los datos comunitarios (CommunityDragon, Meraki, Leaguepedia: CC BY-SA en wikis Fandom/Leaguepedia, sin verificar) pueden imponer share-alike sobre los datos derivados. Conviene revisarlo en la investigación legal.

### Gaps
- No verifiqué las licencias concretas de CommunityDragon, Meraki Analytics ni Leaguepedia.

## 9. Configuración amigable para agentes de IA

### Takeaway
Lo que más ayuda a Claude Code y a Codex: instrucciones en el repositorio (CLAUDE.md o AGENTS.md), un único comando de verificación rápido, tipos estáticos y tests deterministas. Flathub penaliza la automatización de envíos por IA y exige declarar el código generado.

### Cited Findings
- Flathub: "AI tools or agents must not open or automate Flathub submission pull requests" y hay que declarar el código y el empaquetado generados por IA — [Flathub requirements](https://docs.flathub.org/docs/for-app-authors/requirements)
- Valve rechazó un juego por assets generados con IA de propiedad dudosa — [PC Gamer](https://www.pcgamer.com/valve-is-scrutinizing-games-with-ai-assets-on-steam-says-avoiding-copyright-violation-is-the-developers-responsibility)

### Inferences
Sin verificar en esta sesión:
- AGENTS.md es la convención leída por Codex y otros agentes. Claude Code lee CLAUDE.md, que puede importar o enlazar AGENTS.md para no duplicar.
- Los lenguajes tipados (Rust, C#, TS estricto) dan al agente bucles de error del compilador muy informativos. Rust tiene compilaciones más lentas, que se compensan con `cargo check` y nextest. GDScript tipado es más débil y depende del editor.
- Un core de simulación sin UI, determinista y con semilla permite tests rápidos y snapshots (insta en Rust, Verify en .NET, Vitest en TS). Encaja con el IDEA.md y es lo que mejor aprovechan los agentes.
- Godot y las escenas `.tscn` son texto, pero editarlas sin el editor es frágil para un agente. Las UIs declarativas en código (Tauri con un framework web, Avalonia, egui) son más fáciles de modificar para un agente.
- La política de Steam sobre declarar contenido generado con IA en la página de la tienda existe desde 2024 (sin verificar en esta sesión). Afecta a assets, no al código.

### Gaps
- No verifiqué el estado de la especificación AGENTS.md ni cómo la soportan las herramientas en noviembre de 2026.
