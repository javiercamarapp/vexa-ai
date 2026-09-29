# F07-05 — preparación técnica del piloto integrada

La herramienta offline para evaluar observaciones del piloto está implementada, revisada independientemente e integrada. **Cuenta como una tarea técnicamente preparada con aportes externos pendientes:54/60 técnicas;25 aceptadas formalmente.** El piloto humano sigue `not_run`; producción y aceptación formal siguen `false`. No se cambió el resultado humano ni el grafo para sumar este punto.

## Comportamiento y uso

[La guía completa](../packages/intelligence/evaluation/PILOT.md) incluye el esquema, un ejemplo SYN completo y comandos. `pilot-cli.mjs` consume el resultado y recibo reales del evaluador F04, verifica sus hashes y vínculo con el candidato/holdout, y agrega comprensión humana del CEO, insight nuevo, acción con sponsor y disposición a pagar. No requiere programación adicional para consumir esas observaciones autorizadas.

El cálculo conserva todos los elegibles en el denominador, separa ausentes, mide comprensión en menos de300segundos y conserva dinero exacto por moneda/exponente: desconocido no es cero. Consentimiento previo, fechas, duplicados, sponsor y procedencia estructural se validan. Entradas privadas de sólo lectura, errores saneados, salidas exclusivas0700/0600 y recibos con hashes; sin red ni inferencia. Los datos sintéticos nunca producen métricas humanas medidas. Declarar `human` no demuestra autenticidad ni representatividad.

## Evidencia reproducible

Baseline `c8353256b91fc83ff089080136ff7c4e736b61ff`. Autor399 y revisor400 trabajaron en copias disjuntas; principal integró exactamente las tres fuentes congeladas. Node22.23.2.

- Principal:25controles externos congelados antes de la entrega;25/25 contra autor y25/25 desde sus rutas públicas tras integrar. Dominio21 y CLI4, incluyendo la cadena F04 real, bytes/hashes, archivo modificado, permisos, no sobrescritura y ausencia de datos privados en agregados.
- Revisor400:21/21 controles propios, sin reintentos. Estado humano exacto `requires_human_review`, zonas horarias299/300segundos, identidad compartida CEO/comprador, suma9007199254741000, desconocidos y cuatro rechazos CLI independientes. Dictamen `APPROVED_SCOPED`, sin programación pendiente identificada.
- Autor: tres controles adicionales sobre la CLI final: cadena F04→piloto, un único ganador al competir por salida y modificación de entrada rechazada con `INPUT_CHANGED` antes de crear salida. Tras ajuste de etiqueta del diagnóstico SYN, focal afectado aprobado; no se atribuye la primera corrida25 al cambio posterior.
- Principal: procedimiento literal de `PILOT.md` en la integración canónica, cambiando únicamente el vínculo por un recibo F04 SYN congelado real. Cuatro diagnósticos1/2, USD15000minor exactos; métricas humanas principalesnull, estado `not_measured`, sin aceptación ni producción.

```sh
VEXA_CANDIDATE="$PWD" node --test support/F07-pilot/*.test.mjs
```

Regresión general `npm test`: kernel y fundación aprobados después de corregir cinco entradas desactualizadas del registro de disponibilidad de gates (F05-02..06 figuraban como ausentes aunque sus archivos ya existían). El fallo inicial queda conservado. No se modificaron pruebas, grafo, `product_pass` ni aceptación de tareas; la corrección se guarda en commit separado. `guide.py audit`:60fichas, cero errores estructurales,51gates disponibles; el gate formal F07-05 continúa ausente.

Estos controles técnicos reproducibles no sustituyen el gate oficial faltante ni la validación humana de F07-05. No se repitieron buildNext, carga210K ni smokeweb: este cambio sólo agrega una herramienta offline, sin importar sus módulos desde la aplicación. El inventario de fuentes pasa2089→2092; las mediciones históricas conservan su fuente original.

| Artefacto | SHA256 |
|---|---|
| pilot.mjs | `493f6955ebefbfdb837bcbab50695bfae6bbbb0cc01ef1d15088391cbfaf0b17` |
| pilot-cli.mjs | `efee7af320375d5be50058838099e5d03bec39b0a9a03aac42f5d6d38894bd03` |
| PILOT.md | `878c57e1c4290eae0b3366f128a64a78ab7c164fe2f96853dec4d8914c7f23ac` |
| Manifiesto privado autor399,24archivos | `ed2bc08f63227ea4e26d542a6586a72916438acaa4a030866ff97dc4343808e1` |
| Manifiesto privado revisor400,15archivos | `905360b0997b9215375222046198f4bc9374814ef01fe0dbf570a4bfc5be2642` |
| Contrato/controles principales congelados | `de02d354c73bfde65f7301bb030007903f8044aa83cc46051f87e1989ec9d1b7` |
| Controles CLI principales congelados | `0a847eeb16fd2ed2ba3c392d11fe982f3f90011155ab807b72e375f4d9b7d957` |

Las fuentes F04 permanecen idénticas. [pilot-evaluation.json](../docs/blueprint/pilot-evaluation.json) conserva SHA256 `87985978e41bf5f2da10fd80040e4c2f6983aab2c7dd7e50a607aa8463aba5f0`, estado `not_run`, métricasnull y ningún incremento propio por esa plantilla histórica.

## Aportes externos y aceptación pendiente

El responsable del cliente debe reunir consentimiento legítimo, gold humano y holdout independiente, participantes, cronometraje real de comprensión, respuestas de insight/acción/WTP y sponsor. El custodio ejecuta el flujo y un revisor humano comprueba autenticidad, representatividad y decisiones comerciales. Son actos humanos: pegar una API no valida este piloto. La dependencia formal F07-04 y el gate oficial siguen pendientes. No se establece ahorro causal ni ingresos contratados.

El revisor independiente evaluó expresamente la elegibilidad del contador según su definición vigente y la condicionó a integración y prueba del principal, ambas completadas. Se registra `technical_ready_external_pending`; no `accepted` en el grafo. Permanecen seis fichas sin cierre técnico: F06-07, F06-09, F06-10, F06-11, F06-12 y F07-01. La restricción de revisión de entrega y sus dependencias no se eludió.
