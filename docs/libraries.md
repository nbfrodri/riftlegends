# Catálogo de librerías

Qué librería usar para cada necesidad. **Es obligatorio:** no se añade una dependencia que no esté aquí sin actualizar este catálogo en el mismo PR, con el motivo. Versiones y licencias comprobadas en npm el 19-11-2026; antes de instalar, confirma la versión actual y consulta su documentación con Context7.

## App de escritorio, no web

Rift Legends es una **app de escritorio instalable** (Electron), no una web: tiene su propia ventana, funciona sin conexión y no tiene servidor. Las tecnologías web solo se usan para dibujar la interfaz. En consecuencia:

- Nada de Next.js, SSR, rutas por URL ni despliegues web. El router usa **historial en memoria**.
- La única red permitida es la sincronización de assets y datos (Data Dragon y el snapshot de contenido). El juego arranca y se juega sin conexión.
- Fuentes **empaquetadas** con `@fontsource-variable/*`; nunca se cargan desde Google Fonts ni desde ningún CDN.
- Seguridad de Electron: `contextIsolation`, `sandbox`, sin `nodeIntegration`; el renderer solo habla con el núcleo a través de la API tipada del preload.
- El estado de la partida vive en SQLite (en el núcleo); `localStorage` solo se usa para preferencias de UI.
- Teclado primero; mando más adelante. Pensado para ventana grande o pantalla completa (1366×768 como mínimo).

## Aplicación y build

| Necesidad | Librería | Versión | Licencia | Notas |
| --- | --- | --- | --- | --- |
| Envoltorio | `electron` | 45.4 | MIT | Chromium empaquetado (ADR 0001) |
| Build y dev server | `electron-vite` | 6.0 | MIT | main, preload y renderer con Vite |
| Motor de compilación | `vite` | 8.3 | MIT | Dependencia par de electron-vite, compartida con Vitest |
| Empaquetado | `electron-builder` | 26.18 | MIT | NSIS, AppImage, tar.gz |
| Actualizaciones dentro de la app | `electron-updater` | 6.8 | MIT | Lee las releases del repo público; descargas diferenciales en NSIS y AppImage; canal beta opcional |
| Lenguaje | `typescript` | 7.0 | Apache-2.0 | `strict` |

## Interfaz

| Necesidad | Librería | Versión | Licencia | Notas |
| --- | --- | --- | --- | --- |
| UI | `react` | 19.3 | MIT | |
| Montaje del renderer y tipos JSX | `react-dom`, `@types/react` y `@types/react-dom` | 19.3 | MIT | Montan y tipan la interfaz React en la ventana de Electron |
| Componentes | **shadcn/ui** (CLI `shadcn` 4.23) sobre `@base-ui/react` | 1.9 | MIT | El código se copia a `packages/ui-kit` y es nuestro: se re-estila con los tokens del estilo elegido (ADR 0002). Base UI es la base por defecto de shadcn desde julio de 2026 |
| Estilos | `tailwindcss` + `@tailwindcss/vite` | 4.3 | MIT | Tokens como variables CSS (`@theme`) en `packages/ui-kit/tokens.css`; plugin de Vite en el renderer |
| Utilidades de clases | `clsx` + `tailwind-merge`, `class-variance-authority` | 2.1 / 3.7 / 0.7 | MIT / MIT / Apache-2.0 | cva para variantes de componentes |
| Tablas densas | `@tanstack/react-table` | 9.3 | MIT | Mercado, plantilla, estadísticas |
| Listas largas | `@tanstack/react-virtual` | 3.14 | MIT | Cuando una tabla supere unas cien filas visibles |
| Navegación entre pantallas | `@tanstack/react-router` | 1.170 | MIT | `createMemoryHistory`, rutas tipadas |
| Datos del núcleo en la UI | `@tanstack/react-query` | 5.108 | MIT | Caché e invalidación de las consultas IPC al núcleo |
| Estado de UI compartido | `zustand` | 5.1 | MIT | **Aplazado** hasta que dos pantallas compartan estado transitorio |
| Formularios | `react-hook-form` + `zod` | 7.92 / 4.6 | MIT | Editor del Sandbox, ajustes |
| Avisos | `sonner` | 2.0 | MIT | A través del componente de shadcn |
| Paleta de comandos y buscador | `cmdk` | 1.1 | MIT | A través del componente `command` de shadcn |
| Arrastrar y soltar | `@atlaskit/pragmatic-drag-and-drop` | 4.0 | Apache-2.0 | Orden de alineaciones; `@dnd-kit` lleva sin releases desde 2024-12 |
| Gráficas | `recharts` | 3.11 | MIT | Por defecto; `@visx/visx` 4.0 (MIT) para gráficas a medida, como la de oro de la partida |
| Cifras animadas | `@number-flow/react` | 0.6 | MIT | Marcadores, sueldos, estadísticas |
| Fuentes | `@fontsource-variable/unbounded` + `@fontsource-variable/archivo` | 5.3 | OFL-1.1 | Rótulos y datos, según el [ADR 0002](decisions/0002-estilo-visual.md) |

