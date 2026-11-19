# Plan 02 — `ui-kit`, estructura de la app e i18n

- **Estado:** borrador (pendiente de aprobación)
- **Fase:** 0 · Cimientos ([plan general](00-plan-general.md))
- **Objetivo:** la app de escritorio con el aspecto de **Caja** ([ADR 0002](../decisions/0002-estilo-visual.md)): tokens y fuentes empaquetadas, componentes base de shadcn/ui re-estilados, ventana sin marco con barra de título propia, barra lateral con navegación, i18n ES/EN con selector de idioma y una tabla densa base. Sin lógica de juego.

## Decisiones del usuario (19-11-2026)

- **Barra de título propia**, con ventana sin marco.
- Alcance: **barra lateral y navegación**, **i18n mínima**, **selector de idioma** y **tabla densa base**.
- **Solo tema oscuro.** Los tokens son variables CSS, así que un tema claro se podría añadir más adelante.
- **Tests visuales** con capturas de Playwright en el CI de Linux.

## Fuera de alcance

Pantallas reales de draft y mercado (spike S1 y S2 y Fase 2), animación broadcast con PixiJS, caché de assets `rl-asset://` (plan 10), mando o gamepad, y tema claro.

## Tests primero (criterios de aceptación)

| # | Comportamiento | Test | Tipo |
| --- | --- | --- | --- |
| T1 | Los tokens de `ui-kit` coinciden con el ADR 0002 (lienzo `#101420`, panel `#191f2f`, superficie `#222b3e`, texto `#f4f6ff` y `#b6c0d2`, acción `#a8deff` con texto `#101828`, azul `#88d6ff`, rojo `#ff9eab`, radio de 2 px) | Unit: lee `tokens.css` y compara con una tabla esperada | Unit |
| T2 | Todas las parejas texto/fondo declaradas cumplen **WCAG AA** (≥ 4,5:1; ≥ 3:1 para texto grande) | Unit: calcula el contraste de cada pareja | Unit |
| T3 | Las fuentes (Unbounded y Archivo) se cargan **desde el paquete**, sin red | E2E: `document.fonts.check()` para ambas y ninguna petición fuera de `file:`/`rl-asset:` | E2E |
| T4 | La ventana es sin marco y la barra de título propia minimiza, maximiza o restaura y cierra mediante IPC; la zona de arrastre no tapa los botones | Unit de `createMainWindowOptions()` (`frame: false`, seguridad intacta) + E2E de maximizar y restaurar | Unit + E2E |
| T5 | La barra lateral muestra Inicio, Calendario, Draft, Plantilla, Mercado, Scouting, Entrenamiento, Competición, Noticias, Historial y Ajustes. Draft, Mercado y Ajustes navegan; el resto aparece deshabilitado como «Próximamente» | Tests de componente (Testing Library, por rol y nombre) | Componente |
| T6 | **Alt+B** pliega y despliega la barra; flechas, Inicio/Fin y Enter navegan; el foco es visible; al entrar en Draft se pliega sola y se puede desplegar | Componente + E2E | Componente + E2E |
| T7 | La navegación usa **historial en memoria**: la URL de la ventana no cambia | E2E: `location.href` constante tras navegar | E2E |
| T8 | Todos los textos del shell salen de los catálogos; ES y EN tienen **las mismas claves**; idioma inicial según el del sistema (ES o EN; si no, EN) | Unit de paridad de catálogos + componente con cada idioma | Unit + componente |
| T9 | En **Ajustes**, el selector de idioma cambia la UI al instante y la preferencia persiste al reiniciar | Componente + E2E (relanzar la app) | Componente + E2E |
| T10 | `DataTable` ordena por columna (clic y teclado), filtra por texto, permite moverse por filas con flechas, alinea las cifras (tabulares, a la derecha) y anuncia el orden con `aria-sort` | Tests de componente con 36 filas de datos ficticios | Componente |
| T11 | Con `prefers-reduced-motion`, las transiciones del shell se desactivan | Componente (media query simulada) | Componente |
| T12 | Las capturas del shell (Draft vacío con la barra plegada, Mercado con la tabla y Ajustes) coinciden con las de referencia | Playwright `toHaveScreenshot` en el CI de Linux | Visual |

