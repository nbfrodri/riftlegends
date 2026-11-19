# ADR 0002 — Estilo visual: Caja (Frecuencia)

- **Estado:** aceptada
- **Fecha:** 2026-11-19
- **Entradas:** cuatro rondas de propuestas de Codex en la rama `design/visual-style` (v1: cuatro direcciones; v2: cuatro variantes de Frecuencia; v3: tres ajustes ligeros) y la elección del usuario.

## Decisión

El estilo del juego es **Caja**, prototipo de referencia en [`design/visual-style/caja/`](../../design/visual-style/caja/index.html). Es la dirección **Frecuencia** ("cabina de retransmisión": dos torres de equipo, placa central y mercado con columnas fijas), corregida en tipografía y ritmo para que no parezca generada.

| Aspecto | Regla |
| --- | --- |
| Rótulos, marca y nombres de campeón y equipo | **Unbounded** 700 (ancha), en redonda, con interletraje negativo (−0,015 a −0,035 em) |
| Datos, reloj, tablas e índices | **Archivo**, siempre con **cifras tabulares**; tablas de 13 px como mínimo |
| Lienzo, panel y superficie seleccionada | `#101420` · `#191f2f` · `#222b3e` |
| Texto principal y secundario | `#f4f6ff` · `#b6c0d2` (7,73∶1 sobre la superficie seleccionada) |
| Acción | `#a8deff`, con texto `#101828` (12,30∶1) |
| Lado azul y lado rojo | `#88d6ff` · `#ff9eab` |
| Composición del draft | Torres y placa en proporción 1:2:1 |
| Espaciado y forma | Margen exterior de 18–44 px, separación de 10–20 px, radio de 2 px, borde superior de cada torre de 3 px |
| Lock-in | Barrido de 320 ms con `cubic-bezier(.23,1,.32,1)`; con movimiento reducido, el cierre se anuncia de inmediato |
| Densidad del mercado | 29 filas completas a 1366×768 |

Los tokens completos están en [`design/visual-style/caja/tokens.md`](../../design/visual-style/caja/tokens.md). Las fuentes se empaquetan con `@fontsource-variable/unbounded` y `@fontsource-variable/archivo` (OFL-1.1), sin cargarlas de la red.

## Estructura de la app

- **Barra lateral izquierda fija**, estilo dashboard: la barra no cambia y el contenido de la derecha sí. Secciones: Inicio, Calendario, Draft, Plantilla, Mercado, Scouting, Entrenamiento, Competición, Noticias, Historial y Ajustes. Se puede plegar a solo iconos.
- Maqueta en [`design/visual-style/shell/`](../../design/visual-style/shell/README.md): barra de título propia de 32 px; barra lateral de 196 px desplegada y 58 px plegada; **Alt+B** la pliega y despliega; se pliega sola al entrar en el draft. El mercado muestra 30 filas a 1366×768 y 31 a 1920×1080 en ambos estados.

## Consecuencias

- `packages/ui-kit` traduce estos tokens a variables CSS (`@theme` de Tailwind v4), y los componentes de shadcn/ui se re-estilan con ellos.
- El mismo PR que incorpore los tokens debe actualizar este ADR si cambian sus valores.

## Pendiente

- **Paleta:** durante la exploración el usuario pidió colores de lado más intensos, y Caja conserva los tonos originales de Frecuencia. Se puede revisar en el spike S1 sin cambiar el resto del estilo.
- ~~Icono del juego~~ Elegido: **Corte · Puntera** ([`design/brand/icon/`](../../design/brand/icon/README.md)).
- Las variantes descartadas se quedan en la rama `design/visual-style` como referencia; en `main` solo está lo elegido.
