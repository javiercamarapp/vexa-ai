# VEXA — instrucciones de trabajo

1. Leer README.md, PROGRESO.md, docs/CONTEXTO-CANONICO.md, construccion/ALCANCE-CONFIRMADO.md y AUTOMATICO.md; después construccion/README.md y la ficha de la próxima tarea (`python3 scripts/guide.py next`). No releer todo fuentes/ en cada vuelta. Catálogo autorado y grafo v3 mandan sobre los generadores históricos.
2. Construcción usa Codex/ChatGPT gpt-6-astra; OpenRouter sólo será runtime del producto con presupuesto y autorización aparte.
3. private/ contiene audios, PRD, manifest y logs privados: no publicar, no commitear, no enviar a APIs externas. Originales inmutables.
4. Likida/Atiende y sus configuraciones son referencias read-only. Nunca copiar .env, tokens, datos cliente o IP sin permiso.
5. Dinero con procedencia, minor units/Decimal, moneda/ventana explícita, dedup y unknown≠zero. LLM no crea importes ni probabilidades calibradas.
6. Tenant derivado de identidad autorizada, RLS/Storage/retrieval/exports/jobs probados de forma negativa. Error no significa ausencia de datos.
7. En un candidato no modificar tests/acceptance ni orchestration; control-plane los revisa fuera de candidato. Baseline no incorpora fallos. Antes de autoría/revisión de un gate, leer `construccion/correcciones/<ID>-gate.md` si existe e incorporar sus correcciones; no repetir un examen previamente rechazado.
8. Estrategia vigente en PLAN.md: propuestas de módulos independientes en worktrees disjuntos pueden avanzar en paralelo. No son candidatos aceptados; gates externos congelados antes de preparar/adoptar/verificar/promover. Un escritor por área; no tocar la DB compartida sin coordinación. Plazo confirmado: un mes, no una semana.
9. Datos del cliente, producción, publicación remota, contratación y envíos requieren permiso/accesos específicos. Usar fixtures rotulados mientras tanto.
10. Antes de implementar ingesta/conectores/gateway/intelligence/notificaciones, leer `construccion/PROPUESTAS-PARA-INTEGRAR.md`: hay código revisado para adoptar selectivamente, no reinventarlo ni autoaceptarlo. Git read-only (show/diff/status) permitido; no cambiar HEAD/historial/config del candidato. Pruebas de controlador pueden crear repos de ensayo propios en temporales, nunca alterar este repositorio.
11. Cierre con comando/salida, SHA y lista de no probado. Documentación, mocks y kernel local no son SaaS terminado.

Comandos actuales: npm test; npm run test:controller; npm run graph:check. Scaffold en apps/web: npm run build --workspace @vexa/web, después de instalar en una copia temporal; no mutar el candidato con node_modules/.next. Para el supervisor vigente leer AUTOMATICO.md; orchestration/README.md documenta el runner base. No regenerar grafo durante ejecución activa. Publicación GitHub sólo mediante publisher determinista tras aceptación; workers no hacen push. El encargo exige el MVP completo de ocho vistas, no una demo recortada.
