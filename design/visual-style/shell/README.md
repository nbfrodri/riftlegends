# Caja · Shell de escritorio

Abre [la maqueta de Caja](caja/index.html) directamente en Chromium. La barra queda fija a la izquierda: **196 px** desplegada y **58 px** plegada, bajo una barra de título de **32 px**. La cabecera identifica a Bruma y muestra la fecha de temporada de la maqueta, 18 de junio de 2027. Ajustes queda al pie. Draft y Mercado se pueden abrir, y las nueve secciones pendientes llevan la indicación «Próximamente».

- **Alt+B** o el botón al pie alternan el ancho de la barra. Draft se abre plegado cada vez que se entra y permite desplegarla durante el turno. Mercado se abre desplegado la primera vez y recuerda su ancho mientras dure la sesión de la maqueta.
- **Tab** recorre Draft, Mercado, el botón de plegado y los controles de la vista. En la navegación, **↑/↓** y **Inicio/Fin** mueven el foco entre las secciones disponibles. **Enter** o **Espacio** abren la sección enfocada.
- La barra de título dibuja los controles de ventana y marca la zona de arrastre de una futura ventana Electron sin marco. Los controles son ilustrativos en el HTML.

## Verificación

Playwright con Chromium sin red y escala de 1×. Se midieron las filas enteras de jugadores visibles al inicio bajo el encabezado fijo, de un total de 36.

| Ventana | Mercado plegado | Mercado desplegado | Draft en ambos estados |
| --- | ---: | ---: | --- |
| 1366 × 768 | 30 | 30 | Torres y placa 1:2:1, con 232 px de alto para el arte |
| 1920 × 1080 | 31 | 31 | Torres y placa 1:2:1, con 380 px de alto para el arte |

Las dos vistas caben en ambas ventanas sin recortes de controles o paneles ni desplazamiento horizontal. La lista de mercado conserva el desplazamiento vertical para las filas restantes. Se comprobaron el foco visible, el atajo, la navegación y el cierre de una elección con y sin `prefers-reduced-motion: reduce`. Con movimiento reducido, la confirmación se anuncia sin el barrido de 320 ms.
