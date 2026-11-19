# Grada

El marcador superior presenta a los dos equipos en horizontal. Debajo quedan el cartel de la elección y un mosaico de dos filas. El dorsal del jugador abre la consulta de mercado.

## Color y contraste

| Variable | Valor | Aplicación |
| --- | --- | --- |
| `--ground` | `#f2ebff` | Lienzo |
| `--surface` | `#fffcff` | Panel y fondo de lectura |
| `--raised` | `#e5d9fa` | Fila elegida y superficie secundaria |
| `--text` | `#261843` | Texto principal |
| `--muted` | `#55456b` | Texto secundario y etiquetas |
| `--accent` | `#493196` | Acción y foco |
| `--on-accent` | `#ffffff` | Texto sobre la acción |
| `--blue` | `#283f94` | Turno y equipo azul |
| `--red` | `#952040` | Equipo rojo |
| `--line` | `#a99abd` | Filetes y divisores |
| Color específico | `#f7cf52` | Cartela y cabecera de ficha |

Contraste mínimo sobre los tres fondos de interfaz, calculado con luminancia relativa sRGB. El texto principal alcanza 12,08∶1, el secundario 6,38∶1, el acento 7,23∶1, el texto azul 7,02∶1 y el rojo 6,11∶1. En el botón principal, `--on-accent` sobre `--accent` da 9,71∶1. En cartela y cabecera de ficha, `#413052` sobre `#f7cf52` da 7,91∶1. Todas estas combinaciones superan el mínimo AA de 4,5∶1 para texto normal. Los filetes sirven para delimitar superficies.

## Tipografía y medidas

Archivo Black a 34–56 px en el título, 38–73 px en el cartel y 24 px en el marcador de equipos. Space Grotesk a 14–15 px en el cuerpo y 12–16 px en la tabla. Las versales se reservan para marca, cartel y jugador. Las cifras del reloj, los sueldos y las variaciones de forma usan numerales tabulares. Las familias propuestas tienen licencia SIL Open Font License. El HTML solicita Google Fonts cuando hay conexión y dispone de familias de sistema como reserva.

| Variable | Intervalo | Uso |
| --- | --- | --- |
| `--bar` | 48–64 px | Navegación entre draft y mercado |
| `--gutter` | 18–44 px | Margen exterior |
| `--gap` | 10–20 px | Separación entre zonas |
| `--pad` | 11–22 px | Espacio interior |
| `--row` | 18–26 px | Altura de fila según la altura de la ventana |

En la lista, la cabecera permanece fija y cada dato conserva su columna. El foco rodea la fila con un contorno de 2 px y el control activo con otro de 3 px. El nombre, el prefijo B/R y el estado de selección permiten interpretar el turno sin distinguir los colores.

## Forma y elevación

5 px en controles y carteles. El encuentro de dos masas de color señala los cambios de plano. El borde superior de 5 px identifica el lado. Las bandas alternas ayudan a seguir cada fila del mercado.

## Movimiento

La placa B4 baja 6 px y se endereza desde −12° en 240 ms con `steps(3,end)`. El nombre queda confirmado desde el primer fotograma. La interacción frecuente de ordenar, filtrar o recorrer jugadores responde en el mismo fotograma. Con `prefers-reduced-motion: reduce`, la confirmación cambia directamente el texto del botón, el estado del turno y la casilla del equipo. El lector de pantalla recibe el nombre confirmado.
