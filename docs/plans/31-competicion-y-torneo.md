# Plan 31 — Sección «Competición» y modo Torneo

- **Estado:** aprobado (25-11-2026) con las [decisiones del usuario](#5-decisiones-del-usuario-25-11-2026).
- **Fase:** 4 · Competición ([plan general](00-plan-general.md#fase-4--competición)). Issue #431.
- **Depende de:** [plan 12](12-formatos-de-competicion.md), sobre todo el entregable 10 (#428: temporada en el despachador y consultas) y el 9 (#427: formatos internacionales).

## 1. Objetivo y alcance

La app muestra una **temporada competitiva completa** (seis ligas, First Stand, MSI y Worlds) y deja jugar un **torneo suelto** (IDEA §6) con las mismas pantallas.

| Entra | Queda fuera |
| --- | --- |
| Resumen de la temporada de todas las ligas | Crear carrera, bucle diario y directiva (plan 14) |
| Clasificación de cada fase (liga, grupos y Swiss) con la explicación del desempate | Guardar la temporada o el torneo en disco (plan 13): viven en memoria |
| Calendario y resultados; abrir cualquier serie jugada | Historial de temporadas, palmarés y Hall of Fame (plan 27) |
| Cuadros de eliminación simple y doble | Editor completo de formatos al crear la carrera (plan 14) |
| Página de equipo de la temporada actual | Minimapa y partida animada de otros equipos (plan 23) |
| Modo Torneo: preset (First Stand, MSI, Worlds) o personalizado, con mi equipo o solo como espectador | Ascensos y descensos (plan 24) |

## 2. Lista de tests

### Consultas del núcleo (`packages/core/competition`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| Q1 | `season.overview` lista cada competición con sus fases y su estado (`pending`, `live`, `finished`), el día actual, el líder y, al terminar, el campeón | Antes del día 0: todo `pending`, sin líder |
| Q2 | `competition.standings` da la clasificación **en curso** de una fase, no solo la final | Sin series jugadas: todos a 0 y en orden de sembrado, explicación `none` |
| Q3 | `competition.bracket` da cada serie del cuadro con sus equipos, su origen («Ganador de SF1») y su resultado | Byes; huecos aún pendientes; final con `reset` |
| Q4 | `competition.schedule` filtra por competición, equipo y días; cada serie lleva su id para abrirla | Equipos pendientes como referencia, no como id; un día sin series no aparece |
| Q5 | `team.profile` da plantilla, últimas 5 series, racha, series de la temporada y estadísticas (series y games, duración media, K/D/A por jugador y campeones más jugados) | Equipo sin series: estadísticas vacías, sin error |
| Q6 | `series.summary` y `match.view` aceptan el id de una serie de la temporada y devuelven lo mismo que en el draft rápido | Una serie aún no jugada: error `unknown-series` traducido |
| Q7 | Con `humanTeam`, `season.playDay` juega todas las series del día salvo la del usuario y la devuelve como pendiente | El día no se cierra hasta jugarla; repetir el comando no la juega dos veces (`expectedPosition`) |
| Q8 | La serie del usuario se juega con el flujo del draft rápido y queda registrada con los mismos hechos que las de la IA (`competition.seriesRecorded`) | Misma semilla y mismas decisiones: mismo log de hechos (golden) |
| Q9 | `tournament.create` con un preset llena las plazas por región con los mejores sembrados de cada liga | El usuario cambia un equipo; dos veces el mismo equipo se rechaza |
| Q10 | Un torneo personalizado inválido se rechaza con los errores del plan 12 (`invalid-format`, `not-enough-teams`, `format-too-long`) | 3 equipos en una eliminatoria de 4: bye, no error |

### Pantallas (tests de componentes)

| # | Pantalla | Comportamiento | Caso límite |
| --- | --- | --- | --- |
| U1 | Resumen | Una tarjeta por competición: logo, fase actual, líder o campeón y próximo día; un clic la abre | Competición terminada: campeón con su logo; sin empezar: fecha de inicio |
| U2 | Avance | «Jugar día», «Hasta fin de fase» y «Toda la temporada» con progreso; desactivados mientras se juega | Si hay una serie del usuario, el avance se para y aparece «Jugar mi serie» |
| U3 | Clasificación | `DataTable` con puesto, logo, equipo, series, games y diferencia; columna «Destino» (playoffs, play-in, eliminado) con texto | El tooltip del puesto explica el desempate en palabras; un grupo = una tabla |
| U4 | Calendario | Series por día; filtros por competición y equipo; ganador en negrita y marcador; un clic abre la serie | Rival pendiente en texto («Ganador de SF1»); día de hoy visible al abrir |
| U5 | Serie | Abre el resultado del draft rápido en modo lectura (marcador, games, MVP y gaps) | Volver deja el calendario o el cuadro donde estaba |
| U6 | Cuadro | Eliminación simple y doble con conectores; campeón destacado; un clic en una serie la abre | 6 equipos con byes; huecos pendientes; final con reset solo si se juega |
| U7 | Swiss | Columnas por balance (0-0, 1-0, 0-1…), clasificados y eliminados al final | Ronda con restricciones relajadas: aviso en palabras |
| U8 | Equipo | Cabecera (logo, liga, sembrado), plantilla con foto, forma (5 últimas, V/D con color y texto), racha, series y estadísticas | Sin foto: silueta; sin series: «Aún no ha jugado» |
| U9 | Torneo · configuración | Preset o personalizado, equipos, mi equipo o «Solo ver», fearless y semilla | Errores del núcleo traducidos junto al campo; no deja empezar con un formato inválido |
| U10 | Torneo · juego | Mismo hub que la competición; mi serie pasa por Lado y orden → Draft → Roles → Partida → Resultado y vuelve al hub | Eliminado: sigue como espectador; al final, pantalla de campeón |
| U11 | Teclado y lector | Cuadro y Swiss navegables con flechas; el lector lee cada serie («Ronda 2: T1 2–1 Gen.G») | Movimiento reducido: sin animación en los conectores |

### E2E, capturas y rendimiento

| # | Comportamiento |
| --- | --- |
| E1 | Playwright `_electron`: torneo personalizado de 4 equipos (eliminatoria simple Bo1) jugado con mi equipo de principio a fin, saltando las partidas |
| E2 | Capturas visuales (CI de Linux): resumen, clasificación, calendario, cuadro doble, Swiss y página de equipo |
| E3 | «Toda la temporada» no congela la UI: el progreso avanza por día y la ventana responde (el núcleo va en el `utilityProcess`) |
| E4 | Textos en ES y EN; guardas existentes en verde (sin subrayado, sin flechas, sin `title` nativo, cursor de mano) |

## 3. Diseño

### Navegación

La entrada «Competición» de la barra lateral (ya existe, sin ruta) se activa. Rutas en memoria (TanStack Router):

| Ruta | Pantalla |
| --- | --- |
| `/competicion` | Resumen de la temporada y controles de avance |
| `/competicion/$competition` | Hub de una competición con un control segmentado: **Clasificación · Calendario · Cuadro** (el cuadro solo si la fase lo tiene) y selector de fase |
| `/competicion/equipo/$team` | Página de equipo |
| `/competicion/serie/$series` | Resultado de una serie (lectura) |
| `/torneo` | Configuración del torneo; al empezar, el hub de su competición |

Un clic en cualquier logo o nombre de equipo abre su página.

### Consultas que consume

| Consulta | Origen | Uso |
| --- | --- | --- |
| `competition.standings` | Plan 12 (#428); aquí se pide en curso (Q2) y con `destinations` (#484) | Clasificación, grupos, Swiss y columna «Destino» |
| `competition.bracket` | Plan 12 (#428) | Cuadros |
| `competition.schedule` | Plan 12 (#428) + filtro `team` (Q4) | Calendario, página de equipo |
| `competition.qualified` | Plan 12 (#428) | Plazas internacionales ya ganadas |
| `season.overview` | **Nueva** (Q1) | Resumen |
| `team.profile` | **Nueva** (Q5), agregada de `competition.seriesRecorded` y `match.*` | Página de equipo |
| `series.summary`, `match.view` | Draft rápido, ampliadas con id de serie (Q6) | Resultado de una serie |
| `season.playDay` + `humanTeam` | Plan 12 + serie del usuario (Q7, Q8) | Avance y modo Torneo |
| `tournament.create` | **Nuevo** comando: crea una temporada de una sola competición con equipos `fixed` (Q9, Q10) | Torneo |

### Componentes que se reutilizan

| Pieza | De dónde |
| --- | --- |
| `DataTable` (virtualizada, filas alternas) | ui-kit · clasificación, calendario, estadísticas |
| `SegmentedControl`, `Select`, `SearchSelect`, `Tooltip` | ui-kit |
| Panel lateral de filtros y chips | Mercado (`market-filter-panel.tsx`) · calendario |
| `useTeamLogoSrc`, `LeagueLogo`, escudo propio | `assets/` |
| `PlayerPortrait`, `CountryFlag`, `GameRoleIcon`, `level-scale` | Draft y mercado · plantilla |
| `SeriesBanner`, `SeriesReport`, resultado del game | `draft/result-*` · serie en lectura |
| Flujo Lado y orden → Draft → Roles → Plan → Partida | Draft rápido · serie del usuario |

**Cuadro y Swiss:** componentes nuevos con CSS grid y conectores en SVG; sin librería nueva. Estilo Caja: series como casillas con borde, ganador en negrita, nada subrayado ni líneas inferiores de selección.

### Bocetos (1280×720)

Resumen:

```
┌ Temporada 2026 · día 34 ──────────── [Jugar día] [Hasta fin de fase] [Toda la temporada] ┐
│ ┌ LCK ──────────┐ ┌ LPL ──────────┐ ┌ LEC ──────────┐ ┌ LCP ──────────┐                   │
│ │ Rounds 1-2    │ │ Split 2       │ │ Spring        │ │ Split 2       │                   │
│ │ Líder: T1 9-1 │ │ Líder: BLG    │ │ Líder: G2     │ │ Líder: CFO    │                   │
│ └───────────────┘ └───────────────┘ └───────────────┘ └───────────────┘                   │
│ ┌ LCS ┐ ┌ CBLOL ┐ ┌ First Stand · campeón: HLE ┐ ┌ MSI · empieza el día 61 ┐              │
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

Hub de competición (clasificación):

```
┌ LCK · [Rounds 1-2 ▾]      ( Clasificación | Calendario | Cuadro ) ┐
│ #  Equipo        Series  Games  Dif.  Destino                      │
│ 1  T1            9-1     19-5   +14   Grupo Legend                 │
│ 2ⓘ Gen.G         8-2     17-7   +10   Grupo Legend                 │
│ …                                                                  │
│ 6  KT            4-6     10-13  -3    Grupo Rise                   │
└────────────────────────────────────────────────────────────────────┘
ⓘ tooltip: «Empate a 8-2; gana Gen.G por enfrentamiento directo (2-0)»
```

Cuadro de doble eliminación:

```
Superior   R1            R2            Final sup.     Gran final
           T1  3 ─┐
           KT  1 ─┴─ T1  3 ─┐
           …                ├─ T1 ─┐
Inferior   R1            R2 │       ├─ Campeón: T1
           DK  2 ─┐         │       │
           NS  3 ─┴─ …  ────┴───────┘
```

Página de equipo:

```
┌ [logo] T1 · LCK · sembrado 1        Forma: V V D V V   Racha: 2 victorias ┐
│ Plantilla                      │ Series de la temporada                    │
│ [foto] Top    Zeus    nivel 86 │ D34  Rounds 1-2  T1 2–0 KT                │
│ [foto] Jungla Oner    nivel 84 │ D31  Rounds 1-2  T1 1–2 HLE               │
│ …                              │ Estadísticas: series 9-1 · games 19-5 …   │
└────────────────────────────────┴───────────────────────────────────────────┘
```

### Modo Torneo

1. **Configuración:** preset (First Stand, MSI o Worlds con su formato real) o personalizado; equipos rellenados por plazas y sembrado, editables; mi equipo o «Solo ver»; fearless (hard por defecto) y semilla.
2. **Juego:** el hub de la competición. «Jugar día» juega las series de la IA; si toca la mía, se para y abre el flujo del draft rápido. Al volver, el resultado ya está en la clasificación o el cuadro.
3. **Final:** pantalla de campeón (logo y MVP de la final) y «Nuevo torneo».

El torneo vive en memoria; salir de la pantalla lo conserva mientras la app esté abierta.

## 4. Entregables (un issue por fila · milestone «Fase 4 — Competición»)

| Orden | Entregable | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | Consultas de vista: `season.overview`, clasificación en curso, `schedule` por equipo, `team.profile`, `series.summary` y `match.view` por serie | `type:task`, `area:competition` | Q1–Q6 |
| 2 | Serie del usuario dentro de la temporada (`humanTeam`) | `type:task`, `area:competition` | Q7, Q8 |
| 3 | Ruta «Competición»: resumen de la temporada y controles de avance | `type:task`, `area:ui` | U1, U2, E3 |
| 4 | Clasificación de liga y grupos con explicación y destino | `type:task`, `area:ui` | U3 |
| 5 | Calendario, resultados y serie en lectura | `type:task`, `area:ui` | U4, U5 |
| 6 | Cuadro de eliminación simple y doble | `type:task`, `area:ui` | U6, U11 |
| 7 | Vista Swiss | `type:task`, `area:ui` | U7, U11 |
| 8 | Página de equipo | `type:task`, `area:ui` | U8 |
| 9 | Torneo: `tournament.create` y pantalla de configuración | `type:task`, `area:competition` | Q9, Q10, U9 |
| 10 | Torneo: jugar con mi equipo de principio a fin | `type:task`, `area:ui` | U10, E1 |
| 11 | Capturas visuales y cierre del plan | `type:test`, `area:ui` | E2, E4 |

1 y 2 dependen de #428; 3 de 1; 4–8 de 3 y van en paralelo; 9 de 1 (los presets, también de #427); 10 de 2 y 9; 11 cierra el plan.

## 5. Decisiones del usuario (25-11-2026)

| # | Tema | Decisión |
| --- | --- | --- |
| 1 | Temporada antes de la carrera (plan 14) | **Temporada de exhibición** IA contra IA que se crea al entrar en «Competición», con «Jugar día», «Hasta fin de fase» y «Toda la temporada» |
| 2 | Entrada al modo Torneo | **Entrada propia** «Torneo» en la barra lateral, junto a «Draft» |
| 3 | Editor del torneo personalizado | **Editor simple**: hasta dos fases con los bloques del plan 12 (liga, grupos, Swiss → eliminación simple o doble), tamaño y Bo. El editor completo llega con el plan 14 |
| 4 | Equipos de un preset | **Plazas por región rellenadas con los mejores sembrados** de cada liga, editables |
| 5 | Página de equipo | **Solo la temporada actual** (plantilla, forma, racha, series y estadísticas). El historial es del plan 27 |
| 6 | Vista Swiss | **Columnas por balance**, como la retransmisión de Worlds |