Verificación manual: en Arch Wayland (Hyprland) y en Windows, arrastrar la ventana por la barra de título, maximizar y restaurar con doble clic, y comprobar que los botones responden.

## Diseño

### Paquetes

```
packages/ui-kit/      tokens.css (@theme de Tailwind v4), fuentes (@fontsource-variable),
                      components.json de shadcn; components/ (button, tooltip, select,
                      scroll-area… según se necesiten), data-table/, sidebar/, title-bar/
packages/i18n/        i18next + react-i18next, locales/es.json y locales/en.json, detección de idioma
apps/desktop/         renderer: router (TanStack Router, createMemoryHistory), rutas
                      draft, mercado y ajustes; main: ventana sin marco + IPC de controles
```

### Decisiones

- **Tailwind v4** con `@tailwindcss/vite` en el renderer de electron-vite. Los tokens viven en `packages/ui-kit/tokens.css` (`@theme`) como única fuente de verdad, y los tests T1 y T2 los vigilan.
- **shadcn/ui sobre Base UI**, inicializado en `packages/ui-kit` (soporte de monorepo de la CLI). Solo se añaden los componentes que se usan, re-estilados con los tokens: nada de los estilos por defecto de shadcn.
- **Ventana sin marco:** `frame: false`; barra de título en React con `app-region: drag` y botones con `no-drag`; canales IPC `window:minimize`, `window:toggle-maximize` y `window:close`, más el evento del estado maximizado. El preload sigue exponiendo una API mínima y tipada (`window.riftlegends.window.*`). En Windows se valora `titleBarOverlay` si los botones dibujados dan problemas con el snap.
- **Router:** TanStack Router con `createMemoryHistory` y rutas tipadas. El plegado automático se activa con la ruta Draft.
- **i18n:** `packages/i18n` con i18next y claves tipadas. El idioma inicial sale de `app.getLocale()`, que main pasa al preload. La preferencia de idioma se guarda en `localStorage`, permitido para preferencias de UI ([libraries.md](../libraries.md)).
- **DataTable:** TanStack Table, todavía sin virtualización; el spike S2 medirá 500 filas y decidirá si hace falta TanStack Virtual.
- **Iconos:** Lucide en la barra lateral.
- **Tests visuales:** Playwright `toHaveScreenshot` en un proyecto aparte (`pnpm e2e:visual`), solo en el CI de Linux, con las capturas de referencia en el repo. `pnpm e2e:visual --update` las regenera y obliga a revisarlas en el PR.

## Troceado en issues (Tarea de plan · milestone «Fase 0 — Cimientos»)

| Orden | Issue | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | `ui-kit`: Tailwind v4, tokens de Caja y fuentes empaquetadas | `type:task`, `area:ui` | T1, T2 y T3 |
| 2 | `ui-kit`: shadcn/ui sobre Base UI con los componentes base re-estilados | `type:task`, `area:ui` | Tests de componente de cada componente añadido |
| 3 | `i18n`: paquete i18next, catálogos ES/EN y detección de idioma | `type:task`, `area:i18n` | T8 |
| 4 | Ventana sin marco y barra de título propia | `type:task`, `area:ui` | T4 y la prueba manual |
| 5 | Shell: barra lateral, router en memoria, Alt+B y plegado en Draft | `type:task`, `area:ui` | T5, T6, T7 y T11 |
| 6 | Ajustes con selector de idioma persistente | `type:task`, `area:i18n` | T9 |
| 7 | `DataTable` base en la pantalla de Mercado | `type:task`, `area:ui` | T10 |
| 8 | Tests visuales con capturas en el CI de Linux | `type:chore`, `area:infra` | T12 |

Dependencias: 1 → 2 → 5 → 6, 7 → 8; 3 → 5; 4 → 5.

## Riesgos

- **Barra de título en Wayland y Windows:** el doble clic y el snap de Windows pueden comportarse distinto con botones dibujados; alternativa con `titleBarOverlay` en Windows.
- **Capturas inestables:** fuentes y antialiasing distintos entre máquinas. Por eso solo se comparan en el CI de Linux, con un umbral de diferencia pequeño.
- **shadcn en monorepo con Base UI:** si la CLI no encaja con `packages/ui-kit`, se copian los componentes a mano y se documenta.
