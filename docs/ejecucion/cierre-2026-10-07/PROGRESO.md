# Progreso

Última actualización: 8 de octubre de 2026 UTC (noche del 7 en Mérida).

## Hecho y verificado
- Fases 1–3 completas localmente; grafo con 28/60 aceptaciones formales; inventario técnico reconciliado a 60/60 por cierre local F07-01.
- Fase 4: restore local 5/5, rollback financiero y regreso aprobados; ocho recursos propios ausentes. Captura de 13 objetos y metadatos comprobada; operación gestionada pendiente.
- Fase 5: lectura productiva confirma 288 bloques CRM por día. Los 362 mensajes asociados a rechazos históricos ya existen; faltan vínculos con padres.
- Mejora CRM propuesta con 101 pruebas de autoría y seis controles locales aprobados, preservando los fallos previos.

## En curso
CRM y control S01 integrados localmente (cbeba0d, aff0517, 3ec0e2b). Serie aff0517:10K aprobada,50K en ejecución. El control S01 cambió fuentes: nueva serie definitiva deberá comenzar de10K tras consolidar la auditoría. Una sola suite pesada.

## Siguiente
Cerrar medición50K de su versión y preparar fase6: reparar deuda conocida del control y consolidar fuentes antes de repetir la serie definitiva y auditoría final. Fase5 conserva pendientes externos de autorización de lote, referencia UI independiente y proveedores.

## Pendientes
- Consulta Supabase sobre cuarentena de Storage preparada, autorización de envío solicitada; aún no enviada.
- Recuperación gestionada y operación permanente no verificadas.
- Nuevos lotes productivos, publicación, gasto y validaciones humanas conservan los permisos específicos del plan.
- No declarar 60/60 ni producción validada mientras falte evidencia.


## Fase6: controles actuales y memoria,8-oct

Candidato externo separado1aea895 en `/private/tmp/rovaq-fase6-candidate-20261008`. Controles de base/Auth/Node revisados por Standards, reparado handshake para esperar DOMContentLoaded real antes de leer selección persistida. Controles UI revisados por root: selectors/filtros/marca/productores cotejados con producto; negativos de workspace reforzados para exigir desaparición de tabla financiera, además de artículos y exportación. F05-02 focal10/10PASS,47,56s y seis recursos ausentes; restantes en curso, no gates completos aún.

Schema de paquete: primeros intentosv1/v2 rojos preservados. Fixture Auth/Storage SQL actualizado con funciones oficiales y revisión independiente; inventario fijo112tablas sustituye contador36obsoleto, conservando asserts. `service-cas` prototipo eliminado se retira explícitamente como RETIRED_SUPERSEDED, noPASS; su mapa exige CAS/aprobación/replay actual más rollback SQL dirigido. Cuatro suites restantes pendientes del slot. Fuentes en worktrees de control; no integradas aún.

Wiki autorizada actualizada con tres notas atómicas de recuperación, CRM/histórico y diferencia60técnicas/28formales; hot e índices actualizados, log prepend sin tocar entradas previas ni .raw. No hay push/deploy, carga productiva ni inferencia pagada.

Control UI focal: F06-01 v1 falló por asumir igual etiqueta de exportación en Overview y Problems; se corrigieron dos selectores de Problems, sin cambiar producto/plazo. v2 pasó16/16 (69,92s); F06-02 pasó11/11 (67,70s) y F06-03 pasó14/14 (75,93s), seis recursos propios ausentes en cada corrida. Explorer sigue en ejecución. Recibos originales en `~/.codex-work/rovaq-cierre-20261007/receipts/fase6-ui/`; no equivalen a gates completos. Lectura remota anónima confirma despliegue b0be6df y rutas protegidas, no el código local.


Schema v3: cuatro suites conservadas, 21/21 PASS en 24,469 s. Cada hook verificó eliminación propia con docker rm exit0; inventario final independiente sin contenedores schema. No se afirma cotejo histórico de cuatro IDs: el buffer de eventos sólo retenía uno. Integrado en3530f92 con inventario de capacidad2.219 y preflight PASS; no capacidad medida. Retirada del prototipo mantiene pendientes sus sucesores modernos. Explorer también PASS13/13 (135,66 s, setup dentro480 s y seis recursos ausentes). Slot transferido a Auth/base; controles UI restantes esperan.
