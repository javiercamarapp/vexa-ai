# Premortem de negocio, datos y sociedad

Hipótesis: dentro de doce meses el proyecto falló. ¿Qué habría ocurrido? Este registro prioriza causas y pruebas; no asigna probabilidades numéricas sin evidencia.

| Riesgo | Señal temprana | Mitigación / prueba | Quién decide |
|---|---|---|---|
| Dólares no conciliables | CFO no reproduce casos; muchos enlaces faltantes | Ledger por evento, supuestos y cobertura; prueba ciega con analista | Finanzas cliente + producto |
| Sin acción ejecutable | Recomendaciones sin owner/control | Elegir intervención viable antes del piloto | COO/posventa |
| Demanda sólo del socio | Todos los leads dependen de una relación | Dos cuentas independientes y evidencia de pago | Fundadores |
| Consulting disfrazado de SaaS | Horas de integración crecen por cuenta | Medir horas/margen, limitar scope, separar setup/servicios | CTO/operación |
| Incumbente absorbe función | Cliente prefiere módulo existente | Bake-off, foco donde hay valor incremental y neutralidad | Producto/comercial |
| Datos/IP no autorizados | NDA genérico sin derecho a procesamiento | Revisar entidad contratante, DPA/finalidad/subprocesadores y licencias | Asesor legal/cliente |
| Dependencia de plataforma | Rate limits/scopes bloquean historia | Adaptadores versionados, CSV legítimo, checkpoint y alertas | Ingeniería |
| Costos AI sin control | Reprocessing y conversaciones largas destruyen margen | Presupuestos/reservas, límites y selección por evals | Ingeniería/finanzas |
| Promesa de seguridad exagerada | Se vende SOC2/residencia sin respaldo | Claims revisados, controles medidos y roadmap separado | Seguridad/comercial |
| Conflicto70/30 | Obligaciones/vesting/IP ambiguos | Pacto fundador y partes relacionadas antes de dedicación exclusiva | Socios/abogado |
| Responsabilidad producto físico | Reclamo de daño se maneja como tema común | Escalación humana de severidad, proceso cliente; no diagnóstico técnico automático | Calidad/legal cliente |
| Forecast tratado como plan comprometido | Se contrata equipo por ARR hipotético | Presupuesto por hitos y revisión de caja/ventas reales | Socios |

## Condiciones de datos y seguridad
NDA no equivale a autorización de CRM, DPA, licencia de entrenamiento ni permiso de logo. Inventariar responsable/encargado, finalidades, categorías, retención, transferencia, proveedores, acceso y borrado según jurisdicción aplicable. La guía FTC “Start with Security” es una referencia general de minimización y gestión de riesgo, no certificación ni dictamen de cumplimiento. Fuente abierta: https://www.ftc.gov/business-guidance/resources/start-security-guide-business.

No se accedió a una fuente CPSC suficiente para citar aquí plazos legales específicos; la página intentada dio403. Por eso no se inventa un deber de reporte de X horas. Cualquier incidente de seguridad de producto requiere política del cliente y revisión especializada. VEXA no determina si existe defecto legal, retiro o causalidad técnica a partir de texto.

Desarrollo por Codex no habilita enviar conversaciones de clientes al proveedor. Antes de inferencia real revisar OpenRouter/endpoint/subencargado/retención/residencia; `data_collection: deny` no sustituye DPA ni es automáticamente ZDR. Separar entornos y permisos; no service_role en browser. Diseño técnico detallado en docs/blueprint/calidad/03.

## Sociedad y el30%
No hay conclusión «30% es bueno/malo» sin capital aportado, tracción, dedicación, salario, vesting simétrico, fully diluted, opciones/SAFE, IP previa, cláusulas leaver, propiedad de oportunidad Convexia y decisiones reservadas. El costo de oportunidad de otros proyectos existe, pero no conocemos ingresos/horas para monetizarlo. Avanzar en activos reversibles y diligencia; no regalar IP previa ni firmar exclusividad por una promesa verbal.

## Prioridad de diligencia
Antes de datos: autorización/entidad/retención y acceso mínimo. Antes de mes exclusivo: pacto de socios y obligaciones recíprocas. Antes de gastar: presupuesto firmado y criterio de parada. Antes de pitch público: permisos de marca/datos, cifras con etiquetas y estado de producto. Antes de producción: pruebas negativas y respuesta a incidentes. Nada de lo anterior queda aprobado por haber escrito esta carpeta.
