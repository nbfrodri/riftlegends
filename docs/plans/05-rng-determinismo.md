# Plan 05 — RNG, determinismo y golden tests

- **Estado:** aprobado (20-11-2026). Redactado por Claude y aprobado por el usuario con las cinco decisiones propuestas.
- **Fase:** 2 · Draft rápido completo ([plan general](00-plan-general.md)).
- **Objetivo:** que la misma semilla y los mismos comandos produzcan los mismos hechos, byte a byte, en Windows y Linux y entre versiones, salvo un cambio intencionado y declarado. También fija cómo se protegen esos resultados: goldens, propiedades y umbral de mutación.

## Contexto

- **S3** ([informe](../research/spikes-2026-11/s3-deterministic-core.md)) validó el método en Arch, Ubuntu y Windows: `xoroshiro128plus` de `pure-rand` 8.4.2 con estado serializable, semillas por FNV-1a de 32 bits sobre enteros little-endian, enteros en la puntuación y goldens con LF. Este plan lo convierte en código de producción con TDD.
- **Ya existe:** Biome prohíbe en `packages/core` `Math`, `Date`, `crypto`, `performance`, temporizadores y globales del host, y `boundaries.test.ts` lo comprueba. `.gitattributes` fuerza LF.
- **Plan 04:** los hechos tienen forma canónica estable. Este plan define cómo se guardan y comparan.

## Lista de tests

### RNG (`packages/core/rng`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| G1 | `deriveSeed(root, scope, ...ids)` coincide con los vectores de S3 (semilla 2, serie 75, partida 1 → 2489897068 y 469212319) | `root` 0 y 2³²−1; ids 0 y 2³²−1; un número de ids distinto da otra semilla |
| G2 | `deriveSeed` rechaza lo que no sea un entero de 32 bits sin signo | Negativos, decimales, `NaN`, más de 2³²−1 |
| G3 | Un flujo serializado y restaurado continúa con la misma secuencia | Propiedad: cortar en cualquier punto de 0 a 1.000 tiradas y restaurar no cambia las siguientes 100 |
| G4 | `int(rng, min, max)` da enteros en `[min, max]` con distribución uniforme | `min == max`; rango de un solo valor; rango completo de 32 bits; `min > max` → error |
| G5 | `pick(rng, lista)` y `shuffle(rng, lista)` son deterministas y no mutan la entrada | Lista vacía → error; lista de uno |
| G6 | `weighted(rng, pesos)` respeta los pesos enteros | Peso 0 nunca sale; todos 0 → error; propiedad: frecuencias dentro de la tolerancia con 10⁵ tiradas |
| G7 | Cada ámbito del registro tiene un número único y estable | Añadir un ámbito con un número repetido hace fallar el test; los números existentes no cambian |

### Aritmética entera (`packages/core/math`)

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| A1 | El punto fijo (escala 10.000) suma, resta, multiplica y divide con redondeo definido (mitad hacia par) | Desbordamiento por encima de `MAX_SAFE_INTEGER` → error, no pérdida silenciosa |
| A2 | `clamp`, `min`, `max` y `abs` enteros sin `Math` | Valores negativos y límites |
| A3 | Las rutas que deciden resultados solo devuelven enteros | Propiedad sobre el resultado de cada función de puntuación de los planes 06 a 08 |

### Goldens

| # | Comportamiento | Caso límite |
| --- | --- | --- |
| D1 | Para cada semilla fija, el log de hechos coincide byte a byte con su golden | Un byte distinto falla y el mensaje indica semilla, línea y diferencia |
| D2 | Los goldens se regeneran solo con `pnpm goldens:update`, nunca al ejecutar los tests | Golden ausente → el test falla, no lo crea |
| D3 | Cada golden lleva en cabecera `sim_version` y `content_version` | Si cambian los bytes sin subir `sim_version`, el test de coherencia falla |
| D4 | Los mismos goldens pasan en Ubuntu y Windows | Lo comprueba el CI (ver diseño) |

### Calidad

| # | Comportamiento |
| --- | --- |
| Q1 | Stryker sobre `packages/core` alcanza la puntuación de mutación acordada al cerrar cada fase |

## Diseño

### RNG

