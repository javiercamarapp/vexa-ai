# F07-06 — restauración y rollback financiero externos

Se reutilizan controles independientes352 para siete tablas con datos de histórico/evaluación/equipos, dump/restore reales, ledger de borrado, exclusión de fuentes y snapshot financiero. El bootstrap Auth es SQL SYN; Storage es filesystem real. El destino queda cerrado; no es restauración del servicio Auth/Storage gestionado.

El controlador aporta harness y fixtures desde su propia raíz. El candidato aporta producto y migraciones. Dependencias se instalan en copia mediante npmci offline ignore-scripts con lock; no se usa la ruta temporal privada antigua. Un fixture firmadoSYN conserva la rama contractual de elegibilidad, sin afirmar gold humano ni precisión. No hay llamadas LLM.

Se prueba además un binario Next anterior real, obtenido con gitarchive de d1956d9 en la historia local, compilado con SHA servido verificado. Con esquema actual hasta0038, conserva detalle/snapshot/refund1500, deniegaB404 y permite volver al binario actual sin alterar cifras. Este ensayo es continuidad financiera; d195 conserva su defecto conocido de listar más de100candidatos y no es una recomendación general de rollback. No hay downmigration.

El gate completoNode26 pasó restore5 y rollback con cuatro archivos de examen del candidato convertidos en trampas. Original46archivos de evidencia conservados. Se añadió después cleanup idempotente/handlerSIGTERM-SIGINT: una prueba real terminó con exit1, sin señal y con tres recursos ausentes. No se atribuye una segunda corrida completa al delta de señales. El helper de proceso compartido tiene pruebas independientes22/26 deTERM/KILL/exit0tardío; timeout permaneceFAIL y nunca acredita cleanup sin recibo.

Puertos61820/61821 para dos bases locales propias; luego61620–61625 para Auth/Storage/Next. El journal contiene IDs y broker únicos; no comparte ni resetea servicios ajenos. Las pruebas de política, aislamiento y autoridad no se sustituyen por un JSON de éxito. Revisión360 c4ed21ea4af87eafb2b6e2a1c563ec3a775d98b0e925f553d3d7a20141fde08b. F07-04/aceptación formal y restore gestionado autorizado siguen pendientes.
