# Iconos de aplicación · Rift Legends

Abre el [muestrario](index.html) para comparar los ocho tamaños a escala 1:1 sobre fondos claro y oscuro. La barra de tareas de Windows usa los PNG de 32 px y el lanzador de Linux, los de 48 px. Son simulaciones en el navegador.

| Concepto | Idea | A 16 y 32 px |
| --- | --- | --- |
| [Corte](corte/icon.svg) | Una **R** de Unbounded 700 ocupa un marco biselado. El remate coral de la letra y la arista azul toman los colores de los dos lados del draft. | Una R redibujada ensancha el hueco interior y conserva el remate de color. |
| [Torres](torres/icon.svg) | Las dos columnas de la cabina enmarcan una placa blanca. El desfase entre los lados hace reconocible el contorno del enfrentamiento. | Cada torre conserva una sola ranura y la placa central sigue separada por un canal oscuro. |
| [Pulso](pulso/icon.svg) | Un monitor de señal con un trazo escalonado oscuro sobre el azul de acción de Caja. | La onda ocupa el ancho del icono y se eliminan las marcas de calibración. |
| [Placa](placa/icon.svg) | Una cartela horizontal de retransmisión con el monograma **RL** de Unbounded 700. | La cartela gana altura, aumenta el peso del monograma y pierde el remate azul inferior. |

**Recomendación.** Corte representa directamente a Rift Legends y conserva una silueta reconocible junto a otros iconos a 16 px. Pulso ofrece una lectura inmediata con menos detalle y remite al monitor de señal. Placa mantiene el monograma visible, aunque su formato apaisado deja menos altura útil para las letras.

Cada carpeta contiene `icon.svg` como maestro y `icon-small.svg` para 16 y 32 px. Los PNG RGBA de **16, 32, 48, 64, 128, 256, 512 y 1024 px** se exportaron con `rsvg-convert`. Cada ICO se empaquetó con ImageMagick e incluye **16, 32, 48, 64, 128 y 256 px**. Los dos tamaños mayores se entregan como PNG. Las letras de los SVG maestros están trazadas y el muestrario incrusta los PNG y las fuentes Unbounded y Archivo con sus licencias OFL 1.1.

Se revisaron visualmente 16, 32 y 48 px sobre ambos fondos. Playwright y Chromium comprobaron los ocho tamaños, las dos simulaciones, el selector por teclado y la descarga sin red. Se verificaron también las dimensiones y la transparencia de los PNG y que cada fotograma ICO coincide con su PNG.
