# F04-07 — examen externo 244

Gate local reproducible: `VEXA_CANDIDATE=/ruta/candidato node --test tests/acceptance/F04-07.test.mjs`, Node 22 o posterior, sin dependencias ni servicios externos. El controlador se ejecuta desde su checkout separado; no modifica el candidato.

Los fixtures se rotulan sintéticos. Las estructuras simuladas de dos anotadores y compradores sólo ejercitan validación y aritmética, nunca demuestran calidad humana real. Sin gold completo y auditado: `not_measured`; sin revisión de utilidad: valor null; revisión parcial permanece explícita. No se aprueba automáticamente ningún release.

Los controles cubren denominadores, abstenciones, datos ausentes, doble anotación, desacuerdos/adjudicación, identidad/tiempo/hash de splits, congelación antes del ajuste, exportación de desarrollo por campos permitidos, citas Unicode/autorización, costos desconocidos y latencia. Separan 85% de utilidad de clasificación y 70% de insights de compradores con no respuesta.

La CLI real prueba freeze/evaluate/export-dev, recibos reproducibles, hashes de los bytes efectivamente leídos incluso bajo reemplazo concurrente de un input, permisos privados, no sobrescritura y ledger de exposición. Tres mutantes específicos deben alcanzar errores de aserción funcionales: sintético como humano, denominador cero como uno, holdout exportado. Después se revalida el original.

Hallazgo corregible detectado: campos extra de taxonomy también deben excluirse de export-dev; no basta proyectar casos y mensajes. El oráculo `NO_TAXONOMY_HOLDOUT_CHANNEL` conserva este requisito.

Los temporales propios se eliminan con finally. No DB, navegador, Docker, inferencia ni cloud: el alcance es CLI offline. El recibo privado 244 contiene los hashes exactos y resultados; esta nota no constituye aceptación oficial ni certificación de las metas comerciales.
