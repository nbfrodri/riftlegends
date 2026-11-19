# ADR 0002 — Estilo visual: Caja (Frecuencia)

- **Estado:** aceptada
- **Fecha:** 2026-11-19
- **Entradas:** cuatro rondas de propuestas de Codex en la rama `design/visual-style` (v1: cuatro direcciones; v2: cuatro variantes de Frecuencia; v3: tres ajustes ligeros) y la elección del usuario.

## Decisión

El estilo del juego es **Caja**, prototipo de referencia en `design/visual-style/frecuencia-v3/caja/` (rama `design/visual-style`). Es la dirección **Frecuencia** ("cabina de retransmisión": dos torres de equipo, placa central y mercado con columnas fijas), corregida en tipografía y ritmo para que no parezca generada.

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

Los tokens completos están en `design/visual-style/frecuencia-v3/caja/tokens.md`. Las fuentes se empaquetan con `@fontsource-variable/unbounded` y `@fontsource-variable/archivo` (OFL-1.1), sin cargarlas de la red.

## Estructura de la app

- **Barra lateral izquierda fija**, estilo dashboard: la barra no cambia y el contenido de la derecha sí. Secciones: Inicio, Calendario, Draft, Plantilla, Mercado, Scouting, Entrenamiento, Competición, Noticias, Historial y Ajustes. Se puede plegar a solo iconos.
- La maqueta de la barra sobre Caja está en curso (`design/visual-style/shell/caja/`). Su comportamiento en el draft broadcast (por ejemplo, plegarse al entrar) se fijará al revisarla.

## Consecuencias

- `packages/ui-kit` traduce estos tokens a variables CSS (`@theme` de Tailwind v4), y los componentes de shadcn/ui se re-estilan con ellos.
- El mismo PR que incorpore los tokens debe actualizar este ADR si cambian sus valores.

## Pendiente

- **Paleta:** durante la exploración el usuario pidió colores de lado más intensos, y Caja conserva los tonos originales de Frecuencia. Se puede revisar en el spike S1 sin cambiar el resto del estilo.
- **Icono del juego:** cuatro conceptos en curso (`design/brand/icon/`).
- Las variantes descartadas se quedan en la rama `design/visual-style` como referencia; solo se llevará a `main` lo que se use.
