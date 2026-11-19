# Rift Legends — Documento de idea

> Estado: idea. Stack decidido en el [ADR 0001](docs/decisions/0001-stack-tecnologico.md) (Electron + TypeScript + React). Hoja de ruta en [docs/plans/00-plan-general.md](docs/plans/00-plan-general.md).

## 1. Qué es

**Rift Legends** es un juego de gestión de esports de League of Legends para escritorio, jugable en **Windows y Linux** con el mismo nivel de soporte (macOS fuera de alcance). El jugador dirige un equipo profesional: prepara drafts, toma decisiones de plantilla y estrategia y compite temporada tras temporada.

Es la evolución de **DraftSim**, que sirve como prueba de concepto de funcionalidades: draft con IA, simulación de partidas, torneos, temporadas y franquicias de varios años. DraftSim creció a base de parches; Rift Legends parte de cero con un diseño pensado desde el inicio como **juego**, no como simulador.

## 2. Simulador frente a juego

| DraftSim (simulador) | Rift Legends (juego) |
|---|---|
| Sandbox: el usuario observa y configura todo | El jugador tiene un **rol** y un equipo propio |
| Toda la información es visible | **Información imperfecta**: hay que investigar al rival |
| Sin objetivos | Objetivos, expectativas y consecuencias |
| Las decisiones son ajustes | Las decisiones tienen **coste** y compensaciones |
| La simulación es el producto | La simulación es el **motor**; el producto es la experiencia |

La simulación sigue siendo central: partidas, temporadas, mercado y evolución de jugadores se simulan. Pero todo se organiza alrededor de lo que el jugador decide y siente.

## 3. Pilares de diseño

1. **El draft es el momento estrella.** Es la decisión más táctica y la que más se juega en directo. Debe sentirse tensa, legible y espectacular.
2. **Las decisiones importan y se explican.** Cada resultado debe poder rastrearse hasta sus causas: composición, forma, estrategia, meta.
3. **Historias emergentes.** Rachas, rivalidades, dinastías, jóvenes promesas y veteranos en declive surgen de los sistemas, no de guiones.
4. **Realismo competitivo reconocible.** Ligas, formatos, calendario y meta inspirados en el circuito profesional real.
5. **Respeto por el tiempo del jugador.** Se puede jugar cada decisión o delegar y avanzar rápido.

## 4. Bucle de juego

### Bucle principal (día a día)

1. Avanzar el calendario hasta el siguiente evento: partido, ventana de fichajes, parche, reunión.
2. Prepararse: scouting del rival, entrenamiento, elección de estrategia.
3. Jugar el **draft** (o delegarlo en el staff).
4. Ver la partida (resumen animado, timeline de eventos o simulación instantánea).
5. Reaccionar: moral, forma, prensa, ajustes para el siguiente partido.

### Bucle de temporada

Split regional → playoffs → torneos internacionales → offseason (mercado, renovaciones, academia) → siguiente año.

### Bucle de carrera

Construir un proyecto a largo plazo: subir de nivel competitivo, ganar títulos, crear una dinastía o reconstruir tras un fracaso. Posible riesgo de despido si no se cumplen las expectativas.

## 5. Rol del jugador

El jugador es el **head coach / manager** de un equipo. Controla:

- **Draft**: picks, bans, orden y estrategia de serie (incluido fearless).
- **Estrategia de partida**: plan de juego, prioridades de objetivos, nivel de riesgo.
- **Plantilla**: titulares, suplentes, academia, fichajes, renovaciones y salidas.
- **Preparación**: foco del entrenamiento (meta frente a comfort picks, sinergias, scouting).
- **Gestión humana**: moral, química entre jugadores, carga de trabajo.

No controla directamente las mecánicas dentro de la partida: el resultado se simula según las decisiones y la calidad del equipo.

## 6. Modos de juego

| Modo | Descripción |
|---|---|
| **Carrera** | Modo principal. Eliges un equipo (o empiezas en una liga menor) y juegas temporadas indefinidamente. |
| **Draft rápido** | Una partida o serie de draft contra la IA o contra otro jugador local. Ideal para practicar. |
| **Torneo** | Configura y juega un torneo suelto: Worlds, MSI o uno personalizado. |
| **Sandbox / Realidades** | Heredado de DraftSim: simula temporadas IA contra IA, historias alternativas, edición libre de meta y plantillas. |

## 7. Sistemas principales

Inventario basado en DraftSim, que ya validó que estos sistemas funcionan y aportan profundidad.

### Draft
- Fases de picks y bans, reglas de lado azul y rojo, fearless draft.
- IA de draft con puntuación explicable (meta, rol, sinergias, counters, comfort, rival).
- Dificultad y **personalidades de draft** por equipo (meta, comfort, counterpick, pocket picks…).
- Coaches con distinta fuerza de draft.

### Simulación de partida
- Timeline por fases: líneas, objetivos, peleas y cierre.
- Influyen composición, nivel y forma de los jugadores, química, estrategia y meta.
- Pivote estratégico a mitad de partida para hacer legibles las remontadas.
- Estadísticas por jugador (KDA, oro, participación) y nota por partido.

