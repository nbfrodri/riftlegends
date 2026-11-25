# Tests visuales

Capturas de pantalla (`toHaveScreenshot`) de cuatro pantallas del shell y de las ocho del draft rápido (de la configuración al resultado de la serie, con semilla fija) a 1366x768 y con el sistema en `es-ES`: Draft con la barra lateral plegada (y, aparte, con el tooltip Caja abierto sobre «Expandir»), Campeones con la lista de Top (y, aparte, con el detalle de un campeón abierto), Mercado con la barra expandida y Ajustes (pantalla entera y, aparte, la sección «Contenido» en su estado sin conexión: «Sin descargar»). También se captura la pantalla de carga inicial con el contenido real todavía sin preparar (`startup.spec.ts`). Corren con `pnpm e2e:visual`, fuera del `pnpm e2e` normal, y solo en Linux (en otros sistemas el test se omite).

El tablero del draft se captura también con la ficha de campeón fijada, con la ficha de jugador abierta, con la «Lectura de la IA» abierta y con un campeón elegido sin confirmar (vista previa en la fila del jugador), y en otra serie con el tiempo por turno activado (barra del temporizador llena: el test congela `performance.now`). «Lado y orden» se captura también antes del mapa 3, con los campeones bloqueados agrupados por mapa.

## Por qué solo en el CI

La tipografía se rasteriza distinto en cada distribución, así que las capturas de referencia solo valen en la imagen del CI (`ubuntu-latest` bajo Xvfb). **No se generan ni se commitean desde una máquina local.** Las referencias viven en `__screenshots__/<spec>/` (`screens.spec.ts/` y `startup.spec.ts/`) (sin sufijo de plataforma, porque el test solo existe en Linux).

## Umbral

`maxDiffPixelRatio: 0.002` (0,2 % de los píxeles, unos 2.100 a 1366x768): absorbe el ruido de suavizado de bordes, pero no un elemento movido ni un color distinto. Las animaciones están desactivadas y el cursor de texto oculto. Se configura en `playwright.visual.config.ts`.

Playwright fija el tamaño del área visible del renderer. Antes de cada captura, `captureScreen` oculta y muestra el `body` para repintar desde cero (Chromium conserva trazas del pintado anterior y los bordes redondeados salían 1 nivel distintos entre ejecuciones, #501), espera a dos fotogramas idénticos byte a byte y comprueba que las fuentes Caja estén cargadas y espera a que se decodifiquen las imágenes de la pantalla.

## Puesta en marcha (referencias iniciales)

Mientras no exista `__screenshots__/`, el paso visual del CI se omite (no hay nada con qué comparar). Para crearlas:

1. Lanza el workflow **Visual baselines** (Actions > Visual baselines > Run workflow) sobre la rama del PR.
2. Descarga el artefacto `visual-baselines` y revisa las tres imágenes a mano.
3. Copia su contenido a `apps/desktop/e2e/visual/__screenshots__/` (conservando `screens.spec.ts/`) y commitéalo.

A partir de ahí el paso `Visual regression` del job `verify` falla si una captura cambia, y sube el informe y los diffs como artefacto `visual-diffs`.

## Cambio visual intencionado

Repite los pasos de arriba con tu rama: el workflow regenera las imágenes, las revisas en el PR y las commiteas junto al cambio.
