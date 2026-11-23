# @rift-legends/ui-kit

Tokens, fuentes y componentes base del estilo **Caja** ([ADR 0002](../../docs/decisions/0002-estilo-visual.md)). Solo tema oscuro.

## Uso

```css
/* hoja de estilos del renderer */
@import "@rift-legends/ui-kit/styles.css";
```

```tsx
import { Button } from "@rift-legends/ui-kit/components/button";
import { cn } from "@rift-legends/ui-kit/lib/utils";
```

| Componente | Exporta | Notas |
| --- | --- | --- |
| `button` | `Button` (`variant`: `default` o `ghost`) | `default` es la acción principal de la vista (fondo de acción, texto `on-action`); `ghost` sirve para acciones secundarias y botones de solo icono, que necesitan `aria-label` |
| `tooltip` | `TooltipProvider`, `Tooltip` | El tooltip Caja (Base UI): `<Tooltip content heading? shortcut? side?>` envuelve al disparador. Es **solo visual**: el disparador conserva su nombre accesible. Un único `TooltipProvider` en la raíz de la ventana monta el popup que comparten todos los disparadores; arriba por defecto. Sustituye al `title` nativo, prohibido por un test |
| `kbd` | `Kbd` | Atajos (`Alt+B`), en Archivo con cifras tabulares |
| `select` | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` | Pasa `items` a `Select` para que `SelectValue` muestre la etiqueta y no el valor. Las opciones deshabilitadas se pueden enfocar, pero no elegir |
| `data-table` | `DataTable`, `DataTableColumn` | Tabla densa sobre TanStack Table: ordena con clic o Enter/Espacio en la cabecera (`aria-sort`; ascendente, descendente, sin orden), filtra por texto sin distinguir mayúsculas ni acentos, y mueve el foco entre filas con flechas, Inicio y Fin (un solo tabulador para el cuerpo). Cabecera fija con scroll vertical propio. Solo monta las filas cercanas a la ventana de visión (TanStack Virtual; la fila activa siempre está montada y `aria-rowcount`/`aria-rowindex` describen la tabla completa). Las columnas `numeric` alinean a la derecha con cifras tabulares. Todos los textos llegan por props (`filterLabel`, `emptyText`, `countLabel`…): el consumidor los traduce y formatea los valores de `cell` con `Intl` |
| `champion-face` | `ChampionFace` (`size`: `pool`, `role` o `compact`) | Retrato si recibe `src`; si no, o si la imagen falla, iniciales con un tono estable derivado del id, sin cambiar el tamaño. `unavailable` lo pone gris con una raya diagonal. Sin `label` queda oculto a los lectores de pantalla: úsalo cuando el nombre ya está al lado |
| `scroll-area` | `ScrollArea` | Desplazamiento vertical con barra fina. Para nombrar la región, usa `viewportProps` (`role` y `aria-label`) |

## Reglas

- Los componentes se añaden con la CLI de shadcn desde este paquete (`pnpm dlx shadcn@4.23.0 add <nombre>`) y se re-estilan antes del commit: solo colores de `tokens.css`, sin variantes `dark:` (lo vigila `test/palette.test.ts`).
- La CSP del renderer (`style-src 'self'`) bloquea los `<style>` que inyectan algunas piezas de Base UI. `select` y `scroll-area` los desactivan con `CSPProvider disableStyleElements` y aplican el estilo con clases; haz lo mismo en cualquier componente nuevo que los use.
- `cn` conoce las escalas propias de Caja (`text-table`, `rounded-control`, `tracking-*`, `gutter`, `gap`, `ease-lock`); si se añade una escala a `tokens.css`, añádela también en `lib/utils.ts`.
- Tests de comportamiento con Testing Library (por rol y nombre accesible) en `test/*.test.tsx`, con happy-dom.
