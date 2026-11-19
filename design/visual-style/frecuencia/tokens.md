# Frecuencia

La torre azul y la roja enmarcan una misma placa central. En la mesa de fichajes, el nombre, el nivel y el sueldo conservan una posición fija al recorrer la lista.

## Color y contraste

| Variable | Valor | Aplicación |
| --- | --- | --- |
| `--ground` | `#101420` | Lienzo |
| `--surface` | `#191f2f` | Panel y fondo de lectura |
| `--raised` | `#222b3e` | Fila elegida y superficie secundaria |
| `--text` | `#f4f6ff` | Texto principal |
| `--muted` | `#b6c0d2` | Texto secundario y etiquetas |
| `--accent` | `#a8deff` | Acción y foco |
| `--on-accent` | `#101828` | Texto sobre la acción |
| `--blue` | `#88d6ff` | Turno y equipo azul |
| `--red` | `#ff9eab` | Equipo rojo |
| `--line` | `#3c455b` | Filetes y divisores |
| Color específico | `#202b46` | Cartela de selección |

Contraste mínimo sobre los tres fondos de interfaz, calculado con luminancia relativa sRGB. El texto principal alcanza 13,13∶1, el secundario 7,73∶1, el acento 9,82∶1, el texto azul 8,84∶1 y el rojo 7,24∶1. En el botón principal, `--on-accent` sobre `--accent` da 12,30∶1. En cartela de selección, `#b6c0d2` sobre `#202b46` da 7,66∶1. Todas estas combinaciones superan el mínimo AA de 4,5∶1 para texto normal. Los filetes sirven para delimitar superficies.

## Tipografía y medidas

Rótulo principal de 38–64 px, nombre de campeón de 45–90 px y equipos de 28–44 px. Versales e inclinación en el nombre elegido. Barlow a 14–15 px en las explicaciones y 12–16 px en la tabla. Las cifras del reloj, los sueldos y las variaciones de forma usan numerales tabulares. Las familias propuestas tienen licencia SIL Open Font License. El HTML solicita Google Fonts cuando hay conexión y dispone de familias de sistema como reserva.

| Variable | Intervalo | Uso |
| --- | --- | --- |
| `--bar` | 48–64 px | Navegación entre draft y mercado |
| `--gutter` | 18–44 px | Margen exterior |
| `--gap` | 10–20 px | Separación entre zonas |
| `--pad` | 11–22 px | Espacio interior |
| `--row` | 18–26 px | Altura de fila según la altura de la ventana |

En la lista, la cabecera permanece fija y cada dato conserva su columna. El foco rodea la fila con un contorno de 2 px y el control activo con otro de 3 px. El nombre, el prefijo B/R y el estado de selección permiten interpretar el turno sin distinguir los colores.

## Forma y elevación

2 px en controles. Los equipos llevan una línea superior de 3 px con el color del lado. La placa central gana profundidad con el paso del índigo del campo al azul de la cartela.

## Movimiento

El movimiento dura 320 ms y utiliza `cubic-bezier(.23,1,.32,1)`. Un reflejo se desplaza de izquierda a derecha una sola vez. La interacción frecuente de ordenar, filtrar o recorrer jugadores responde en el mismo fotograma. Con `prefers-reduced-motion: reduce`, la confirmación cambia directamente el texto del botón, el estado del turno y la casilla del equipo. El lector de pantalla recibe el nombre confirmado.
