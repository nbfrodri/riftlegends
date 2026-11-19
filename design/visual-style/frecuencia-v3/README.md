# Frecuencia · Tres ajustes al original

**Empezaría por Caja.** Permite probar lo que gustó de Umbral —el dibujo ancho del nombre— sobre el encuadre, el color y la animación de Frecuencia. A 1366 px, Archivo también da más cuerpo a la fila del mercado. [Abrir Caja](caja/index.html) · [Abrir el original](../frecuencia/index.html)

## Auditoría de Frecuencia

La revisión parte de lo que hace el entrenador al encontrar la decisión pendiente en B4 y al seguir una fila desde el alias hasta el sueldo.

| Antes, en el original | Por qué llama la atención | Después, en la prueba |
| --- | --- | --- |
| `.brand` y `.hero-caption h2` van en cursiva y versales. `.plate` añade cursiva a `skew(-7deg)`. | La marca, el protagonista y un índice operativo hablan con el mismo énfasis deportivo. B4 necesita leerse rápido incluso de reojo. | **Caja** reserva las letras anchas para nombres y titulares. El índice y el reloj quedan derechos. |
| `.advice p` aplica 6 px de margen a cada párrafo y baja a 4 px por debajo de 820 px de alto. `table` arranca en 12 px a 1366 de ancho. | El coste de elegir a Orianna queda demasiado pegado al argumento a favor. En el mercado hay que acercarse para casar sueldo y alias. | **Caja** separa la advertencia del argumento y lleva la tabla a un mínimo de 13 px con números tabulares. |
| `artwork()` centra `#signalField` detrás de la malla, con tres paradas radiales. Una elipse punteada y dos cruces con opacidad 0,32 acompañan cualquier elección. | La luz y las marcas siempre cuentan la misma historia, esté el reloj parado o a punto de agotarse. | **Registro** conserva la malla. Sustituye el halo y las cruces por un campo mate, marcas de encuadre y una escala que pierde una división por segundo. |
| `--blue: #88d6ff` y `--accent: #a8deff` se parecen; `--red: #ff9eab` tiene una luminosidad comparable. Cada `.team` recibe un filete de 3 px. | El botón y el equipo activo comparten prácticamente la misma tinta. El jugador debe leer para distinguir acción y pertenencia. | **Corte** separa las tintas de lado y reserva el amarillo para actuar. La cabecera del mercado sigue usando el fondo oscuro. |
| `.locked::after` barre toda la placa, incluida la acción, con un degradado a 111° durante 320 ms. A la vez, `team()` retira `.current` de B4 y vuelve a mostrar solo la posición. | El ojo sigue el brillo en el centro justo cuando necesita encontrar el resultado en su equipo. | **Corte** lleva una sola banda azul hasta B4. Al detenerse quedan legibles el campeón y «Confirmado». |

La proporción de columnas `1fr 2fr 1fr` permite cotejar B1 con R1 a la misma altura. La mantendría. Los radios de 2 px son discretos y las sombras interiores de 1 y 3 px indican estados. Tampoco recortaría la frase sobre Jarvan IV y el cataclismo: explica una jugada concreta.

## Comparación

| Prototipo | Qué cambia | Qué mirar al elegir |
| --- | --- | --- |
| [Caja](caja/index.html) · [Tokens](caja/tokens.md) | Unbounded y Archivo, escala de rótulos, alineación de B1–B5 y separación del riesgo. | El contraste entre el nombre ancho y la cifra de sueldo da a cada letra un trabajo distinto. Compara «Orianna» y luego el sueldo de Nadir con el original. |
| [Registro](registro/index.html) · [Tokens](registro/tokens.md) | Fondo de emisión mate, trama fija solo sobre el arte, dos marcas de registro y una escala ligada a los 28 segundos. Un pequeño índice señala la fila abierta en el mercado. | Pon el reloj en marcha y páusalo. Las marcas indican cuánto tiempo queda; la trama se queda quieta y el texto se lee sobre tinta lisa. |
| [Corte](corte/index.html) · [Tokens](corte/tokens.md) | Cobalto y bermellón para los lados, amarillo para la acción y una entrada de tinta limitada a B4. | Elige un campeón distinto y confirma mirando la torre azul. La casilla que acaba de cambiar conserva el color al terminar el movimiento. |

Cada HTML abre directamente desde disco e incluye las fuentes OFL con su licencia. Las tres pruebas comparten los diez huecos de elección, los diez bloqueos, el reloj, el arte geométrico, la propuesta táctica y los 36 jugadores del mercado. El selector de posición, la ordenación y el recorrido por teclado permiten repetir la misma prueba en las tres.

En Chromium al 100 % de zoom, Caja muestra 29 filas completas a 1366 × 768 y 30 a 1920 × 1080. Registro y Corte muestran 28 filas a 1366 × 768 y 29 a 1920 × 1080.
