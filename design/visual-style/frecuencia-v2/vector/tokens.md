# Frecuencia / Vector

Los cantos biselados de Tektur funcionan a gran tamaño. IBM Plex Sans sostiene los signos, los acentos y las cifras pequeñas sin estrechar el texto.

## Letras y densidad

| Función | Familia | Tamaño y composición |
| --- | --- | --- |
| Cabecera y campeón | Tektur 700 | Cabecera de 30–48 px. Campeón de 44–74 px, en versales sobre placa opaca. |
| Equipos | Tektur 700 | 24–36 px sobre tinta de lado. |
| Informe y controles | IBM Plex Sans 400–700 | Cuerpo de 14–15 px, nombre del jugador en seminegrita. |
| Mercado | IBM Plex Sans | Cuerpo `clamp(13px,.82vw,16px)`, fila `clamp(17px,2.12vh,23px)`. Ocho columnas y cabecera fija. |
| Reloj | IBM Plex Sans 700 | 31–48 px. El reloj y los datos usan `lining-nums tabular-nums`. |

Densa. La cabecera compacta libera altura, los números se alinean a la derecha y el foco recorre la fila completa. El HTML incluye los WOFF2 latinos de Google Fonts con sus licencias SIL OFL. [Tektur](https://github.com/google/fonts/tree/main/ofl/tektur) · [IBM Plex Sans](https://github.com/google/fonts/tree/main/ofl/ibmplexsans)

## Tintas

| Token | Valor | Función |
| --- | --- | --- |
| `--ground` | `#0b1719` | Lienzo |
| `--surface` | `#122124` | Panel |
| `--raised` | `#23373a` | Selección y superficie secundaria |
| `--text` | `#f4f6ff` | Texto principal |
| `--muted` | `#b6c0d2` | Texto secundario |
| `--accent` | `#73f4ad` | Acción y foco |
| `--on-accent` | `#101828` | Texto sobre acción |
| `--blue-fill` | `#1258d0` | Cabecera azul |
| `--red-fill` | `#bc222d` | Cabecera roja |
| `--blue` | `#69baff` | Texto del turno azul |
| `--red` | `#ff8181` | Detalle del equipo rojo |
| `--line` | `#3c455b` | Divisores |

El menor contraste del texto principal, secundario, de acento o de lado sobre los tres fondos base es 5,19∶1. El blanco sobre las cabeceras azul y roja alcanza 6,30∶1 y 6,17∶1, respectivamente. El texto del botón sobre el acento alcanza 12,91∶1. El objetivo para texto normal es 4,5∶1. Los prefijos B y R y los nombres de los lados identifican los equipos también por escrito.

## Espacio y profundidad

Margen exterior de 18–44 px, separación entre zonas de 10–20 px y relleno de 11–22 px. Los paneles y controles tienen esquinas de 0 px. La torre abre con una banda de color continua. El nombre del campeón descansa sobre una placa con una muesca de 16 px. El foco del control tiene 3 px y el de la fila 2 px.

## Cierre del turno

Tres ecos se expanden desde el punto de captura mientras la torre registra B4. La secuencia dura 420 ms. Cada eco dura 300 ms con `cubic-bezier(.23,1,.32,1)`. Los comienzos están separados por 60 ms. El nombre se asienta en 220 ms. El botón **Repetir turno** responde durante el efecto. Con movimiento reducido, la placa y B4 pasan directamente al estado confirmado y el lector de pantalla recibe el nombre elegido.

**Traslado a PixiJS/WebGL2.** Reutilizar tres contornos romboidales con el mismo origen, variar escala y alfa y apagar el ticker al terminar. La capa se recorta al área de arte. React conserva el texto, los controles y el foco en el DOM. Al repetir el turno se cancela la animación. Con movimiento reducido se omite el efecto gráfico.
