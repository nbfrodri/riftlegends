# Capturas de lolesports.com

Respuesta del 22-11-2026 de la API web pública de lolesports.com, recortada a diez equipos que cubren los casos de la correspondencia: activo y archivado con el mismo código, equipo filial, alias (Team Liquid) y un logo SVG. Se vació `players`.

| Archivo | Endpoint |
| --- | --- |
| [getTeams.json](getTeams.json) | `https://esports-api.lolesports.com/persisted/gw/getTeams?hl=en-US` |

La cabecera `x-api-key` es la **clave pública que la propia web de lolesports.com publica** en su código; identifica a la web, no a una persona, y no es un secreto. El uso en el pipeline de datos (solo en desarrollo y CI, nunca en la app) está autorizado por el propietario del proyecto desde el 22-11-2026. Las peticiones llevan `User-Agent: RiftLegendsDataPipeline/0.1`, van de una en una con 1 s de pausa y no siguen redirects.

Los logos son marcas de Riot Games y de los equipos: no se commitean; el pipeline solo guarda su URL, SHA-256, tamaño y tipo.
