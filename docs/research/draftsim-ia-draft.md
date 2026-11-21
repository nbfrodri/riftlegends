# IA de draft de DraftSim: qué reutilizar en el plan 07

Estudio del 21-11-2026 sobre `~/Projects/draftsim` (solo ideas, no código). Las rutas `path:línea` son de ese repo. Fuente del [plan 07](../plans/07-ia-de-draft.md).

## 1. Cómo decide

1. Lee el turno y excluye los campeones ya elegidos, baneados o bloqueados por fearless. `lib/draftAI/index.ts:439`
2. Construye el contexto con las posiciones inferidas, los arquetipos, el daño, los rosters y el estado de la serie. `lib/draftAI/index.ts:506`, `lib/draftAI/index.ts:644`
3. Suma los componentes deterministas de cada candidato. La personalidad multiplica los componentes etiquetados y el peso por defecto es ×1. `lib/draftAI/scoring.ts:147`, `lib/draftAI/scoring.ts:988`
4. Añade ruido uniforme por candidato, de hasta +1 en picks y +0,6 en bans. Si procede, aplica anticipación al puntuar bans y lookahead a los cinco picks mejor puntuados. `lib/draftAI/index.ts:541`, `lib/draftAI/index.ts:648`, `lib/draftAI/data.ts:171`
5. Muestrea entre los mejores N con softmax. A menor temperatura, más probable es el primero. El comodín amplía el grupo de picks al top 7 con un 5 % base donde está habilitado. El RNG admite semilla y por defecto usa `Math.random`. `lib/draftAI/helpers.ts:492`, `lib/draftAI/index.ts:570`, `lib/draftAI/data.ts:156`
6. Devuelve el campeón, el total, los aportes por componente y tres alternativas ordenadas. En picks, agrupa ruido y lookahead en un solo aporte. `lib/draftAI/index.ts:589`, `lib/draftAI/index.ts:674`, `docs/systems.es.md:31`

## 2. Componentes

Los valores son puntos base antes de aplicar la personalidad. Las decisiones de la última columna son propuestas para Rift Legends.

