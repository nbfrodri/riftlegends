# S3 y S7 · Recuperación del guardado e instalación

**T5 pasa en el AppImage de Arch y en el NSIS de Windows con `node:sqlite` (SQLite 3.54.1 en ambos).** Seis terminaciones forzosas por sistema, tres semillas y cero divergencias en estado, RNG o hechos. La carrera cerrada en Linux se leyó y se continuó en Windows. **T6 pasa en las pruebas automatizadas de Arch y de Windows.** La compilación B recuperó el turno 20 de A y terminó la Bo3 sin red en los dos sistemas. Quedan pendientes, como prueba manual, la instalación en dos máquinas limpias y el aviso de SmartScreen.

Issue #76 · 20-11-2026 · Rama desechable `spike/76-packaging-save`. Fuentes medidas en `f6e0dbc9dacfb247bc3da35083511055c4b43ab2`, sobre S3 `889b1f70a040d886f8c3e2553ca2b2e5adcb8306`. El paquete usa una pantalla de prueba con un botón para confirmar el turno automático de S3. El IPC, el esquema y esa pantalla quedan como referencia en la rama. [Plan y criterios de descarte](../../plans/03-spikes.md) · [Contrato entregado por S3](s3-deterministic-core.md#entrega-a-persistencia-76)

## Resultados frente al umbral

