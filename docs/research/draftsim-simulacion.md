# Simulación de partida de DraftSim: qué reutilizar en el plan 08

Estudio del 21-11-2026 sobre `~/Projects/draftsim`. Se reutilizan ideas, no código. Las rutas son de ese repo y las cifras salen de su código y sus tests, sin una ejecución propia. Es la fuente del [plan 08](../archive/plans/08-simulacion-de-partida.md).

## Cómo simula

1. Calcula una puntuación de composición por equipo con 11 términos y la resta en `diff` (`lib/matchSimulator.ts:630,2195`). A eso suma un sesgo de equipo (estrellas, racha, clutch) y de estrategia.
2. Calcula una ventaja por línea en oro por minuto. Entran fase, tier, counters, nivel, comfort, forma, cohesión y química, más un ruido de ±10 (`:1722`).
3. **Fija la duración antes de jugar** (34 min ± ajustes, acotada a 24–50; `:1892`).
4. Programa unas 40 fases en ventanas de tiempo fijas y las resuelve en orden. Cada evento decide el lado con un logit de `diff`, oro, momentum, objetivos y lado, acotado a 0,18–0,82 (`lib/sim/timeline/context.ts`).
5. Los eventos cambian el estado (oro, momentum, torres, control de mapa).
6. **El ganador sale de una tirada final** con un logit, no de la pelea del cierre (`lib/sim/timeline/closing.ts:107`). Por eso el ganador de la tirada puede no coincidir con quien domina el combate.

## Qué se aprovecha

| Idea | Decisión |
| --- | --- |
| Composición: daño AD/AP, frontline, engage, CC, identidad y fase | Adaptar. Sirven como razones explicables, pero sus pesos deben ser datos de contenido |
| Sinergias por pares y counters de línea curados | Conservar como contenido etiquetado |
| Nivel del jugador con efecto de suma cero entre líneas | Adaptar a atributos por área sin contar dos veces la fuerza |
| «Estrellas» como nota agregada del equipo | Descartar: la fuerza sale de los atributos |
| Forma con media móvil y decaimiento | Conservar como estado persistente |
| Maestría por campeón | Adaptar a un valor numérico |
| Química por pares, región y dúo bot; aclimatación de fichajes | Adaptar; enlaza con fichajes (Fase 6) |
| Estrategia con 16 palancas | Empezar con 3 |
| Combate por tiempo para matar (EHP frente a daño) | Adaptar y exponer su desglose en el hecho de la pelea |
| Peso del oro que baja con el minuto | Conservar como curva de contenido |
| Pivote estratégico del equipo que pierde | Adaptar: que surja del estado, no como evento aparte |
| Lado azul +0,1 de logit | Parametrizar |
| Clutch y «choke» por equipo | Pasar a atributos mentales del jugador |

## Problemas que evitar

- `Math.random` por defecto y estado global mutable (`lib/championMeta.ts:99`). En Rift Legends todo va por semilla y entradas.
- Floats en los logits (`Math.exp`, `Math.tanh`). Se sustituyen por enteros y tablas.
- Un solo RNG en secuencia: añadir un evento desplaza todos los siguientes. En Rift Legends se usa un flujo por minuto y por disputa.
- Las bajas del cierre son siempre 3–5 frente a 0–2 y no dependen de la partida.
- El snowball satura y se parchea con «comeback bias», que cambia el resultado sin dar una causa.
- El motivo de cada evento es texto libre, sin causa estructurada, y no hay un «por qué ganó».
- Faltan estadísticas por jugador (daño, CS, visión).
- Un fichero de 2.737 líneas lleno de constantes mágicas.

## Calibración de referencia

El favorito por diferencia de `diff` gana un 21/35/53/70/84 % (test con N = 2.500 y ±5 pp). No midió la distribución de duración, de upsets ni de eventos por partida. Rift Legends sí lo hará.

## Contenido que pide (para el plan 10)

Para cada campeón: arquetipos, fase de poder, movilidad, CC, tipo de daño y tier por línea; también sinergias, counters y power spikes.

Para cada jugador: atributos, maestría, forma, aclimatación y temple.

Además: tiempos y valor de los objetivos, la economía (oro por kill, torre e inhibidor) y las constantes de balance.