| Componente | Qué mide | Datos | Peso o rango | Plan 07 |
|---|---|---|---|---|
| `metaTier` | Potencia por posición y valor de quitar flex al rival. Incluye ajustes por marcador y victorias observadas | Tier por posición, posiciones viables, marcador, partidas y victorias | Pick 3–18 con meta activo. Ban tier ×2,5/×1,4 y flex ×1,4/×0,6 por fase. Ajustes de victorias hasta ±2 en torneo y ±2,5 para el equipo. `lib/draftAI/scoring.ts:181,819,851,892,1021` | **Adaptar.** Separar tier, flex y rendimiento observado para explicarlos y calibrarlos por separado. |
| `synergy` | Combos concretos y valor de romper un combo rival | Pares curados con intensidad | Tope bruto +6. Pick ×1,2, ban ×1/×2 por fase. `lib/draftAI/helpers.ts:302`, `lib/draftAI/scoring.ts:506,1047` | **Conservar.** Un combo concreto da una razón fácil de verificar. |
| `archetypeSynergy` | Compatibilidad entre kits y coherencia de la composición | Arquetipos por campeón, pares compatibles | Hasta +3 por pares implícitos y +2 por coherencia. Omite pares ya cubiertos por sinergia explícita. `lib/draftAI/helpers.ts:323`, `lib/draftAI/scoring.ts:489` | **Conservar.** Cubre combinaciones sin ficha propia. |
| `damageBalance` | Mezcla AD/AP y exposición a resistencias | Perfil de daño, tanques rivales y fuentes propias de DPS | +5 por cada tipo ausente que aporta, −3 por acumulación progresiva, −3 por mono-daño contra tanques y +1,5 por forzar resistencias mixtas. `lib/draftAI/helpers.ts:440`, `lib/draftAI/scoring.ts:303` | **Adaptar.** Ponderar la contribución real de daño y distinguir híbridos de utilitarios. |
| `playerComfort` | Dominio del campeón por el jugador que lo usaría | Posición, mains, secundarios, picks débiles, forma y química opcionales | Main +4, secundario +2, débil −4. Forma y química positivas suman con coeficientes 6 y 5, escalados por comfort. `lib/players.ts:49,149`, `lib/draftAI/scoring.ts:139,190` | **Conservar.** Hace que dos plantillas valoren distinto el mismo campeón. |
| `laneMatchup` | Ventaja de línea, respuesta a la composición y valor de quitar un counter | Counters dirigidos, posiciones inferidas, movilidad, fase, arquetipos y nivel rival | Matchup bruto aprox. ±10, multiplicador de información ×1–3 y recargo para extremos. Pick de negación hasta +6. `lib/draftAI/helpers.ts:407`, `lib/draftAI/scoring.ts:513,569,618` | **Adaptar.** Evaluar posiciones compatibles y separar línea de choque entre composiciones. |
| `identity` | Refuerza un plan emergente y explota una debilidad rival | 11 perfiles de composición, umbrales y arquetipos de ambos equipos | Desde dos picks, +2,5 por arquetipo buscado hasta +5, más refuerzos situacionales de +1,5/+2. `lib/draftAI/data.ts:63`, `lib/draftAI/helpers.ts:469`, `lib/draftAI/scoring.ts:328` | **Conservar.** Explica qué plan habilita el pick. |
| `crossGameCounter` | Responde al plan anterior y a patrones repetidos | Picks históricos por equipo, arquetipos que neutralizan o habilitan cada plan | Pick hasta +3 contra la última identidad y +1 por patrón. Ban +1,4 por arquetipo habilitador, con tope base +4 y ×1,4 en fase 2. `lib/draftAI/scoring.ts:52,779,1086` | **Adaptar.** Usar frecuencia y recencia de señales observadas. |
| `lookahead` | Riesgo de la respuesta rival y valor de la réplica | Orden real, candidatos legales, puntuador y matchups | 1-ply aplica la mitad del matchup si es menor que −2 y la atenúa según picks restantes. La segunda capa aporta −2, 0 o +1,5. `lib/draftAI/anticipation.ts:94,131` | **Adaptar.** Empezar con una réplica rival plausible y respetar turnos dobles antes de profundizar. |
| `targetBan` | Niega comfort o un pick probable; también premia tomar un main rival | Pools rivales, nivel del jugador, predicción y fase | Comfort ×5/×6, debilidad ×−2, anticipación +4/+8, tomar el main ×4. `lib/draftAI/scoring.ts:607,1057,1081` | **Adaptar.** Restringirlo a datos de scouting y separar firma, predicción y negación. |
| `threatBan` | Protege la composición propia de arquetipos que la castigan | Arquetipos propios y del candidato | +2/+3 por amenaza, ×2,5 en fase 2. `lib/draftAI/scoring.ts:1033` | **Conservar.** Expresa qué pieza propia protege el ban. |
| Cobertura y DPS | Cubre tanque, engage, carry y peel; aporta daño contra frontales | Arquetipos, fuentes de DPS y tanques rivales | Huecos +8/+6/+5/+3. DPS de +4 a +12 si falta, −2 por saturación. `lib/draftAI/scoring.ts:232,285` | **Adaptar.** Graduar los huecos según el plan y limitar los bonos que premian la misma aportación. |
| Prioridad, fase y weakside | Presión temprana, curva de poder y reparto de recursos | Fase de poder, alcance o presión de oleada, arquetipos y posición | Prioridad +1,5/+3 y presión a distancia +0,8. Fase −2 a +3,5 por regla. Weakside +1,5/+2. `lib/draftAI/scoring.ts:254,387,420` | **Adaptar.** Etiquetar cada señal para que las personalidades puedan ponderarla. |
| Flex y señal de bans | Mantiene posiciones abiertas o interpreta bans rivales como señal de valor | Posiciones con tier ≥B, turno, arquetipos baneados | Flex temprano `0,6 × (4 − picks propios) × (posiciones flex − 1)` si es positivo. Señal +0,8 por arquetipo con ≥2 bans. `lib/draftAI/helpers.ts:290`, `lib/draftAI/scoring.ts:633,743` | **Adaptar** el flex a posiciones realmente cubiertas por el roster. **Descartar** el bono automático por arquetipo baneado: el ban puede responder al rival o a la fase. |
| Afinidad de pocket pick | Premia un campeón conocido por debajo de A | Tier en la posición y pool propio | +2,5 en `comfort-first`, +3 en `cheese`. `lib/draftAI/scoring.ts:215`, `lib/draftAI/personalities.ts:130,160` | **Conservar.** Vincula la sorpresa con una fortaleza del jugador. |

## 3. Bans