## Animación y presentación

| Necesidad | Librería | Versión | Licencia | Notas |
| --- | --- | --- | --- | --- |
| Transiciones de UI | CSS primero; `motion` | 14.14 | MIT | Entradas, salidas, layout, springs. **Sin GSAP**, porque su licencia no es OSI |
| Efectos broadcast y minimapa | `pixi.js` | 8.23 | MIT | Capa WebGL2 sobre el DOM, suscrita a los mismos hechos |
| Pixi dentro de React | `@pixi/react` | 8.0 | MIT | Opcional; se decide en el plan 09 frente a montar Pixi de forma imperativa |
| Sonido | `howler` | 2.2.4 | MIT | Sin releases desde 2023-09; si da problemas, Web Audio directo |

Todas las animaciones respetan `prefers-reduced-motion` y se pueden saltar sin alterar el estado.

## Iconos

| Uso | Librería | Versión | Licencia | Notas |
| --- | --- | --- | --- | --- |
| UI (acciones, menús, navegación) | `lucide-react` | 1.76 | ISC | Único set de UI |
| Conceptos de juego (moral, entrenamiento, objetivos) | `@iconify/react` + `@iconify-json/game-icons` | 6.0 / 1.2 | MIT / **CC BY 3.0** | game-icons.net exige atribución: se añade a `NOTICE.md` al integrarlo. Iconos empaquetados offline, no cargados desde la API de Iconify |
| Campeones, roles, objetos de LoL | Data Dragon en tiempo de ejecución | — | Riot | Nunca en el repo (ver `NOTICE.md`) |

## Textos e idiomas

| Necesidad | Librería | Versión | Licencia | Notas |
| --- | --- | --- | --- | --- |
| Traducciones ES/EN | `i18next` + `react-i18next` | 27.2 / 18.0 | MIT | Catálogos en `packages/i18n`, con claves tipadas |
| Fechas y números | `Intl` (nativo) | — | — | El calendario del juego son días enteros del núcleo; `date-fns` 4.4 solo si `Intl` no basta |
| Narrativa y prensa | `inkjs` | 2.4 | MIT | Fase 8; se decide en el plan 22 |

## Núcleo, datos y persistencia

| Necesidad | Librería | Versión | Licencia | Notas |
| --- | --- | --- | --- | --- |
| Esquemas y validación | `zod` | 4.6 | MIT | Contenido, contratos de IPC y comandos |
| PRNG | `pure-rand` | 8.4 | MIT | Algoritmo fijado; **nunca** `Math.random` ni `seedrandom` |
| SQLite | `node:sqlite` (validar en el build empaquetado) o `better-sqlite3` | — / 13.2 | — / MIT | Solo el `utilityProcess` del núcleo escribe |
| Nombres para regens | `@faker-js/faker` | 10.6 | MIT | Siempre con semilla derivada del PRNG del núcleo; verificar que la salida es determinista |

## Calidad

| Necesidad | Librería | Versión | Licencia |
| --- | --- | --- | --- |
| Tests | `vitest` | 5.1 | MIT |
| Tipos para el tooling de Node.js | `@types/node` | 26.6 | MIT |
| Propiedades | `fast-check` | 4.10 | MIT |
| Componentes | `@testing-library/react` | 16.3 | MIT |
| Peer de Testing Library | `@testing-library/dom` | 10.4 | MIT |
| DOM para tests de componentes | `happy-dom` | 21.0 | MIT |
| E2E (Electron) | `@playwright/test` | 1.65 | Apache-2.0 |
| Mutación | `@stryker-mutator/core` | 10.1 | Apache-2.0 |
| Lint y formato | `@biomejs/biome` | 2.6 | MIT o Apache-2.0 |
| Hooks de Git | `lefthook` | 2.2 | MIT |

## Descartadas

| Librería | Motivo |
| --- | --- |
| GSAP | Licencia no OSI (incompatible con SignPath si el repo se publica) |
| Mantine, MUI, Chakra | Componentes con estilos propios: cuesta que no parezcan genéricos |
| Ark UI | Su ventaja es ser multi-framework, que aquí no aporta |
| Aceternity, Magic UI y similares | Efectos decorativos genéricos ("AI slop") |
| Next.js y cualquier framework web con servidor | Es una app de escritorio |
| `seedrandom`, `Math.random` | Sin mantenimiento o sin semilla; rompen el determinismo |
| `@dnd-kit/core` | Sin releases desde 2024-12 |

## Documentación actualizada (Context7)

Antes de usar la API de una librería de este catálogo, los agentes consultan su documentación actual con **Context7** (`resolve-library-id` y después `query-docs`), porque las versiones son más nuevas que su conocimiento de entrenamiento.

- Claude: plugin `context7`, ya autenticado.
- Codex: servidor MCP definido en `.codex/config.toml` del repo (el proyecto debe estar marcado como de confianza en Codex).
