# ADR 0003 — Go/no-go de la Fase 1: se confirma Electron

- **Estado:** aceptada
- **Fecha:** 2026-11-20
- **Entradas:** los informes de los spikes en [`docs/research/spikes-2026-11/`](../research/spikes-2026-11/), medidos según el [plan 03](../plans/03-spikes.md), y las ramas desechables `spike/73` a `spike/77`.

## Decisión

**Go.** Se confirma el stack del [ADR 0001](0001-stack-tecnologico.md): Electron, núcleo TypeScript y React. **El plan B (Godot + C#) no se activa.** Ningún criterio de descarte del plan 03 se cumplió. El draft *broadcast* respeta el presupuesto, no hubo pantallas en blanco en Wayland y el retoque costó muy por debajo de lo previsto. Tampoco hubo divergencias ni guardados parciales, y la carrera anterior se pudo leer. La Fase 2 puede empezar.

**Driver de SQLite: `node:sqlite`** (SQLite 3.54.1 en Arch, {{SQLITE_WIN}} en Windows), cargado dentro del `utilityProcess` del paquete. No hace falta `better-sqlite3` ni ningún módulo nativo: el escritor se ejecuta directamente desde `app.asar`, sin `asarUnpack` ni recompilar para la ABI de Electron.

## Resultados por prueba

| Prueba | Resultado | Evidencia |
| --- | --- | --- |
| **T1** · draft *broadcast* | **Pasa** en Arch, en `power-saver` y en `balanced`. Latencia p95 de 26 a 30 ms (umbral ≤100). Con el cargador conectado, 60 FPS e intervalo p95 de 16,7 ms. Con batería y `power-saver`, 56,13 FPS y 21,3 ms: cumple, pero con poco margen. Sin pantallas en blanco. El modo de movimiento reducido anuncia el cierre en el primer fotograma. Es legible a 1280×720 | [S1](../research/spikes-2026-11/s1-broadcast-draft.md) |
| **T2** · tabla de 500 jugadores | **Pasa con virtualización** (60 FPS e intervalo p95 de 16,7 ms). Sin virtualizar **no cumple** (36–45 FPS, p95 de 50 ms). El foco siempre corresponde al jugador esperado | [S2](../research/spikes-2026-11/s2-dense-table.md) |
| **T3** · retoque de ritmo | **Pasa.** Un subagente `sonnet` con effort medium adelantó 150 ms el rótulo en ≈90 s, con una sola revisión (presupuesto: ≤30 min). T1 sigue en verde después del retoque. El usuario aceptó los vídeos de antes y después | [S1 · T3](../research/spikes-2026-11/s1-broadcast-draft.md#resultado-de-t3) |
| **T4** · determinismo | **Pasa.** Tres semillas y 182 hechos idénticos byte a byte en Arch, Ubuntu y Windows. Los comandos ilegales no consumen RNG | [S3](../research/spikes-2026-11/s3-deterministic-core.md) |
| **T5** · guardado interrumpido | **Pasa** en el AppImage de Arch y en el NSIS de Windows. Seis `SIGKILL` (antes y después de `COMMIT`) y tres semillas, con cero divergencias, cero jornadas parciales y cero hechos duplicados. La carrera cerrada en Linux se continuó en Windows | [S3/S7](../research/spikes-2026-11/s76-packaging-save.md) |
| **T6** · primer arranque sin red | **Pasa** en las pruebas automatizadas de Arch (perfil nuevo, sin red ni herramientas en el PATH) y de Windows (NSIS silencioso con el tráfico de salida bloqueado). La build B continuó la carrera de A en ambos sistemas. **Pendiente manual:** la instalación en máquinas limpias y el aviso de SmartScreen | [S3/S7](../research/spikes-2026-11/s76-packaging-save.md#checklist-manual--arch-y-windows-limpios) |
| **T7** · descarga reanudable | **Pasa** en Arch, en cuatro escenarios (conexión cortada, `SIGKILL`, parcial alterado y servidor sin `Range`), y en Windows con el escenario de conexión cortada. Ninguna caché incompleta se dio por válida. El draft ficticio siguió disponible sin red. El resultado final coincide byte a byte con una descarga íntegra | [S8](../research/spikes-2026-11/s77-resumable-download.md) |

**Equipo de medición.** HP EliteBook 840 G8 con GPU integrada Intel Iris Xe (i915, Mesa 26.2.5), panel de 60 Hz, Arch con Hyprland y Wayland nativo. Es un equipo **por debajo** del «PC gaming medio» objetivo, así que los presupuestos de T1 y T2 se cumplieron en un caso desfavorable. Los presupuestos de GPU no se miden en Windows: el CI no tiene GPU real, y así lo aprobó el plan 03.

## Decisiones que salen de los spikes

- **La `DataTable` se virtualiza** con `@tanstack/react-virtual` ([#91](https://github.com/nbfrodri/riftlegends/issues/91)). Sin virtualizar, 500 filas no cumplen el presupuesto.
- **El ritmo de las escenas animadas se centraliza** en un módulo de parámetros que comparten la escena y su medidor, como `pacing.ts` en S1. Por eso T3 costó segundos y no minutos.
- **El AppImage usa el runtime estático** de electron-builder: el de por defecto exige `libfuse.so.2`, que no viene en Arch con FUSE 3.
- **Persistencia:** cada comando se guarda en una transacción `BEGIN IMMEDIATE` con su ordinal, el estado, ambos RNG, las cuatro versiones y los hechos con clave `(serie, posición)`. Usa `synchronous=FULL` y un reintento idempotente por ordinal. Es la base del plan de persistencia.
- **Caché de contenido:** se descarga a *staging*, cada archivo se verifica por tamaño y SHA-256, y la caché se activa con un `rename` atómico del directorio más un puntero escrito con `fsync`. La reanudación usa `Range` con `If-Range`. Data Dragon lo admite, con `Accept-Encoding: identity`.

## Pendiente y cómo se levanta

Nada de esto bloquea la Fase 2, pero sí la **primera release pública**:

| Pendiente | Qué hay que repetir |
| --- | --- |
| Instalación en un Windows y un Arch **limpios**, y el aviso real de **SmartScreen** | La checklist manual de T6 ([S3/S7](../research/spikes-2026-11/s76-packaging-save.md#checklist-manual--arch-y-windows-limpios)) con los paquetes A y B |
| **T1 en un Windows con GPU** (riesgo aceptado en el plan 03) | El mismo ensayo de T1 a mano, antes de la primera release |
| Margen de T1 **con batería** (56 FPS frente al umbral de 55) | Repetir T1 con batería cuando exista la escena real de draft. Si baja de 55, reducir el coste de la capa PixiJS |
| **Manifiesto de hashes** de Data Dragon: decidir si se genera al empaquetar o se publica con la release, y cómo se firma | Plan de contenido |

## Consecuencias

- Los vectores de semillas, los logs esperados y los puntos de corte de S3 y S7 pasan como casos de aceptación a los planes 04 y 05 y al de persistencia. El código de los spikes no se fusiona: queda en las ramas `spike/*` hasta que esos planes lo hayan aprovechado, y después se archiva como tags `archive/spike-*`.
- Los workflows temporales `spike-goldens.yml` y `spike-packaging.yml` solo existen en esas ramas. El CI de `main` no cambia.