- **Target y threat se suman en el mismo ranking.** En fase 1 pesa más retirar poder de meta y flex. En fase 2, los picks visibles elevan el valor de anticipar la próxima elección rival, romper combos y proteger la composición propia. El target usa el mayor producto de nivel y comfort del roster rival. El threat cubre dive contra un carry expuesto, engage contra poke y hyper-carry contra un equipo sin tanque. `lib/players.ts:165,179`, `lib/draftAI/index.ts:648`, `lib/draftAI/scoring.ts:1021`
- **Azul y rojo divergen sobre todo en picks.** El ban usa las mismas reglas para ambos lados con sus respectivos tableros. Azul prima flex en B1 y da +1,5 al S+. Rojo acumula valor de counter y en R5 añade ×0,6 a un matchup favorable o ×2,5 a uno de −4 o peor. Es una penalización de scoring. `lib/draftAI/index.ts:644`, `lib/draftAI/scoring.ts:661,723`
- **Fearless bloquea para pick y ban lo ya elegido por ambos equipos.** Los bans previos quedan disponibles. Para ahorrar picks de tier S o S+, aplica −1 por partida potencial restante, multiplicado hasta ×1,5 por flex. La reserva desaparece si una victoria cierra la serie o una derrota elimina al equipo. La repetición de arquetipos propios puede costar −3 en fearless o −1,2 en clásico. `lib/series.ts:389`, `lib/draftAI/index.ts:452`, `lib/draftAI/scoring.ts:750,943`
- **Marcador y adaptación.** El premio al tier alto y la penalización al tier C o inferior crecen al ir por detrás (+0,6 al coeficiente), afrontar eliminación (+1,4) o tener opción de cerrar (+0,5 si no hay eliminación). El ban entre partidas busca habilitadores de la última composición rival y, en clásico, campeones que el rival ya usó. `lib/draftAI/index.ts:232`, `lib/draftAI/scoring.ts:882,1086,1115`

## 4. Dificultad y coaches

| Dificultad | Pick N/T | Ban N/T | Cambios |
|---|---:|---:|---|
| Fácil | 5 / 3,5 | 5 / 3,0 | Omite lookahead, anticipación, objetivo de identidad, scouting de pools y varias señales de serie. Habilita comodín. |
| Normal | 3 / 2,0 | 3 / 1,5 | Activa anticipación, objetivo de identidad y lookahead 1-ply. Habilita comodín. |
| Difícil | 2 / 0,9 | 2 / 0,8 | Añade la segunda capa de lookahead y desactiva el comodín. |

`lib/draftAI/index.ts:294,511`, `lib/draftAI/data.ts:144`, `lib/draftAI/scoring.ts:190,779,892,1063`

El rating del coach fija la dificultad de su lado: <2,5 fácil, 2,5–<4 normal, ≥4 difícil. Su personalidad prevalece sobre la del equipo. En ausencia de coach se usa la dificultad general. Adaptabilidad y motivación actúan sobre la forma mediante cambios de meta y rachas, respectivamente. Para Rift Legends, conviene distinguir fuerza, estilo y conocimiento del rival. `lib/season/coach.ts:25,39`, `lib/season/engine.ts:166,893,1470`, `lib/series.ts:376`

## 5. Personalidades

| DraftSim | Multiplicadores y ajustes |
|---|---|
| `balanced` | Todos los pesos ×1. `lib/draftAI/personalities.ts:101` |
| `meta-slave` | `metaTier` ×1,6, `playerComfort` ×0,6, `laneMatchup` ×0,9, `crossGameCounter` ×0,85. Temperaturas ×0,45, ambos N −1, comodín desactivado. `lib/draftAI/personalities.ts:110` |
| `comfort-first` | `playerComfort` ×3,5, `metaTier` ×0,75, `targetBan` ×1,4. Temperatura de pick ×0,9, probabilidad de comodín ×2. `lib/draftAI/personalities.ts:130` |
| `counter-picker` | `laneMatchup` ×1,8, `crossGameCounter` ×1,7, `targetBan` ×1,5, `threatBan` ×1,3, `lookahead` ×1,5, `metaTier` ×0,85. Temperatura de pick ×0,8. `lib/draftAI/personalities.ts:145` |
| `cheese` | `metaTier` ×0,6, `playerComfort` ×1,5, `laneMatchup` ×0,8, ambos estilos de ban ×0,7. Temperaturas pick/ban ×2,2/×2,0, N +3/+2, probabilidad de comodín ×6. `lib/draftAI/personalities.ts:160` |
| `synergy-architect` | `synergy` y `archetypeSynergy` ×1,9, `identity` ×1,8, `metaTier` y `laneMatchup` ×0,85. Temperatura de pick ×0,9. `lib/draftAI/personalities.ts:182`, `docs/propuestas-profundidad.md:16` |

