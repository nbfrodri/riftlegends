# Iconos de aplicación · Rift Legends

Abre el [muestrario](index.html) para comparar Corte antes y después y sus dos variantes en los ocho tamaños y sobre ambos fondos. **Zoom ×8** amplía los PNG de 16, 32 y 48 px sin interpolación. Los PNG originales de Corte están incrustados en el muestrario para poder reproducir la comparación sin red.

## Corte

| Versión | Aplicación del coral |
| --- | --- |
| [Corte refinado](corte/icon.svg) | Cubre toda la pata diagonal desde el hombro. Es la versión recomendada: la forma de la R se conserva y el coral se distingue a 16 px. |
| [Banda oblicua](corte/variantes/banda/icon.svg) | Cruza la pata en diagonal y deja el extremo del pie blanco. |
| [Puntera](corte/variantes/puntera/icon.svg) | Cubre el extremo de la pata con un corte horizontal. |

El SVG maestro conserva la R de Unbounded 700. En las tres versiones, el coral se superpone al blanco y ambas tintas comparten un solo recorte con la silueta de la R. `icon-small.svg` usa una rejilla de 16 unidades, sin trazos centrados ni coordenadas fraccionarias. Se rasteriza a 1×, 2× y 3× para obtener 16, 32 y 48 px, respectivamente.

## Otros conceptos de Caja

La barra de tareas de Windows muestra los PNG de 32 px y el lanzador de Linux los de 48 px. Las dos simulaciones del muestrario usan el Corte refinado.

| Concepto | Idea | A 16 y 32 px |
| --- | --- | --- |
| [Torres](torres/icon.svg) | Las dos columnas de la cabina enmarcan una placa blanca. El desfase entre los lados hace reconocible el contorno del enfrentamiento. | Cada torre conserva una sola ranura y la placa central sigue separada por un canal oscuro. |
| [Pulso](pulso/icon.svg) | Un monitor de señal con un trazo escalonado oscuro sobre el azul de acción de Caja. | La onda ocupa el ancho del icono y se eliminan las marcas de calibración. |
| [Placa](placa/icon.svg) | Una cartela horizontal de retransmisión con el monograma **RL** de Unbounded 700. | La cartela gana altura, aumenta el peso del monograma y pierde el remate azul inferior. |

## Exportación y verificación

Los PNG RGBA se exportaron con `rsvg-convert`. Cada ICO se empaquetó con ImageMagick e incluye 16, 32, 48, 64, 128 y 256 px. Los tamaños de 512 y 1024 px se entregan como PNG. El muestrario incrusta los PNG y las fuentes Unbounded y Archivo con sus licencias OFL 1.1.

Se inspeccionaron los píxeles de los 24 PNG nuevos. En cada tamaño, el coral forma una región conectada que toca la tinta blanca. Se comprobaron el interior opaco de la letra, la ausencia de huecos o de coral fuera del contorno y la coincidencia de cada fotograma ICO con su PNG. A 16, 32 y 48 px, todos los píxeles de la letra son blanco o coral puro.

| Píxeles de coral puro | 16 px | 32 px | 48 px | 64 px | 128 px | 256 px | 512 px | 1024 px |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Corte refinado | 10 | 40 | 90 | 102 | 450 | 1894 | 7758 | 31 398 |
| Banda oblicua | 5 | 20 | 45 | 53 | 244 | 1060 | 4400 | 17 921 |
| Puntera | 6 | 24 | 54 | 60 | 259 | 1079 | 4398 | 17 756 |

Para repetir el análisis desde la raíz del repositorio, ejecuta `python design/brand/icon/corte/verify.py` con `rsvg-convert` y Pillow (verificado con las versiones 2.63.3 y 13.0.0). Playwright con Chromium verificó el muestrario sin red, los ocho tamaños en ambos fondos, el zoom, el teclado y la descarga.