- **Algoritmo fijado:** `xoroshiro128plus` de `pure-rand` 8.4.2. Cambiar de algoritmo o de versión es un cambio de `sim_version`.
- **Derivación:** `deriveSeed(root, scope, ...ids)` = FNV-1a de 32 bits sobre `[root, scope, ...ids]` como enteros sin signo de 32 bits en little-endian. Es la codificación de S3, con sus vectores como tests.
- **Ámbitos:** un registro único (`packages/core/rng/scopes.ts`) con un número por ámbito (`draft = 1`, `match = 2`, …). Los números no se reutilizan ni se renumeran (G7).
- **Estado:** cuatro enteros de 32 bits con signo por flujo, en el orden de `getState()`. Viaja en el estado de la sesión y, desde el plan 13, se guarda en SQLite.
- **Regla:** cada decisión aleatoria usa un flujo derivado de su ámbito. Ningún módulo comparte flujo con otro, para que añadir una tirada en el draft no cambie la partida.

### Goldens

- Ubicación: `packages/core/test/goldens/<módulo>/<semilla>.golden`. Cabecera de una línea con `sim_version` y `content_version`, y después una línea canónica por hecho (plan 04).
- Semillas: 0, 2 y 2³²−1, las de S3, más las que cada plan añada para sus casos límite.
- Regenerar: `pnpm goldens:update`. Si cambian bytes, el PR sube `sim_version` y explica el motivo en la plantilla de PR, que ya tiene la casilla de goldens.

### CI

- Hoy `verify` corre en Ubuntu en cada PR, y `verify-windows` solo en `main` y en tags. Con eso, una divergencia de Windows se vería después de fusionar.
- **Decisión:** añadir a `ci.yml` un job `core-windows` en cada PR que ejecute solo los tests de `packages/core` (unos 2 minutos según S3), obligatorio en `protect-main`. Así se cumple T4 antes de fusionar, no después.

### Mutación

- Stryker (`@stryker-mutator/core` 10.1, ya en el catálogo) sobre `packages/core`, ejecutado a mano o en un workflow manual al cerrar cada fase, no en cada PR, por su coste.
- **Umbral:** `break` en 70 % y objetivo de 80 %. Los mutantes que sobreviven se revisan y se cubren o se justifican.

## Troceado en issues (Tarea de plan · milestone «Fase 2 — Draft rápido completo»)

| Orden | Issue | Labels | Test que lo cierra |
| --- | --- | --- | --- |
| 1 | Derivación de semillas y registro de ámbitos | `type:task`, `area:core` | G1, G2, G7 |
| 2 | Flujos de RNG serializables y utilidades (`int`, `pick`, `shuffle`, `weighted`) | `type:task`, `area:core` | G3–G6 |
| 3 | Aritmética entera y punto fijo | `type:task`, `area:core` | A1, A2 |
| 4 | Arnés de goldens con cabecera de versiones y `pnpm goldens:update` | `type:task`, `area:core` | D1–D3 |
| 5 | Job `core-windows` en cada PR, obligatorio | `type:task`, `area:infra` | D4: un PR de prueba con un golden alterado falla en Windows |
| 6 | Configurar Stryker y fijar el umbral | `type:test`, `area:core` | Q1 con la primera ejecución registrada |

1, 3 y 6 pueden ir en paralelo; 2 depende de 1; 4 depende de 2 y del issue de hechos canónicos del plan 04; 5 depende de 4.

## Riesgos

- **Colisiones de FNV-1a de 32 bits:** dos combinaciones de ids pueden dar la misma semilla. Es aceptable en un juego: produce dos secuencias iguales, no un error. Si algún día importa, se cambia a una función de 64 bits con un salto de `sim_version`.
- **Punto fijo insuficiente:** si una fórmula de la simulación necesita más precisión que 1/10.000, el plan 08 lo detectará con sus tests y podrá subir la escala con un salto de `sim_version`.
- **Coste del job de Windows:** añade minutos de runner a cada PR. Se limita a los tests del núcleo.

## Decisiones del usuario (20-11-2026)

1. Mantener el método de S3 (`xoroshiro128plus` de `pure-rand` 8.4.2 y FNV-1a de 32 bits) con un registro de ámbitos y un flujo por ámbito.
2. Punto fijo con escala 10.000 y redondeo mitad hacia par.
3. Goldens con cabecera de versiones; un cambio de bytes obliga a subir `sim_version`.
4. Job `core-windows` en cada PR, obligatorio en `protect-main`.
5. Stryker al cerrar cada fase, con `break` en 70 % y objetivo de 80 %.
