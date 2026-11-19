# Corte

El lado azul ocupa físicamente su cuarta casilla al confirmar. Se puede seguir el resultado mirando la torre incluso después de que termine el gesto. [Comparar con el original](../../frecuencia/index.html)

## Tintas de emisión

| Token | Valor | Aplicación |
| --- | --- | --- |
| `--ground` / `--surface` / `--raised` | `#0d111b` / `#161d2b` / `#232f41` | Lienzo, panel y selección previa |
| `--text` / `--muted` | `#f4f6ff` / `#b6c0d2` | Texto principal y secundario |
| Cartela / filetes | `#1a263a` / `#3c455b` | Fondo opaco del nombre y separación de datos |
| `--blue-ink` / `--red-ink` | `#1252cf` / `#c51e37` | Escudos, líneas de lado y casilla azul confirmada |
| `--blue` / `--red` | `#75b8ff` / `#ff8390` | Tintas claras disponibles para detalles sobre fondo oscuro |
| `--accent` / `--on-accent` | `#ffcf45` / `#101828` | Botón de acción, foco e indicación de selección |

El blanco sobre cobalto alcanza 6,70∶1. Sobre bermellón, 5,81∶1. El texto del botón sobre amarillo llega a 12,05∶1. La tinta secundaria conserva 7,37∶1 sobre la superficie elevada. Se mantiene el objetivo AA de 4,5∶1 para el texto normal.

## Gesto, forma y tipo

Una placa sólida entra en B4 desde el borde que mira al centro, recorre el ancho de la fila y queda fija. Un solo `translateX(100% → 0)`, 240 ms y `cubic-bezier(.23,1,.32,1)`. El texto del campeón y «Confirmado» aparecen desde el primer instante. La preferencia de movimiento reducido aplica directamente la placa final. Repetir el turno recupera el contorno de preselección.

Barlow Condensed en rótulos de 38–64 px y en el campeón de 45–90 px. Barlow a 12–16 px en tablas con altura de fila entre 18 y 26 px. Margen exterior de 18–44 px, separación de 10–20 px y controles de radio 2 px. La tinta entra detrás de los textos y las figuras de la fila, sin cubrir el botón ni el reloj. [Tokens de referencia](../../frecuencia/tokens.md)
