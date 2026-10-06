# Importación económica desde la sesión del propietario

La página de Finanzas admite ahora un archivo JSON revisable de órdenes y reembolsos mediante las operaciones existentes del registro económico. El propietario puede incorporar un archivo completo, pausar ante errores y reanudar tras conciliar todas las identidades y metadatos. La lectura final debe acreditar todos los registros para mostrar éxito. Una carga no publica automáticamente un snapshot.

La validación completa limita tamaño, cantidad, periodo, USD, base bruta, unidades enteras y referencias. El destino proviene de la sesión autorizada. Un header adicional sólo restringe el tenant dentro de la misma transacción que escribe; nunca selecciona identidad ni organización. La confirmación corresponde al archivo y se invalida al reemplazarlo. Los errores, guardados inciertos y avances parciales permanecen explícitos.

La revisión independiente detectó y cerró dos riesgos: declarar una fuente completa antes de terminar sus filas y conciliar registros contra una versión de fuente posterior a la original. Este importador v1 sólo admite fuentes incompletas de versión inicial. No suma pedidos y reembolsos como pérdida ni transforma desconocidos en cero.

Verificación: 31 pruebas sintéticas Node22, lint, typecheck y build en copia aislada; revisión independiente y hashes del delta comprobados. Las pruebas cubren cancelación, respuesta perdida, reanudación, conflicto, cambio de organización y rechazo completo antes de solicitudes. La carga de cliente y su verificación visual son una comprobación operativa posterior; no se acreditan en este documento. No se ejecutó IA pagada ni se heredaron mediciones de capacidad. Se mantienen 59/60 técnicas y 28/60 aceptadas.

Contrato y límites: `apps/web/src/lib/economic-import/README.md`.
