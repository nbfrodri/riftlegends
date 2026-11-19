# Frecuencia / Órbita

Orbitron abre el nombre con contraformas rectangulares; Public Sans devuelve una silueta familiar a cada alias y a cada sueldo.

## Letras y densidad

| Función | Familia | Tamaño y composición |
| --- | --- | --- |
| Cabecera y campeón | Orbitron 700 | Cabecera de 30–48 px. Campeón de 44–74 px, en versales sobre placa opaca. |
| Equipos | Orbitron 700 | 24–36 px sobre tinta de lado. |
| Informe y controles | Public Sans 400–700 | Cuerpo de 14–15 px, nombre del jugador en seminegrita. |
| Mercado | Public Sans | Cuerpo `clamp(13px,.82vw,16px)`, fila `clamp(19px,2.36vh,26px)`. Ocho columnas y cabecera fija. |
| Reloj | Public Sans 700 | 31–48 px. El reloj y los datos usan `lining-nums tabular-nums`. |

Equilibrada. Nombres seminegros y sueldos en redonda, con una regla cada cinco jugadores. El HTML incluye los WOFF2 latinos de Google Fonts con sus licencias SIL OFL. [Orbitron](https://github.com/google/fonts/tree/main/ofl/orbitron) · [Public Sans](https://github.com/google/fonts/tree/main/ofl/publicsans)

## Tintas

| Token | Valor | Función |
| --- | --- | --- |
| `--ground` | `#0c1220` | Lienzo |
| `--surface` | `#141d2c` | Panel |
| `--raised` | `#253247` | Selección y superficie secundaria |
| `--text` | `#f4f6ff` | Texto principal |
| `--muted` | `#b6c0d2` | Texto secundario |
| `--accent` | `#5de1ff` | Acción y foco |
| `--on-accent` | `#101828` | Texto sobre acción |
| `--blue-fill` | `#1854ed` | Cabecera azul |
| `--red-fill` | `#cf193e` | Cabecera roja |
| `--blue` | `#57b1ff` | Texto del turno azul |
| `--red` | `#ff718a` | Detalle del equipo rojo |
| `--line` | `#3c455b` | Divisores |

El menor contraste del texto principal, secundario, de acento o de lado sobre los tres fondos base es 4,91∶1. El blanco sobre las cabeceras azul y roja alcanza 5,95∶1 y 5,44∶1, respectivamente. El texto del botón sobre el acento alcanza 11,56∶1. El objetivo para texto normal es 4,5∶1. Los prefijos B y R y los nombres de los lados identifican los equipos también por escrito.

## Espacio y profundidad

Margen exterior de 18–44 px, separación entre zonas de 10–20 px y relleno de 11–22 px. Los paneles y controles tienen esquinas de 0 px. La torre abre con una banda de color continua. El nombre del campeón descansa sobre una placa con una muesca de 16 px. El foco del control tiene 3 px y el de la fila 2 px.

## Cierre del turno

Dos escuadras cierran el campo y un anillo recoge la señal hacia el núcleo. La secuencia dura 480 ms. Las escuadras empiezan al confirmar y el anillo entra 80 ms después. Ambos usan `cubic-bezier(.23,1,.32,1)`. El nombre se asienta en 220 ms. El botón **Repetir turno** responde durante el efecto. Con movimiento reducido, la placa y B4 pasan directamente al estado confirmado y el lector de pantalla recibe el nombre elegido.

**Traslado a PixiJS/WebGL2.** Animar la escala de dos escuadras Graphics ancladas a los extremos y de una circunferencia centrada en el núcleo. La capa se recorta al área de arte. React conserva el texto, los controles y el foco en el DOM. Al repetir el turno se cancela la animación. Con movimiento reducido se omite el efecto gráfico.
