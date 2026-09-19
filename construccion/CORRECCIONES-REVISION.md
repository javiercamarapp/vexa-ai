# Correcciones posteriores a la revisión adversarial

Los tres hallazgos iniciales fueron **correctos**. El reporte original se conserva, no se reescribe para ocultar su veredicto. Esta es la respuesta del implementador; la nueva revisión se registra por separado.

| Hallazgo | Reproducción previa observada | Corrección |
|---|---|---|
| H1 P1: verified rechazado queda sin camino | accept/verify/prepare/recover no permitían corregir; nuevo test fallaba por acción reject inexistente | `reject`, sólo verified, exige STOP/nota/checkout limpio/gate/dependencias; archiva recibo y abre dos intentos nuevos. Conserva candidato anterior y nunca acepta. |
| H2 P1: worker acepta artefacto ignorado no promovido | El gate pasaba leyendo .scratch mientras baseline seguía bad. Tres regresiones rojas: ignorado generado, añadido después y mutación de modo durante gate | Worker rechaza ignorados/symlinks, captura firma completa de contenido/modos y la conserva; accept verifica firma incluso fuera del camino interactivo. Recibo antiguo sin firma exige rechazo y nueva verificación. |
| H3 P2: recuperación sobrescribe evidencia | Logs del intento 1 cambiaban al recuperar; se conservaban sólo dos worker logs donde debía haber tres | Nombres únicos para prepare/worker/gate/verify y cada recheck; nombre y SHA256 en recibo. Historial conserva referencias. |

Regresión posterior observada: `python3 -W error::ResourceWarning -m unittest discover -s tests/controller` → **76 tests, OK**. Incluye diez regresiones nuevas, baseline aceptado que pasa su gate, preservación byte a byte, hashes de logs y negativas de reject. Antes de corregir se observaron los rojos correspondientes. Logs completos privados: `review-regressions-red.log`, `review-h2-red.log`, `controller-post-review.log`.

No prueba aislamiento frente a malware, deadline global estricto ni SaaS funcionando. Los comandos actúan sobre repos temporales en la suite; el walkthrough real se registra aparte. Las 55 fichas siguen siendo guía de construcción, con gates JIT y actos externos pendientes.
