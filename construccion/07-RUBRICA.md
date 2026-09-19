# Rúbrica de aceptación de la guía — antes de revisión independiente

Encargo: comprobar y elevar el paso a paso de construcción VEXA al calibre de los encargos de construcción, QA y reanudación de Documentos Likida. No se pidió certificar un SaaS que todavía no existe.

1. **Cobertura ejecutable de la especificación.** Cada ID del DAG tiene entrada, salida concreta, secuencia específica, prueba positiva/negativa, recuperación y responsable de lo externo. Reprobar por un ID sin ficha, un output imposible por allowlist o una etapa genérica sin oráculo. Contar páginas no aprueba.
2. **Continuidad.** Una sesión sin conversación puede localizar próxima tarea, gate faltante, candidato preparado y resultado pendiente de aceptación. Reprobar si hace falta editar status=accepted o quitar requires_approval para avanzar. No es requisito afirmar autonomía sin humano.
3. **Integridad del control.** Tests/grafo fuera del writer; mutación de controles/HEAD/archivos bloquea; verify no mergea y accept revalida. Preparar no equivale a permiso de APIs. Reprobar un bypass reproducible dentro del modelo de operador cooperativo; no vender worktree como VM.
4. **Pruebas con señal.** Gates presentes se ejecutan; negativos detectan defectos, no sólo presencia de archivos. Gates futuros conservan missing y su contrato específico. Reprobar un PASS por documentos/JSON cuando se anuncia comportamiento real; distinguir preparación de producto.
5. **Punta a punta del negocio.** La ruta llega a Auth/RLS, ingesta, consumidor durable, ambos CRMs, evidencia, dinero, ocho vistas, intervención, QA, restore, release y entrega; lo externo tiene pasos/permiso/evidencia y no se inventa resuelto. Reprobar despliegue/cobro/causalidad acreditados sin evidencia.
6. **Comparación y entrega honestas.** Citar documentos de referencia y rangos leídos; marcar históricos y no revalidar producción Likida por leer un Markdown. Copia al Escritorio verificada y sin sobrescribir cambios del usuario. Reprobar equivalencia total con toda Likida o software productivo basada en muestreo/guía.

## Veredicto exigido al revisor
`apto para construcción GUIADA / requiere correcciones`, por criterio, con archivo:línea, reproducción y alcance no revisado. Separar P0/P1/P2 de tradeoffs y texto. Intentar refutar el paquete; no aprobar por cantidad de archivos. La disponibilidad de TODOS los gates y el funcionamiento de TODA la app son mediciones distintas del calibre documental; deben mostrarse por separado aunque la guía apruebe.

## Presupuesto
Un revisor limpio Astra/Codex mediante ChatGPT, máximo 12 minutos por pasada. Como máximo una pasada de corrección adicional si es necesaria y se declara. No delegar revisiones en cadena ni llamar APIs pagadas.
