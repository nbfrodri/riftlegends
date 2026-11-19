# Atlas

Los dos equipos ocupan bandejas superpuestas a la izquierda. El relieve queda en el centro y la lectura de la jugada a la derecha. La ficha del jugador tiene su propia columna de archivo.

## Color y contraste

| Variable | Valor | Aplicación |
| --- | --- | --- |
| `--ground` | `#101a17` | Lienzo |
| `--surface` | `#18231e` | Panel y fondo de lectura |
| `--raised` | `#24312a` | Fila elegida y superficie secundaria |
| `--text` | `#f3edda` | Texto principal |
| `--muted` | `#bac5b7` | Texto secundario y etiquetas |
| `--accent` | `#e8cb91` | Acción y foco |
| `--on-accent` | `#232317` | Texto sobre la acción |
| `--blue` | `#a5d4dd` | Turno y equipo azul |
| `--red` | `#e7a498` | Equipo rojo |
| `--line` | `#435147` | Filetes y divisores |
| Color específico | `#18251f` | Campo cartográfico |

Contraste mínimo sobre los tres fondos de interfaz, calculado con luminancia relativa sRGB. El texto principal alcanza 11,59∶1, el secundario 7,60∶1, el acento 8,65∶1, el texto azul 8,44∶1 y el rojo 6,57∶1. En el botón principal, `--on-accent` sobre `--accent` da 10,11∶1. En campo cartográfico, `#e8cb91` sobre `#18251f` da 10,11∶1. Todas estas combinaciones superan el mínimo AA de 4,5∶1 para texto normal. Los filetes sirven para delimitar superficies.

## Tipografía y medidas

Cormorant Garamond a 38–64 px para la mesa, 45–90 px para el campeón y 34 px para la nota de encaje. IBM Plex Sans a 14–15 px para la lectura, 12–16 px para la tabla y 10–12 px para los índices de turno. Las cifras del reloj, los sueldos y las variaciones de forma usan numerales tabulares. Las familias propuestas tienen licencia SIL Open Font License. El HTML solicita Google Fonts cuando hay conexión y dispone de familias de sistema como reserva.

| Variable | Intervalo | Uso |
| --- | --- | --- |
| `--bar` | 48–64 px | Navegación entre draft y mercado |
| `--gutter` | 18–44 px | Margen exterior |
| `--gap` | 10–20 px | Separación entre zonas |
| `--pad` | 11–22 px | Espacio interior |
| `--row` | 18–26 px | Altura de fila según la altura de la ventana |

En la lista, la cabecera permanece fija y cada dato conserva su columna. El foco rodea la fila con un contorno de 2 px y el control activo con otro de 3 px. El nombre, el prefijo B/R y el estado de selección permiten interpretar el turno sin distinguir los colores.

## Forma y elevación

2 px en controles. Un filete de 1 px separa bandejas y ficha. La cartografía emplea líneas finas y una curva maestra cada cinco niveles. El latón identifica el punto de atención.

## Movimiento

El anillo de registro pasa de escala 2,2 a 0,55 y pierde opacidad en 420 ms con `cubic-bezier(.23,1,.32,1)`. La interacción frecuente de ordenar, filtrar o recorrer jugadores responde en el mismo fotograma. Con `prefers-reduced-motion: reduce`, la confirmación cambia directamente el texto del botón, el estado del turno y la casilla del equipo. El lector de pantalla recibe el nombre confirmado.
