# Sistema de UI (Rovaq) — primitivos compartidos

Fuente de verdad de estilo: `ESTILO-ELEGIDO.md` (carpeta diseno-panel). CSS de los primitivos: `apps/web/src/components/ui/ui.css` (se carga después de `app/ui.css`). Contrato verificable: `apps/web/tests/sistema-ui.test.mjs` y detector visual `apps/web/tests/ui/choques.mjs`.

## Reglas de oro
- Los componentes se rigen SOLO por sus clases. Las reglas globales de `globals.css`/`app/ui.css` que afectan a elementos desnudos (`button`, `nav ul`, `p:first-of-type`, enlaces en prosa) son de especificidad 0 (`:where`) y se desactivan con la clase marcador `ui-reset`.
- Medidas: página 24 px · gap entre bloques 12 px (`--ui-rhythm`) · tarjeta padding 14 (`--ui-pad`) · radios 8 controles / 12 tarjetas / 999 chips (y 50 %) · H1 20/600 · titular narrativo ≤18 · H2 14/600 · cuerpo 13 · etiquetas 11–12 (11 solo MAYÚSCULAS) · cifra KPI 26/700 (tope 30) · fila de tabla 40, cabecera 32 · filtros 32 (`--ui-ctl-h`).
- Hover nunca rojo. Rojo solo = requiere acción / pérdida. El color nunca es la única señal.

## Primitivos (`components/ui/`)
| Componente | Props |
|---|---|
| `PageHeader` (page-header.tsx) | `title`, `eyebrow?`, `description?`, `actions?` (siempre a la derecha, una fila), `guide?`, `nivel?` |
| `FilterBar` + `FilterSpacer` (filter-bar.tsx) | `label?`, `children`. Una línea (nowrap, scroll horizontal), controles 32 px. Selects/segmentos/chips/botones directos |
| `Chip` / `ChipList` (chip.tsx) | `Chip{tone?: neutral/ok/warn/bad/info, categoria?: 1..8 (color suave), onRemove?, removeLabel?}`; `ChipList{items?|children,label?}` envuelve sin recortar |
| `Notice` (notice.tsx) | `tone: info/warn/error`, `title?`, `children`, `actions?`; margen 12/12 (0 en extremos) |
| `Card`, `Section`, `Stack` (card.tsx) | `Card{title?,description?,actions?,bare?,as?}`; `Section` = Card sin caja; `Stack{gap}` ritmo vertical |
| `KpiStrip` (kpi-strip.tsx) | `items:[{label,value,note?,c?: 1..8 acento,spark?: number[]}]` o hijos `StatCard` |
| `DataTable` (data-table.tsx) | `columns:[{key,header,render,align?: 'num',width?}]`, `rows`, `rowKey`, `caption`, `state?: ready/loading/error`, `onRetry?`, `empty?`, `maxHeight?` |
| `EmptyState` / `ErrorState` / `Loading` | `EmptyState{art,title,body,action}`; `ErrorState{title?,body?,onRetry?,retryLabel?,busy?}` con botón «Reintentar» visible; `Loading{compact?,message?}` = solo logo animado |
| `ScopeBar` (workspace/scope-bar.tsx) | `Este mes · 30 días · 90 días · 12 meses · Personalizado · Filtros` en una línea; Personalizado abre el cajón de Filtros |

## Gráficas pequeñas (`mini-charts.tsx`)
`BarraApilada`, `DonaMini` (≤5 categorías, lanza error si más), `BarrasAgrupadas`, `AreaComparativa`, `TreemapSimple`, `Bullet`, `rampa()` (heatmap de un matiz) y `Sparkline{color?: 1..8}`. Estados: parcial = trama, estimado = discontinuo, desconocido = punteado vacío (nunca cero). Cada una: `aria-label`, tabla equivalente `sr-only`, `<title>` como tooltip, animación ≤600 ms con `prefers-reduced-motion`.

## Paleta de datos
`--chart-1..8` (sólido), `--soft-1..8` (tinte 12 %), `--ink-1..8` (texto oscurecido ≥4,5:1 sobre el tinte). Orden fijo: 1 azul, 2 naranja, 3 verde, 4 ocre, 5 petróleo, 6 burdeos, 7 violeta, 8 tinta (neutro). Asignación por métrica: `--metric-ingreso`(1) `--metric-reembolsos`(2) `--metric-atorado`(4) `--metric-respuestas`(5) `--metric-problemas`(7) `--metric-geografia`(3) `--metric-recomendaciones`(6). Estados ok/aviso/error usan `--tint-*`/`--ink-*` (no son matices de categoría).

Validación (`validate_palette.js`, skill dataviz, 7 matices): claro (superficie #fff) TODO PASA; WARN: CVD adyacente 7,2 (verde↔naranja, protan) y ocre 2,25:1 sobre blanco → relieve: etiqueta visible + tabla equivalente. Oscuro (#17171a) TODO PASA; WARN CVD 7,3 (ocre↔verde). Ajustes respecto del acuerdo: petróleo #1B6A7A→#0A84A6 (croma), burdeos #8C1D3A→#A6264A (luminosidad); en oscuro versiones aclaradas. La tinta (#0E0E10) queda fuera del validador (neutro estructural).
