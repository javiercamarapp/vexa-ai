# VEXA — instrucciones de trabajo

1. Leer README.md, PROGRESO.md y docs/CONTEXTO-CANONICO.md; después la fase asignada, no todo fuentes/ en cada vuelta.
2. Construcción usa Codex/ChatGPT gpt-6-astra; OpenRouter sólo será runtime del producto con presupuesto y autorización aparte.
3. private/ contiene audios, PRD, manifest y logs privados: no publicar, no commitear, no enviar a APIs externas. Originales inmutables.
4. Likida/Atiende y sus configuraciones son referencias read-only. Nunca copiar .env, tokens, datos cliente o IP sin permiso.
5. Dinero con procedencia, minor units/Decimal, moneda/ventana explícita, dedup y unknown≠zero. LLM no crea importes ni probabilidades calibradas.
6. Tenant derivado de identidad autorizada, RLS/Storage/retrieval/exports/jobs probados de forma negativa. Error no significa ausencia de datos.
7. En un candidato no modificar tests/acceptance ni orchestration; control-plane los revisa fuera de candidato. Baseline no incorpora fallos.
8. Datos del cliente, producción, publicación remota, contratación y envíos requieren permiso/accesos específicos. Usar fixtures rotulados mientras tanto.
9. Cierre con comando/salida, SHA y lista de no probado. Documentación, mocks y kernel local no son SaaS terminado.

Comandos actuales: npm test; npm run test:controller; npm run graph:check. No hay todavía build/dev del SaaS. Para el loop leer orchestration/README.md. No regenerar grafo durante ejecución activa.
