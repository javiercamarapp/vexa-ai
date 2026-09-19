# VEXA — programa de construcción automática

## Encargo vigente
El usuario pidió construir, no seguir investigando: SaaS con GitHub, Vercel, Supabase, Google Auth, APIs/OpenRouter y calidad comparable a Likida. Investigación y contratos existentes son entradas. No repetirlos ni confundir un plan con software funcionando.

## Cambio operativo vigente — agentes y plazo
El usuario corrigió expresamente el plazo: **UN MES, no una semana**. Pidió agentes y loop graph continuo, sin escatimar esfuerzo. PLAN.md es el programa actualizado: propuestas independientes en worktrees disjuntos y unit tests, gates externos congelados antes de preparar/adoptar candidato oficial, integración serial por dependencias y revisión. Las propuestas no cuentan como tareas aceptadas. No significa bucle infinito, gasto ilimitado ni omitir STOP/seguridad.

Notificaciones/push/correos: destinatarios confirmados por el usuario son usuarios autorizados de VEXA, no clientes finales importados. Proveedor/dominio/entrega real siguen pendientes de configurar y verificar. Los datos de cliente llegarán después: construir con fixtures y conectores configurables ahora.

## Éxito
Código construible, tests de aislamiento/RBAC/ingesta/jobs/evidencia/dinero y ocho vistas con efectos reales; GitHub privado con CI; entorno VEXA en Vercel/Supabase; login Google probado ida/vuelta; llamadas reales OpenRouter presupuestadas; smoke remoto, versión servida y recuperación. Nada de acceso ficticio, métricas inventadas ni marcas de cliente sin autorización. Verificar cada capa por separado. Validación comercial/gold humano/piloto son hitos distintos que no se inventan por desplegar software.

## Métrica y guardias
Métrica: tareas aceptadas con gate congelado, revisión y recheck de materialización limpia. Dirección: subir (base: E00 + cinco F00 = 6/55). Contar aparte integración real y software local; no inflar la primera con mocks.
Guardias: regresiones existentes verdes; ninguna aceptación desde prueba vacía, omitida o cambiada por su candidato; integridad monetaria y aislamiento entre tenants; secretos fuera de Git/logs/frontend; no modificar otros proyectos.

## Cada vuelta
1. Leer estado, PROGRAMA y ficha elegible. No reconstruir grafo activo ni falsificar recibos.
2. Control-plane prepara el gate faltante contra contrato existente, registra rojo y revisión. Este trabajo ocurre fuera del candidato del producto.
3. Abrir worktree con runner prepare. Worker sólo modifica allowlist. Dependencias se instalan/cachean por operador autorizado; build de aceptación en copia temporal, nunca altera el candidato firmado.
4. Ejecutar gate y regresiones relevantes. Revisor separado examina diff, contrato y oráculos; rechazo vuelve a corrección supervisada conservando evidencias.
5. runner verify/accept conservan sólo candidatos válidos. Recheck sobre commit limpio. Sin aprobación de revisión no promover automáticamente.
6. Por petición posterior explícita del usuario, hacer merge fast-forward y push del SHA revisado al GitHub privado VEXA tras cada incremento aceptado. Sin commits vacíos, force-push, fechas falsas ni actividad artificial. Confirmar SHA remoto y privacidad; CI Actions requiere autorización de ejecución/presupuesto.
7. Registrar estado, SHA, comandos/salidas y siguiente tarea. Dos intentos fallidos: diagnóstico y bloqueo, no reset automático del contador.

## Presupuesto de esta corrida propuesta
El presupuesto inicial de4horas/55ciclos es histórico. Vigente: objetivo un mes, tandas acotadas de120min/54ciclos y dos intentos por tarea; propuestas paralelas y un escritor del baseline. Cada invocación Codex <=15min. ChatGPT/Codex, sin APIs de inferencia para desarrollar. **Cero gasto incremental de infraestructura/inferencia hasta que el usuario apruebe un techo**. Al agotarse tiempo, cuota o intentos: conservar avances, detener y reportar estado parcial, no éxito.

## Alcance autorizado / bloqueo externo
Código, dependencias públicas, fixtures sintéticos, pruebas locales y preparar integración GitHub/Vercel/Supabase/Google/OpenRouter conforme al encargo. Repositorio nuevo privado. No usar bases, secretos ni configuraciones privadas de Likida/Atiende/Moni. No contratar planes ni generar gasto nuevo sin techo aprobado. No procesar datos reales del cliente sin permiso.

Preflight 19-sep-2026: GitHub javiercamarapp, Vercel autenticado y Supabase CLI con acceso a la organización. No proyectos VEXA listados. Codex ChatGPT autenticado. Docker CLI presente pero daemon no disponible. No variables OpenRouter/Google/Supabase/Vercel en el entorno de esta sesión. Esto último no afirma que no existan secretos en otros stores: no fueron inspeccionados ni reutilizados.

## Actualización tras bootstrap y relectura completa
El preflight anterior es histórico. Docker ya arrancó; Supabase local propio `vexa-local` en5632x, GitHub privado y proyecto Vercel vacío creados. F01-01 aceptado en9e0010a; sin Auth/Google ni deploy. Relectura íntegra de ambas transcripciones de los seis audios, DOCX y35secciones PRD registrada en construccion/ALCANCE-CONFIRMADO.md. Ninguna obligación del MVP se considera resuelta por una ficha.

Implementación del supervisor y publicación: AUTOMATICO.md. Tras equipo paralelo/correcciones:29llamadas consumidas,1reservada para revisión de grafo y190restantes para supervisor, techo220. Presupuesto agotado no se renueva por relanzar. Push/correos para usuarios VEXA confirmados:5nodos explícitos F06-08..12, no implementados por añadirlos; banco de componentes revisados en construccion/PROPUESTAS-PARA-INTEGRAR.md. F01-02 aceptado;8/60tareas incluyendo preparación. La petición de completar todo mantiene abierto el objetivo íntegro, no autoriza simular accesos, resultados de cliente ni gastos no presupuestados.

## Parada
.runtime/STOP: no iniciar nueva vuelta. No matar procesos ajenos. No reiniciar tras cuota/credencial faltante ni cambiar de proveedor por reflejo. Missing credentials o gasto pendiente bloquean sólo la parte dependiente; continuar trabajo local independiente elegible. No dejar un loop infinito ni declarar un proceso activo sin PID/recibo comprobado.