| Prueba | Umbral | Observación | Veredicto |
| --- | --- | --- | --- |
| T5 · Arch, corte antes de confirmar | Recuperar la jornada anterior íntegra en las tres semillas | 3/3 reabrieron en turno 19, 21 hechos. El reintento escribió los tres hechos del cierre de partida una sola vez. | Pasa |
| T5 · Arch, corte después de confirmar y antes de responder | Recuperar la jornada nueva íntegra y admitir el mismo reintento | 3/3 reabrieron en turno 20, 24 hechos. Repetir el ordinal 20 conservó los mismos bytes. | Pasa |
| T5 · Arch, final tras ambos cortes | Tres semillas, cero jornadas parciales, duplicados o divergencias | Los seis finales coincidieron con su control ininterrumpido, incluidos ambos RNG y cada byte del log golden. | Pasa |
| T5 · NSIS instalado en Windows | Mismos cortes y comparaciones con el driver cargado dentro del paquete | Run [44809729205](https://github.com/nbfrodri/riftlegends/actions/runs/44809729205), Windows Server 10.0.26100: `node:sqlite` con SQLite 3.54.1 en un proceso `utility` (Electron 45.4.1, Node 24.22.3). Por cada semilla, las variantes sin corte, con corte antes y con corte después dan el mismo SHA-256 de estado y de log y los mismos RNG, y coinciden con los de Linux. | Pasa |
| T5 · Carrera cerrada Linux → Windows | Leer la Bo3 cerrada y continuar la misma carrera en el otro SO | Fixture de 16 KiB producido por A en Linux. El ensayo local con B conservó los 68 hechos de la serie 75 y añadió una serie 76 de 68 hechos al mismo archivo. En Windows, B leyó los 68 hechos originales y añadió los 68 de la serie 76, con versión de escritura `0.76.2`. | Pasa |
| T6 · Arch, primer arranque y reapertura | Completar un draft sin caché, red ni herramientas de desarrollo en el PATH y reabrirlo | 20 confirmaciones desde la ventana de A. Al volver a abrirla, estado, marcador, versiones y hechos coincidieron con el último guardado. | Pasa |
| T6 · Arch, B sobre A | Leer la carrera de A y seguir jugando en B | Reemplazo del archivo AppImage en la misma ruta. B abrió el turno 20 y confirmó los 40 restantes hasta el 2–1 de Sable Choir. | Pasa |
| T6 · Windows, NSIS A y B | Instalar A, completar y reabrir el draft, instalar B encima y continuar | Job con instalación silenciosa, bloqueo de salida del ejecutable y PATH de sistema. Con salida bloqueada y PATH de sistema, A creó y reabrió el turno 20 y B, instalado encima, terminó la serie. Tamaños y hashes en la tabla de paquetes. | Pasa |
| T6 · Instalación limpia y SmartScreen | Primer uso offline reproducible en Arch y Windows sin herramientas ni cachés previas | Arch físico usa un perfil nuevo. El runner Windows tiene herramientas de compilación. Las máquinas limpias y el aviso real de SmartScreen requieren la prueba al pie. | Pendiente manual |

Una divergencia o una jornada parcial bloquea el avance del núcleo. Una instalación dependiente de herramientas de desarrollo o una carrera anterior ilegible bloquea la distribución. Solo queda pendiente la prueba manual en máquinas limpias. [ADR 0003](../../decisions/0003-go-no-go-fase1.md)

## Entorno y paquetes medidos

| Componente | Medida |
| --- | --- |
| Equipo | HP EliteBook 840 G8, Intel Core i7-1185G7, 8 CPU lógicas, 16.038.876 KiB de RAM |
| Gráficos | Intel Iris Xe TigerLake-LP GT2, PCI 8086:9a49, i915, Mesa 1:26.2.5-1 |
| Sistema | Omarchy 4.5.0 sobre Arch x86_64, Linux 7.2.15-1-omarchy, Hyprland 0.56.2-4, Wayland y FUSE 3.18.3 |
| Construcción | Node 26.13.1 y pnpm 12.22.0 mediante mise, Vite 8.3.8, electron-builder 26.18.0, toolset AppImage estático 1.0.3 |
| Ejecución | Electron 45.4.1, Node embebido 24.22.3, SQLite 3.54.1 vía `node:sqlite` en proceso de tipo `utility`, pure-rand 8.4.2 |
| Contenido | Sable Choir, Copper Wake y los 24 campeones ficticios de S3, empaquetados con el núcleo |

| Paquete x64 | Bytes | SHA-256 del archivo medido |
| --- | ---: | --- |
| RiftLegends-0.76.1.AppImage (A) | 117.835.113 | `3b0da12ae4f602a590e4d5616b875297d6b505b37ef589f3457e7ef0822056db` |
| RiftLegends-0.76.2.AppImage (B) | 117.835.143 | `6097b5cba3a6167effdb5cf2f8938ca02148b1e641e93b6776a5e9c1e107f776` |
| RiftLegends-0.76.1.exe (NSIS A) | 120.481.621 | `6a110f955846ddd08947f5231f4d6d89cf764cf2c7d440029d64ee3a6b450536` |
| RiftLegends-0.76.2.exe (NSIS B) | 120.481.629 | `c3312172ecdd681310f31f0a66b8d024c57ef259af84db1cebd00ae1284782dc` |

## Protocolo de recuperación

Cada carrera tiene un SQLite. El escritor abre `DatabaseSync` en el `utilityProcess`. Un comando de turno automático se identifica por serie y ordinal. Un ordinal ya confirmado devuelve el guardado existente. Un salto hacia delante se rechaza. Dentro de `BEGIN IMMEDIATE` el escritor guarda el ordinal, el estado con las cuatro palabras de cada RNG, las cuatro versiones y los hechos nuevos. El historial usa inserciones con clave primaria `(series, position)`, desde cero. La lectura comprueba la continuidad de posiciones. Se usó diario `DELETE` y `synchronous=FULL`. [Escritor SQLite](https://github.com/nbfrodri/riftlegends/blob/spike/76-packaging-save/apps/desktop/spike76/writer.cjs)

Para cada semilla se crean tres archivos independientes. El control completa la serie sin interrupciones. En los otros dos, el comando 20 acepta la selección, decide la primera partida y abre la siguiente. El escritor se detiene tras los cambios SQL, justo antes de `COMMIT`, o tras volver de `COMMIT` y antes de enviar el resultado. El padre recibe únicamente la señal del punto de corte, termina ese PID con `SIGKILL` y espera su salida. En Linux los seis códigos de salida fueron 9. Otro escritor abre el archivo, lee el estado antes del reintento y recibe el mismo comando. La comparación incluye el snapshot recuperado y el posterior al reintento, además del final. [Control del proceso](https://github.com/nbfrodri/riftlegends/blob/spike/76-packaging-save/apps/desktop/spike76/client.cjs) · [Ensayo](https://github.com/nbfrodri/riftlegends/blob/spike/76-packaging-save/apps/desktop/spike76/checks.cjs)

| Semilla de la serie 75 | Turnos hasta el cierre | Hechos finales | Bytes UTF-8 del log | Finales recuperados idénticos |
| ---: | ---: | ---: | ---: | ---: |
| 0 | 40 | 46 | 1.704 | 2/2 |
| 2 | 60 | 68 | 2.526 | 2/2 |
| 4294967295 | 60 | 68 | 2.534 | 2/2 |

La comparación directa se hizo sobre los bytes JSON del estado y de sus RNG, y sobre el log canónico de hechos con LF final. El control de cada semilla también se cotejó con el golden de S3. Las muestras adjuntas contienen los PID, ordinales y número de hechos recuperados, RNG completos, tamaños y SHA-256, y los snapshots antes y después de las tres aperturas de T6. [Muestras de Arch](s76-linux-samples.json)

El fixture es el archivo cerrado del control con semilla 2, serie 75. SHA-256 `8834d7e319d53553ad4475cc3a4fb2e604b3a5df787249a32d867428d19222ac`. Una lectura independiente con SQLite devolvió `integrity_check=ok`, cero infracciones de claves foráneas, 68 hechos distintos en posiciones 0–67 y versiones `0.76.1 / s3-catalog-1 / s3-sim-1 / 1`. El job Windows verifica el hash, trabaja sobre una copia, comprueba el log completo contra el golden, termina la siguiente Bo3 y vuelve a leer la primera. [Carrera Linux](s76-linux.career)

## Reproducción en Arch

Ejecutar desde la raíz, dentro de una sesión Wayland. Los AppImage quedan en `release/0.76.1/` y `release/0.76.2/`. El script imprime el directorio temporal de la ejecución, con archivos SQLite, JSON y logs.

```sh
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- node apps/desktop/spike76/build.mjs 0.76.1
mise exec -- node apps/desktop/spike76/build.mjs 0.76.2
bash apps/desktop/spike76/linux-smoke.sh
mise exec -- pnpm verify
mise exec -- pnpm e2e
```

El script parte de HOME y directorios XDG nuevos y pasa a Electron un PATH limitado a utilidades del sistema. Conserva acceso al socket de Wayland. `unshare -rn` hizo que Chromium viera UID 0 y rechazara el arranque. Con `unshare -cn` se mantuvo el UID del usuario y el proceso informó de cero interfaces con dirección en las cinco aperturas. El smoke pulsa el botón de la ventana, espera su actualización tras cada guardado y arranca un proceso nuevo para la reapertura y otro tras sustituir el paquete. [Script de Linux](https://github.com/nbfrodri/riftlegends/blob/spike/76-packaging-save/apps/desktop/spike76/linux-smoke.sh)

**Incidencias de empaquetado.** La sonda inicial del AppImage por defecto exigía `libfuse.so.2`, ausente en este Arch. Su modo integrado `--appimage-extract-and-run` permitió validar el driver dentro del primer paquete. Para A y B se fijó el runtime estático 1.0.3. A arrancó por montaje normal en el host y completó los veinte turnos con otro perfil nuevo. En el espacio de nombres aislado, el runtime siguió sin encontrar un `fusermount` utilizable. Allí se ejecutaron ambos AppImage con su opción integrada de extracción. Son dos mediciones separadas. Los avisos de D-Bus y Vulkan en Wayland aparecieron en stderr y los cinco procesos completaron sus comprobaciones.

Electron abrió el escritor directamente desde `app.asar` (33.323 bytes en A). El empaquetado no necesitó `asarUnpack`, módulos `.node` externos ni recompilación para el ABI de Electron. Se desactivó el script de instalación de `electron-winstaller`, dependencia transitiva de Squirrel ajena al destino NSIS. La instalación congelada pasó la política de antigüedad vigente. En Arch pasaron Biome, tipos, 143 tests y 19 E2E. Se omitió el E2E exclusivo de maximizar la ventana en Windows. ShellCheck y actionlint 1.7.12 pasaron.

## Evidencia de Windows

Las muestras de Windows están en [s76-windows-samples.json](s76-windows-samples.json), sin las direcciones de red del runner. Para repetir la medición, abrir **Spike packaging → nsis** para el SHA publicado. El job compila ambos instaladores, instala A con `/S /currentuser /D=…`, ejecuta los modos `create`, `reopen` y `recovery`, instala B en el mismo directorio y ejecuta `upgrade` y `cross`. La regla temporal de firewall bloquea el tráfico saliente del ejecutable del juego y el PATH del juego contiene solo directorios de Windows. Se usa un perfil de juego nuevo. [Workflow](https://github.com/nbfrodri/riftlegends/blob/spike/76-packaging-save/.github/workflows/spike-packaging.yml) · [Script de Windows](https://github.com/nbfrodri/riftlegends/blob/spike/76-packaging-save/apps/desktop/spike76/windows-smoke.ps1)

Del artefacto `nsis-and-evidence-<SHA>`, conservar los dos EXE, `packages.csv` y los cinco JSON. En `recovery.json` deben figurar las nueve muestras, los seis cortes y los mismos hashes Linux por semilla. En `cross.json` se esperan 68 hechos originales, 68 en la siguiente serie y versión de escritura `0.76.2`. Un fallo de instalación deja la medición posterior pendiente. Una divergencia en una comparación ejecutada da **falla** a esa prueba. Añadir al resultado el enlace al job, los tamaños y la versión de SQLite observada en Windows.

## Checklist manual · Arch y Windows limpios

1. Usar una instalación limpia o instantánea nueva de cada SO, con sesión gráfica, usuario ordinario y sin Node, pnpm, Git ni herramientas de compilación. Anotar SO, versión y SHA de la rama. Preparar A y B, verificar sus SHA-256 y desconectar la red antes de instalar o abrir A. En Windows descargar los artefactos con el navegador y conservar la marca de procedencia de Internet al extraer los EXE para observar SmartScreen.
2. En Arch, marcar A como ejecutable y abrir el AppImage normalmente, sin opciones. En Windows, abrir el NSIS A con doble clic, instalar para el usuario y abrir el juego. Anotar el texto exacto de SmartScreen, editor, opciones y momento de aparición, o la ausencia de aviso. Si el sistema impide continuar, registrar el bloqueo.
3. Comprobar versión `0.76.1`, turno 0, Sable Choir y Copper Wake a 0–0. Pulsar **Confirmar siguiente turno** veinte veces. Deben aparecer veinte vetos y selecciones con campeones ficticios, turno 20 y marcador 0–1. Cerrar la ventana, volver a abrir A y comprobar el mismo turno, lista y marcador.
4. Cerrar A. En Arch, sustituir el AppImage por B en la misma ruta. En Windows, ejecutar el NSIS B sobre la instalación A con el mismo usuario y destino. Registrar de nuevo SmartScreen. Abrir B y comprobar `0.76.2`, turno 20 y marcador 0–1.
5. Confirmar los 40 turnos restantes. Debe aparecer **Serie terminada**, turno 60 y victoria de Sable Choir por 2–1. Cerrar y volver a abrir B para comprobar que conserva el resultado. Registrar por SO si hizo falta red, caché previa o herramientas, adjuntar las capturas del resultado o del fallo y anotar **pasa** o **falla**. SmartScreen queda **pendiente** hasta observar los instaladores en Windows.
