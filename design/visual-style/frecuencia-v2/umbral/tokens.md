# Frecuencia / Umbral

Unbounded ensancha hombros y remata curvas en cortes bruscos. Archivo al 100 % de anchura mantiene contenidos los nombres de club.

## Letras y densidad

| Función | Familia | Tamaño y composición |
| --- | --- | --- |
| Cabecera y campeón | Unbounded 700 | Cabecera de 30–48 px. Campeón de 44–74 px, en versales sobre placa opaca. |
| Equipos | Unbounded 700 | 24–36 px sobre tinta de lado. |
| Informe y controles | Archivo 400–700 | Cuerpo de 14–15 px, nombre del jugador en seminegrita. |
| Mercado | Archivo | Cuerpo `clamp(13px,.84vw,16px)`, fila `clamp(20px,2.52vh,28px)`. Ocho columnas y cabecera fija. |
| Reloj | Archivo 700 | 31–48 px. El reloj y los datos usan `lining-nums tabular-nums`. |

Intermedia. El mayor ancho se reserva a los nombres de los campeones. El cuerpo de la tabla se mantiene al cambiar de vista. El HTML incluye los WOFF2 latinos de Google Fonts con sus licencias SIL OFL. [Unbounded](https://github.com/google/fonts/tree/main/ofl/unbounded) · [Archivo](https://github.com/google/fonts/tree/main/ofl/archivo)

## Tintas

| Token | Valor | Función |
| --- | --- | --- |
| `--ground` | `#151020` | Lienzo |
| `--surface` | `#201a2c` | Panel |
| `--raised` | `#33283e` | Selección y superficie secundaria |
| `--text` | `#f4f6ff` | Texto principal |
| `--muted` | `#b6c0d2` | Texto secundario |
| `--accent` | `#df9dff` | Acción y foco |
| `--on-accent` | `#101828` | Texto sobre acción |
| `--blue-fill` | `#3346da` | Cabecera azul |
| `--red-fill` | `#ce104e` | Cabecera roja |
| `--blue` | `#91aaff` | Texto del turno azul |
| `--red` | `#ff699d` | Detalle del equipo rojo |
| `--line` | `#3c455b` | Divisores |

El menor contraste del texto principal, secundario, de acento o de lado sobre los tres fondos base es 5,13∶1. El blanco sobre las cabeceras azul y roja alcanza 6,93∶1 y 5,51∶1, respectivamente. El texto del botón sobre el acento alcanza 8,79∶1. El objetivo para texto normal es 4,5∶1. Los prefijos B y R y los nombres de los lados identifican los equipos también por escrito.

## Espacio y profundidad

Margen exterior de 18–44 px, separación entre zonas de 10–20 px y relleno de 11–22 px. Los paneles y controles tienen esquinas de 0 px. La torre abre con una banda de color continua. El nombre del campeón descansa sobre una placa con una muesca de 16 px. El foco del control tiene 3 px y el de la fila 2 px.

## Cierre del turno

Seis hojas atraviesan el campo en una secuencia que revela el pick de arriba abajo. La secuencia dura 560 ms. Cada franja cruza la placa en 400 ms con `cubic-bezier(.77,0,.175,1)`. Los comienzos están separados por 32 ms. El nombre se asienta en 220 ms. El botón **Repetir turno** responde durante el efecto. Con movimiento reducido, la placa y B4 pasan directamente al estado confirmado y el lector de pantalla recibe el nombre elegido.

**Traslado a PixiJS/WebGL2.** Recortar seis sprites de color con máscaras horizontales y escalonar su recorrido 32 ms por franja. La capa se recorta al área de arte. React conserva el texto, los controles y el foco en el DOM. Al repetir el turno se cancela la animación. Con movimiento reducido se omite el efecto gráfico.
