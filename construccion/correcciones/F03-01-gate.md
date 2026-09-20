# F03-01 — gate externo propuesto,20-sep2026

No aceptado: S01 live pendiente. `F03-01.test.mjs` combina26controles locales y el ejecutor real `support/F03-HubSpot/live.mjs`. `local.test.mjs` separado permite probar código sin simular aceptaciónremota. Config/env/JSONpassed no sustituyen llamadas reales ni reconciliación20threads.

## Evidencia del autor

Baseline9874b81, worktree gatef0301-1789940540377582000. Producto separado del constructor, congelado7archivos según `/tmp/vexa-f0301-product-manifest.json`; no se modificó producto, HEAD, graph, registro ni otrosgates.

- Ausencia: salida1 con IMPLEMENTATION_MISSING, no import/error de setup ambiguo.
- Node22.23.2 y26.7.0:28/28 positivos cada uno (26dominio HTTPloopback +2guardas liveconfig/redacción),0skip. Logs `/tmp/vexa-f0301-all22.log`, `/tmp/vexa-f0301-all26.log`.
- Cuatro mutantes conductuales sobre adaptadorreal,4/4cada runtime: rol interno→cliente, omitirM2, revisiónconstante, threadmetadata→texto. Cadauno0→1→0 por marcador de dominio exacto; timeout/setup no cuentan. Scripts/recibos enTMP `vexa-f0301-mutants-Y3hlAw` (Node22) y `vexa-f0301-mutants-ZvpIVr` (Node26).
- Examen final sinconfig:26localespass yS01_LIVE_BLOCKED; no se llamóHubSpot ni seleyeron credenciales. `/tmp/vexa-f0301-final-blocked.log`.
- Fuentes/fixtures son sintéticasCC0. HTTPreal sóloloopback; host delproveedor validado antesderewrite. Read-onlyGET,redirectmanual,AbortSignal, timeout delcuerpo,429/retry,scopes/401403,subpáginas/cursors,roles/unknown,asociaciones/tickets/notas,originaltruncado,revisiones ylímites cubiertos.

## Límites y revisión necesaria

`LIVE.md` contienecontrato/procedimiento/config exactos, fuentes oficiales yrutaS01ejecutable. Requiere OAuthreal, cuenta/appesperadas, autorizaciónreferenciada real yexportindependiente; nofixturecuenta. El ejecutor live sólo se ha probado en rechazo sinconfig/JSONarbitrario/redacciónparseo, nunca en positivo contra proveedor. Su revisión independiente esobligatoria antesdefreeze/uso. Permiso no naceporcreararchivo. NuevarutaOAuthPOST no se inventa: GETlegacydocumentado vigentehasta16feb2027, tokenenURLenmemoria ysinlogs. Accesos/PII/autorización siguenfuera delcandidato yno sepublican.

El enlacehacia guíaLatest2026-09 sigueconflictivo con spec; v3 estádocumentada,noverificada en cuenta. Configscopes no acredita scopes: liveintrospection+respuestas reales sí sonparte delexamen. NotasHelpDesk/privilegios UI/export ypersistencia durable debenvalidarse segúnfichas; pasar adaptadorlocal no acredita SaaS ni cierre18/60. IncidenciaCSVF02 preservadasin cambios.

## Reproducción posterior delprincipal: cuarentena elude maxRecords

Seañadieron dosoráculosconcretos despuésdelverde28: mensajesnull ythreadsnull debencontar dentro delmáximo accepted+rejected. Ambos fallan contra productocongelado con `Missing expected rejection` (Node26), `/tmp/vexa-f0301-rejected-limit-red.log`. No timeout/setup. Elverde28 histórico no cubría este defecto. Principal corregirá enworktree separado; estos2casos debenquedarverdes antesde revisión/freeze. Cobertura localactual30casos incluye las2guardasdeconfig, yestárojahasta corrección. No se tocó productodelautor.


## Correcciones y evidencia posterior,20-sep2026

Los números anteriores son históricos. El producto corregido cuenta aceptados y rechazados en maxRecords: dos oráculos independientes reprodujeron el exceso, luego pasaron. La revisión203 reprodujo además lectura de cuerpos fuera de la muestra y cobertura de notas incompleta reportada como completa. Ambos se corrigieron: threadIds inmutable obtiene únicamente GET directo por ID, verifica identidad/inbox antes de leer mensajes y liga el checkpoint a su alcance; messages/notes contabilizan cuerpos ausentes por separado. El ejecutor externo vuelve a validar cada ruta/ID y exige que authorization_ref coincida con la referencia del supervisor antes de cualquier request. La revisión205 detectó que el diagnóstico debía consumir también notes_bodies_missing; se corrigieron contador, acumulación y condición de cobertura, con dos pruebas rojas→verdes sobre veinte notas ausentes/completas.

Evidencia local:16 pruebas de producto y28 controles externos, más4 guardas del driver, verdes en Node22/26; dos pruebas específicas del diagnóstico también verdes en ambos runtimes. Cuatro mutantes se detectan por oráculos de dominio. No se repitieron regresiones de F02 inalterado.

El entorno oficial se integra mediante una allowlist de tres variables privadas, únicamente para verify/accept F03-01 con requires_approval=true y referencia explícita del operador. La referencia la deriva el controlador de approval_note; una variable ambiental no puede sustituirla. Los workers y demás gates no heredan estos secretos; el loop automático se detiene antes de esta tarea. Cinco pruebas específicas y122 pruebas completas del controlador terminaron en verde. Esto transporta una autorización real referenciada, no crea permisos de cuenta ni datos.

El entry final ejecutado sin autorización/configuración legítimas devuelve exit1:28 controles locales verdes y un rechazo S01_LIVE_BLOCKED. No hubo llamadas autenticadas. La muestra real, scopes efectivos, reconciliación independiente y cobertura de notas autorizada siguen pendientes; authored no es accepted y el contador global continúa17/60. Este paquete es una propuesta revisable; aún no se ha preparado/verificado/aceptado mediante el runner oficial.
