# Registro

La malla de Frecuencia queda sobre un campo mate. Las marcas de encuadre están ancladas a los bordes visibles de la placa. [Comparar con el original](../../frecuencia/index.html)

## Señal y registro

| Elemento | Regla | Función |
| --- | --- | --- |
| Fondo del arte | Azul mate `#172039`. Una línea `#a6c7fd0b` por cada 4 px. | La trama fija da textura al campo. Termina antes de la cartela del nombre. |
| Marcas de encuadre | Tinta `#b3c8e8` al 70 %. Arriba a la izquierda, brazos de 18 y 9 px. Abajo a la derecha, brazos de 10 y 16 px. | Las marcas fijan dos extremos con distinta orientación y sobreviven al recorte de la ilustración. |
| Escala del turno | 28 divisiones de 3 px con paso de 5 px. Altura normal de 4 px y de 9 px cada siete segundos. | Una división pasa de `#a4c8ef` a `#46546d` por segundo consumido. Pausar, confirmar o repetir conserva la correspondencia con el reloj. |
| Índice de mercado | Pestaña de 6 × 8 px junto al extremo derecho del alias seleccionado. | Señala hacia la ficha abierta y sigue la fila al recorrer la lista con las flechas. |

## Letras, espacio y movimiento

Barlow Condensed para equipos y rótulos. Barlow para la tabla y el informe. Cabecera de 38–64 px, campeón de 45–90 px y tabla de 12–16 px. Los datos heredan las cifras tabulares de la interfaz. La cuadrícula 1:2:1 y el radio de 2 px conservan la silueta del original.

Los fondos de texto son `#101420`, `#191f2f` y `#222b3e`. El secundario `#b6c0d2` tiene al menos 7,73∶1 sobre ellos. El botón usa `#101828` sobre `#a8deff` (12,30∶1). El reloj numérico comunica el tiempo a los lectores de pantalla. Las marcas del campo son decorativas. El cierre usa el barrido de 320 ms con `cubic-bezier(.23,1,.32,1)`. Con movimiento reducido se omite el barrido. La escala cambia de tinta en pasos discretos. [Tokens de referencia](../../frecuencia/tokens.md)
