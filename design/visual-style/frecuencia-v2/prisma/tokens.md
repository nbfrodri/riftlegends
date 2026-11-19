# Frecuencia / Prisma

Goldman recorta terminales y prolonga los trazos horizontales. Space Grotesk separa bien los nombres cortos y los dígitos en la ficha.

## Letras y densidad

| Función | Familia | Tamaño y composición |
| --- | --- | --- |
| Cabecera y campeón | Goldman 700 | Cabecera de 30–48 px. Campeón de 44–74 px, en versales sobre placa opaca. |
| Equipos | Goldman 700 | 24–36 px sobre tinta de lado. |
| Informe y controles | Space Grotesk 400–700 | Cuerpo de 14–15 px, nombre del jugador en seminegrita. |
| Mercado | Space Grotesk | Cuerpo `clamp(14px,.85vw,17px)`, fila `clamp(23px,2.85vh,32px)`. Ocho columnas y cabecera fija. |
| Reloj | Space Grotesk 700 | 31–48 px. El reloj y los datos usan `lining-nums tabular-nums`. |

Aireada. Más altura por jugador y mayor cuerpo para leer la fila de lado a lado. El HTML incluye los WOFF2 latinos de Google Fonts con sus licencias SIL OFL. [Goldman](https://github.com/google/fonts/tree/main/ofl/goldman) · [Space Grotesk](https://github.com/google/fonts/tree/main/ofl/spacegrotesk)

## Tintas

| Token | Valor | Función |
| --- | --- | --- |
| `--ground` | `#101017` | Lienzo |
| `--surface` | `#1a1b24` | Panel |
| `--raised` | `#30303d` | Selección y superficie secundaria |
| `--text` | `#f4f6ff` | Texto principal |
| `--muted` | `#b6c0d2` | Texto secundario |
| `--accent` | `#ffd044` | Acción y foco |
| `--on-accent` | `#101828` | Texto sobre acción |
| `--blue-fill` | `#1645d8` | Cabecera azul |
| `--red-fill` | `#bf1632` | Cabecera roja |
| `--blue` | `#6caeff` | Texto del turno azul |
| `--red` | `#ff7185` | Detalle del equipo rojo |
| `--line` | `#3c455b` | Divisores |

El menor contraste del texto principal, secundario, de acento o de lado sobre los tres fondos base es 4,92∶1. El blanco sobre las cabeceras azul y roja alcanza 7,30∶1 y 6,22∶1, respectivamente. El texto del botón sobre el acento alcanza 12,13∶1. El objetivo para texto normal es 4,5∶1. Los prefijos B y R y los nombres de los lados identifican los equipos también por escrito.

## Espacio y profundidad

Margen exterior de 18–44 px, separación entre zonas de 10–20 px y relleno de 11–22 px. Los paneles y controles tienen esquinas de 0 px. La torre abre con una banda de color continua. El nombre del campeón descansa sobre una placa con una muesca de 16 px. El foco del control tiene 3 px y el de la fila 2 px.

## Cierre del turno

Dos planos dentados irrumpen desde lados opuestos y se abren sobre el campeón. La secuencia dura 520 ms. Las dos hojas alcanzan el centro, sostienen el encuadre un instante y se retiran con `cubic-bezier(.77,0,.175,1)`. El nombre se asienta en 220 ms. El botón **Repetir turno** responde durante el efecto. Con movimiento reducido, la placa y B4 pasan directamente al estado confirmado y el lector de pantalla recibe el nombre elegido.

**Traslado a PixiJS/WebGL2.** Construir dos mallas triangulares, moverlas desde bordes opuestos y ocultarlas al salir del encuadre. La capa se recorta al área de arte. React conserva el texto, los controles y el foco en el DOM. Al repetir el turno se cancela la animación. Con movimiento reducido se omite el efecto gráfico.
