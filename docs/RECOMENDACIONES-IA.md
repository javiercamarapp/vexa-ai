# Recomendaciones con IA anclada en evidencia (diseño R4)

Estado: **diseño + interfaz implementada detrás de una bandera apagada**. No se llama a ningún modelo, no hay gasto y no hay credenciales. Las pruebas usan un cliente simulado.

## Qué pidió Responsable A

Una IA «experta en la industria» (herramientas eléctricas y posventa e-commerce) que dé las mejores recomendaciones con toda la información. Hoy el generador es de reglas (`conditioned-rules-v2`). La IA no reemplaza al responsable: **solo un humano aprueba** (Proceder / Ajustar / Descartar); la ejecución automática es V2.

## Dónde vive

| Pieza | Archivo |
|---|---|
| Interfaz, prompt, esquema, verificación, costo | `packages/recommendations/ia.mjs` |
| Pruebas con cliente simulado | `packages/recommendations/tests/ia.test.mjs` |
| Bandera | `VEXA_RECS_AI` (solo `1` la enciende; por omisión apagada) |
| Presupuesto | `packages/agent-datos/budget.mjs` (`createAgentBudget`: reserva antes, liquida el costo real) |
| Verificación de cifras | `numbersIn` / `numbersGrounded` de `packages/agent-datos/contract.mjs` |

## Contrato

**Entrada** (`construirEntrada`): el problema (título y versión), el periodo, la moneda, las **cifras de `insight_*`** ya calculadas (`etiqueta`, `valor`, `valorMinor`, clase observado/estimado/inferido, cobertura) y **citas verificables ya enmascaradas** (categoría, rol, texto). Cada cifra y cita recibe un id estable (`c1…`, `q1…`). Todo texto pasa por `sinPII`. Sin cifras ni citas no se arma la entrada.

**Prompt de sistema** (`PROMPT_SISTEMA`): experto en posventa de herramientas eléctricas y e-commerce multicanal; usa solo las cifras recibidas, no afirma causalidad, no habla de margen ni utilidad, expresa el impacto solo en ingreso y solo si una cifra lo respalda, cita la evidencia por id y responde solo con JSON.

**Salida** (JSON estricto, `ESQUEMA_SALIDA`): `accion`, `porQue`, `evidencia[{ref,afirmacion}]`, `impactoIngreso{valorMinor|null,moneda,nota}`, `riesgos[]`, `supuestos[]`. Cualquier clave extra o faltante la rechaza.

## Verificación determinista (`verificarSalida`)

Se ejecuta en el servidor, nunca en el modelo. Rechaza si:

1. falta o sobra una clave, o un campo sale del largo permitido;
2. alguna cifra escrita en el texto **no existe en la entrada** (`cifra_no_respaldada`);
3. una referencia de evidencia no es un id de la entrada;
4. `impactoIngreso.valorMinor` no coincide con una cifra de ingreso de la entrada (`impacto_sin_cifra_de_ingreso`);
5. menciona margen o utilidad (CLIENTEX no comparte costos);
6. afirma causalidad («provocó», «demuestra que», «causa confirmada»).

Una salida rechazada **se cobra al costo real** (ya se gastó) y no se muestra como recomendación.

## Presupuesto y costo

- `estimarCosto(entrada)` da un **rango** en micro-USD (tarifa baja y alta) antes de llamar. Las tarifas incluidas son **supuestas** (`supuesta: true`) y deben confirmarse contra el catálogo del gateway antes de activar.
- `topeMinor` es el tope **por recomendación**: si el peor caso lo excede, no se llama.
- `reserve` por el peor caso → llamada → `settle` con el costo real. Si el costo real es desconocido o la llamada falla, se liquida el peor caso (nunca cero).
- El presupuesto del periodo lo fija Javier/Responsable A en el panel; este módulo no lo cambia.

## Cómo se conectaría (no hecho)

1. Confirmar con Responsable A la aprobación de gasto de IA para recomendaciones (R4 es P2, fase 2).
2. Implementar un `cliente` real sobre el gateway (`packages/gateway`) con modelo y tarifas del catálogo vigente.
3. Calcular las cifras `insight_*` por problema y pasarlas a `construirEntrada`.
4. Guardar la salida verificada como propuesta: requiere una versión nueva del generador (`ia-anclada-v1`) aceptada por `recommendation_managed_guard` (hoy solo acepta `conditioned-rules-v1/v2`), es decir, **una migración nueva**. La propuesta entra al mismo flujo humano (`proposed` → Proceder/Ajustar/Descartar).
5. Encender `VEXA_RECS_AI=1` solo después de un bake-off de calidad y costo con casos reales.

## Fuera de alcance de V1

Ejecución automática de acciones, envío de correos, escritura a marketplaces, estimaciones de ahorro o margen.
