# Copiloto de negocio (modo copiloto)

Una pantalla de área (CFO, Fuga de reembolsos, y después Brechas de ingreso, Mapa de problemas, Carga y SLA) se abre con el **shell de «Pregúntale a tus datos»**
(mismo menú lateral, sin encabezado de página ni barra superior, partículas, compositor, historial deslizante, «pensando» con traza, respuestas con cifras, tablas, gráficas,
reporte y adjuntos) pero su portada es un **briefing estructurado del área**, pintado como primer bloque del chat y **sin llamar a ningún modelo**.
Tras la primera pregunta el briefing se oculta detrás de «Ver el informe de …» y el hilo ocupa la pantalla.

## Piezas

| Archivo | Qué hace |
|---|---|
| `apps/web/src/lib/copiloto/modos.mjs` | Registro de modos + `esRutaCopiloto`, `puedeUsarModo`, `textoSoloPara`, `problemasDeModo` (puro). |
| `apps/web/src/components/copiloto/copiloto-negocio.tsx` | `<CopilotoNegocio modo="cfo" query roleOverride organization/>`: carga el estado del agente, el informe del modo, el presupuesto y arma el `Chat` del agente con la portada del modo. |
| `apps/web/src/components/agente/agente.tsx` | `Chat` acepta `modo?: ModoChat` = `{modo, runner?, placeholder?, portada(ask, hayHilo), pie?}`. |
| `apps/web/src/components/agente/use-agente.ts` | `useAgente(..., {runner, modo})`: transporte intercambiable; cada mensaje guarda `modo`. |
| `apps/web/src/components/copiloto/adaptador-cfo.mjs` | Respuesta del motor de CFO → `Answer` del agente (mismos componentes de respuesta); `esPreguntaDeCfo` decide la delegación al agente general. |
| `apps/web/src/components/copiloto/briefing-cfo.mjs/.tsx`, `serie-negocio.tsx` | Briefing de CFO (datos puros + vista) y gráfica de 12 meses. |
| `apps/web/src/components/copiloto/copiloto.css` | Estilos `cn-*` con los tokens de la marca. |

## Contrato de un modo (`modos.mjs`)

```js
{
  clave: 'gaps',                       // estable; también sufija el historial local (<scope>-<clave>)
  ruta: '/gaps',                       // ruta del menú que abre el modo
  titulo: 'Brechas de ingreso', subtitulo: '…',
  rolesPermitidos: ['owner', 'analyst'],   // otros reciben «Esta área es solo para …»; el servidor sigue dando 403
  briefing: 'gaps',                    // clave de briefing que resuelve copiloto-negocio.tsx
  chipsPorTema: [{titulo: 'Resultados', preguntas: ['…']}],
  directas: {'¿…?': {tool: 'x', args: {}}},  // consultas sin modelo ni costo; toda directa debe tener su chip
  consulta: 'agente' | 'cfo',          // 'agente' = /api/agent/turn (herramientas del agente general); 'cfo' = motor propio
  endpointDeConsulta: '/api/agent/turn',
  endpointInforme: '/api/…' | null,
  presupuesto: {mostrar: false, topeUsd: 0},   // «Uso del mes» solo si el motor lo expone
  informeCompleto: '/gaps?vista=informe' | null,
}
```

### Cómo enchufar /gaps, /map y /workload (sin duplicar su pantalla)

1. Añade el modo a `MODOS` (la prueba `tests/copiloto-modos.test.mjs` valida la forma con `problemasDeModo`). `RUTAS_COPILOTO` y por tanto `sinEncabezado` del shell se actualizan solos.
2. Dale a la pantalla existente una prop `embebido` (como `FugaPantalla`): sin `PageHeader`, con **un solo `h1`** (el titular) y su botón «Actualizar» dentro del encabezado.
3. En `copiloto-negocio.tsx`, `cuerpoBriefing()`: `if (modo.briefing === 'gaps') return <GapsPantalla embebido …/>`.
4. En `app/(workspace)/<ruta>/page.tsx`: comprobar rol en servidor y devolver `<CopilotoNegocio modo="gaps"/>` o `<AreaRestringida modo={MODOS.gaps}/>`.
5. Si el área tiene motor propio (como CFO) usa `consulta: 'cfo'`-style: un `runner` que llame a su endpoint, un adaptador a `Answer` y, si la pregunta no es del área, `runTurn` (agente general) con una nota «no es de …».
6. Conserva la seguridad: bitácora antes de leer, roles en servidor, nada de PII, el alcance del corte (periodo, moneda, base) en la URL.

## Seguridad y honestidad

- CFO: `/cfo/data/copilot` conserva su bitácora fail-closed (`cfo_access_log`), presupuesto mensual (US$ 25) y 403 para quien no sea owner/analyst.
- El cuerpo hacia el motor jamás lleva organización ni rol; la organización sale de la sesión.
- Observado / Estimado / Inferido en cada cifra; «No disponible» nunca es 0; los meses parciales se dicen en una línea; USD, CAD y MXN no se suman.
- El informe clásico sigue en `/cfo?vista=informe` (enlace «Ver informe completo» y «Ver detalle» por sección, con ancla). `/cfo/data/report` y `/cfo/data/export` no cambian.