| Propuesta para Rift Legends | Idea | Pesos a cambiar |
|---|---|---|
| Presión temprana | Encadenar prioridad, escaramuzas y primeros objetivos | ↑ prioridad, fase temprana y sinergia de escaramuza |
| Escalado protegido | Resistir la fase de líneas hasta que el carry alcance sus picos | ↑ fase tardía, peel y `threatBan` contra dive |
| Flex de apertura | Mantener destinos viables y revelar las líneas al final | ↑ flex respaldado por el roster y resistencia a counters a ciegas |
| Ban a la estrella | Concentrar bans en los picks decisivos del mejor rival observado | ↑ banda de nivel del jugador dentro de `targetBan`, ↓ negación genérica de meta |
| Agotador de pools | Forzar al rival a sus opciones débiles cuando fearless ya consumió sus alternativas | ↑ negación de comfort por escasez de opciones viables, ↑ anticipación en fase 2 |
| Juego por laterales | Construir un 1-3-1 que ceda recursos en una línea y presione en la otra | ↑ identidad de splitpush, autosuficiencia weakside y `threatBan` contra engage |

## 6. Problemas conocidos

- **La segunda capa de lookahead nunca alcanza una réplica propia con el orden actual.** Tras B1 y R2 evalúa un segundo pick rival como propio. Tras B3 llega a un ban y devuelve cero. Además pide dos respuestas y solo usa la primera. `lib/draftAI/anticipation.ts:135,151`, `lib/draftOrder.ts:17`
- **El flex se puntúa sobre una asignación voraz.** Un flex top/mid ya colocado en top puede hacer que un top puro reciba −50 aunque mover el flex a mid resuelva ambos roles. La función de tier toma la primera posición abierta y el −50 sigue en el sorteo. En R5, el bono rojo también puede acreditar un counter contra un rival de otra posición. `lib/draftEngine.ts:38`, `lib/draftAI/helpers.ts:268`, `lib/draftAI/scoring.ts:175,697`, `lib/draftAI/index.ts:581`
- **La predicción rival usa un modelo genérico.** Prescinde de la personalidad y del contexto de roster o serie. En bans salta hasta el próximo pick rival sin simular las acciones intermedias. `lib/draftAI/anticipation.ts:51,176`
- **Dos etiquetas atribuyen más evidencia de la que hay.** «Opp pocket pick» se activa con un solo uso anterior porque consulta un conjunto. «Don't replay losing comp» compara contra todos los picks previos propios, incluidas victorias. `lib/draftAI/index.ts:179`, `lib/draftAI/scoring.ts:921,1115`
- **El panel deja parte de la decisión opaca.** El residual mezcla ruido con lookahead y las alternativas ofrecen solo totales. Para el plan 07, mostrar por separado la respuesta prevista, su efecto y la probabilidad de selección. `lib/draftAI/index.ts:589,605`

## 7. Datos de contenido que necesita

- [ ] **Campeones.** ID estable, nombre, posiciones jugables y tier de parche por posición. Derivar el flex de las posiciones que el roster puede cubrir. `lib/types.ts:21`, `lib/championMeta.ts:65`, `lib/draftAI/helpers.ts:290`
- [ ] **Perfil de combate.** Daño físico, mágico, mixto o marginal, capacidad de DPS sostenido, arquetipos, movilidad y fase de poder. Añadir presión de oleada explícita si se reutiliza la prioridad de línea. `lib/draftAI/helpers.ts:103,177,410`, `lib/draftAI/scoring.ts:254`
- [ ] **Relaciones.** Matchups dirigidos por pareja y posición, con intensidad, y sinergias por pareja con intensidad y motivo visible. Incluir reglas generales para las parejas sin ficha. `lib/draftAI/data.ts:49`, `lib/draftAI/helpers.ts:323,375`, `lib/championMeta.ts:453`
- [ ] **Composiciones.** Identidades con umbrales, arquetipos habilitadores y respuestas. Compartir ese vocabulario con el simulador. `lib/draftAI/data.ts:63`, `lib/draftAI/scoring.ts:52,71`
- [ ] **Jugadores.** ID estable, posición, nivel y dominio por campeón, con mains, secundarios y picks débiles conocidos. Para el pool rival, registrar qué se observó y cuándo. Forma, química y resultados son señales dinámicas opcionales. `lib/types.ts:49,83`, `lib/players.ts:149,179`, `docs/propuestas-profundidad.md:48`