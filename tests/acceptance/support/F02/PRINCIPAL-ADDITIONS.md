# Regresiones de revisión independiente incorporadas antes de freeze

La revisión del parser rechazó P1 por datos XML omitidos y P2 por namespaces ajenos. Se preservaron cuatro XLSX sintéticos y su positivo, con hashes y bytes, sin cambiar originales ni producto.

El principal añadió cinco casos al examen: ahora64 (antes59). Contra el prototipo rechazado, prueba dirigida5casos: positivo1pass, cuatro rechazos requeridos fallan por OOXML_REJECTION_REQUIRED; exit1. Log adjunto, no se cuenta como error de infraestructura.

Fixtures provienen del revisor independiente; CRC/XML no equivalen a validación Office completa. Se exige rechazo XLSX tipado de duplicados/estructuras no soportadas, nunca devolver datos incompletos sin error. Hay positivo con mismo envoltorio para evitar rechazo indiscriminado.

Aún no se ha congelado ni aceptado. El corrector de producto trabaja en otra copia y no modifica este examen. Quedan revisión independiente del examen y positivos sobre fuente corregida estable. Documentos heredados que dicen59 se refieren al corte anterior; sus resultados no se reescriben.
