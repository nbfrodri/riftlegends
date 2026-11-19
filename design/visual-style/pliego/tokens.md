# Pliego

La imagen ocupa la primera columna. A su derecha, las alineaciones se leen como dos columnas de resultados. El perfil abre el pliego del mercado por la izquierda.

## Color y contraste

| Variable | Valor | Aplicación |
| --- | --- | --- |
| `--ground` | `#f5f1e7` | Lienzo |
| `--surface` | `#fffcf3` | Panel y fondo de lectura |
| `--raised` | `#eae3d4` | Fila elegida y superficie secundaria |
| `--text` | `#231e1b` | Texto principal |
| `--muted` | `#615952` | Texto secundario y etiquetas |
| `--accent` | `#8a2734` | Acción y foco |
| `--on-accent` | `#fff9ee` | Texto sobre la acción |
| `--blue` | `#224f86` | Turno y equipo azul |
| `--red` | `#96273b` | Equipo rojo |
| `--line` | `#b7ae9c` | Filetes y divisores |
| Color específico | `#8a2734` | Sello del turno |

Contraste mínimo sobre los tres fondos de interfaz, calculado con luminancia relativa sRGB. El texto principal alcanza 12,91∶1, el secundario 5,37∶1, el acento 6,79∶1, el texto azul 6,50∶1 y el rojo 6,20∶1. En el botón principal, `--on-accent` sobre `--accent` da 8,28∶1. En sello del turno, `#fff9ee` sobre `#8a2734` da 8,28∶1. Todas estas combinaciones superan el mínimo AA de 4,5∶1 para texto normal. Los filetes sirven para delimitar superficies.

## Tipografía y medidas

Newsreader a 38–64 px en la cabecera, 45–90 px en el nombre del campeón y 18 px en el índice de campeones. La entradilla táctica mide 15–21 px. Source Sans 3 a 14–15 px en controles y 12–16 px en cifras. Las cifras del reloj, los sueldos y las variaciones de forma usan numerales tabulares. Las familias propuestas tienen licencia SIL Open Font License. El HTML solicita Google Fonts cuando hay conexión y dispone de familias de sistema como reserva.

| Variable | Intervalo | Uso |
| --- | --- | --- |
| `--bar` | 48–64 px | Navegación entre draft y mercado |
| `--gutter` | 18–44 px | Margen exterior |
| `--gap` | 10–20 px | Separación entre zonas |
| `--pad` | 11–22 px | Espacio interior |
| `--row` | 18–26 px | Altura de fila según la altura de la ventana |

En la lista, la cabecera permanece fija y cada dato conserva su columna. El foco rodea la fila con un contorno de 2 px y el control activo con otro de 3 px. El nombre, el prefijo B/R y el estado de selección permiten interpretar el turno sin distinguir los colores.

## Forma y elevación

0 px en controles y superficies. El círculo de la imagen identifica el turno B4. Un filete doble separa secciones y uno simple separa filas. Todo comparte el plano del papel.

## Movimiento

El titular asciende 0,3 em mientras aumenta su opacidad durante 260 ms con `cubic-bezier(.23,1,.32,1)`. La interacción frecuente de ordenar, filtrar o recorrer jugadores responde en el mismo fotograma. Con `prefers-reduced-motion: reduce`, la confirmación cambia directamente el texto del botón, el estado del turno y la casilla del equipo. El lector de pantalla recibe el nombre confirmado.