### Competición
- Ligas regionales (LCK, LPL, LEC, LCS, CBLOL, LCP) e internacionales (First Stand, MSI, Worlds).
- Formatos: liga, grupos, Swiss y eliminatorias simple y doble.
- Series al mejor de 1, 3 y 5, con elección de lado por el perdedor.

### Jugadores y carrera
- Identidad estable, atributos, pool de campeones, forma, edad y evolución.
- Mercado de fichajes, agentes libres, academias y renovaciones.
- Premios: MVP, All-Pro, finales y registros históricos.

### Meta
- Tiers de campeones con evolución durante torneos (lo que domina se prioriza o se banea).
- **Parches entre splits** con notas generadas, que obligan a adaptarse.

### Historial
- Hall of Fame, récords, palmarés, perfiles de jugadores y equipos, head-to-head.
- Toda la historia se construye a partir de lo que ha ocurrido de verdad en la partida guardada.

## 8. Novedades respecto a DraftSim

- **Scouting e información imperfecta**: los pools y tendencias rivales se revelan investigando o viendo partidos.
- **Objetivos de directiva y presupuesto**: expectativas por temporada y consecuencias si no se cumplen.
- **Moral y dinámica de vestuario**: química, egos, conflictos por minutos.
- **Entrenamiento con coste de oportunidad**: no se puede preparar todo a la vez.
- **Presentación de juego**: un draft animado y con tensión, celebraciones, noticias y titulares.
- **Narrativa emergente**: prensa, rivalidades y momentos destacados generados a partir de los sistemas.

## 9. Fuera de alcance (por ahora)

- Multijugador online y servidores.
- Control mecánico de campeones dentro de la partida.
- Reproducción exacta de cada parche real.
- Monetización de cualquier tipo.

## 10. Lecciones de DraftSim

Para que Rift Legends no repita los problemas de la prueba de concepto:

- **Diseño modular desde el principio**: módulos pequeños con una responsabilidad clara; nada de ficheros de miles de líneas.
- **Reglas del juego separadas** de la interfaz y del almacenamiento.
- **Lo ocurrido como fuente de verdad**: guardar los hechos (partidos jugados, fichajes, premios) y derivar de ellos estadísticas e historial, en vez de reconstruirlos a posteriori.
- **Simulación determinista** con semilla, reproducible y testeable.
- **Contenido como datos** (campeones, equipos, meta) separado del código.
- **Documentación viva**: decisiones registradas y contratos de dominio desde el día uno.
- **Usar DraftSim como referencia** para validar que el nuevo motor produce resultados comparables.

## 11. Aspectos legales

Rift Legends es un **fan project no oficial y gratuito**, sin afiliación con Riot Games.

- Debe cumplir la política de contenido de fans de Riot ("Legal Jibber Jabber"): sin monetización, con el aviso legal correspondiente y sin aparentar ser un producto oficial.
- Nombres, ilustraciones, iconos y sonidos de League of Legends pertenecen a Riot Games.
- Los datos de la comunidad (CommunityDragon, Meraki Analytics, Leaguepedia) se atribuyen según sus condiciones.
- **Cláusula de juegos**: la política de Riot prohíbe expresamente usar su PI en juegos y apps, aunque sean gratuitos. Se usa contenido real de LoL **asumiendo ese riesgo** (Riot podría pedir la retirada).
- **Nombre**: "Rift Legends" coincide con la European Regional League (ERL) oficial de Polonia y Europa del Este. Se mantiene igualmente, como riesgo asumido.
- **Mitigaciones**: el repositorio y los binarios no contienen assets de Riot (el arte se descarga de Data Dragon en tiempo de ejecución a una caché local); los datos de esports proceden de un snapshot de Leaguepedia con atribución CC BY-SA; un dataset ficticio mínimo permite jugar sin red; el código se licencia por separado (MIT/Apache).

## 12. Preguntas abiertas

Resueltas (19-11-2026):

- ~~¿Se empieza en una liga top o se puede subir desde ligas menores?~~ Primero ligas top; ligas menores y ascensos en una fase posterior.
- ~~¿Jugadores reales, ficticios o ambos?~~ Reales al inicio y regens ficticios con el paso de los años.
- ~~¿Cuánto detalle tiene la visualización de partidas?~~ Primero timeline de eventos; minimapa animado 2D después.
- ~~¿Existe el despido o la carrera es infinita?~~ Sin despido por ahora (los objetivos de directiva sí existen).
- ~~¿Draft local entre dos personas desde el inicio?~~ No por ahora.
- ~~Stack tecnológico y arquitectura~~ Ver el [ADR 0001](docs/decisions/0001-stack-tecnologico.md).

Otras decisiones:

- Interfaz en español e inglés (i18n) desde el inicio.
- Primer hito jugable: draft rápido completo contra la IA (draft broadcast, serie simulada y resultado).

Abiertas:

- Estilo visual (cuatro direcciones propuestas en `design/visual-style`).
- Detalle de cada sistema: se define en los planes específicos de `docs/plans/`.
