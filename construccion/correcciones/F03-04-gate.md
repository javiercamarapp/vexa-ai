# F03-04 — examen externo de aliases humanos

2026-09-20. Propuesta local, no aceptación oficial ni ensayo de proveedores reales.

- Reutiliza el harness SQL/Auth/Storage revisado F03-03 mediante copia temporal que cambia sólo puertos, paths de imports y nombres de recursos; build/dependencias offline fuera del candidato. PostgreSQL real, createDatabase y rol de producto no superuser/no BYPASSRLS.
- SYN contiene cinco conversaciones A y una B. El repositorio debe proyectar cuatro identidades sólo después de aprobación humana owner y volver a cinco mediante evento compensatorio. Los bytes de conversaciones, revisiones fuente y snapshot permanecen iguales; no se reduce físicamente la tabla para fingir el recuento.
- Matching no escribe aliases. Se exige aprobación explícita, evidencia y razón; actor deriva de SQL. Se prueban tenant, tupla fuente/cuenta/entidad/ID, ambigüedad, reconexión que cambia cuenta, revocación/rol SQL vigente, CAS concurrente y ciclos simultáneos.
- Filas legacy se conservan: list/resolve bloquean hasta nueva revisión humana; propose expone legacy/version y history conserva ambas entradas. El fixture representa una fila pre-009 bajo administrador aislado; no se afirma haber migrado una cuenta real.
- Extensión009 usa external_aliases existente. La matriz mantiene inventario global y todas las FK. Bajo009 delega su CRUD al oráculo append-only, con INSERT owner válido y negativos de roles/acciones/revocación/UPDATE/DELETE. Sin009 conserva la matriz previa. El fixture añade un destino canónico distinto y las lecturas de conversaciones esperan explícitamente ambas filas.
- Primer negativo de source mutaba Zendesk a Zendesk para B; era un no-op del examen. Se corrigió a la fuente opuesta, conservando el rechazo y sin cambiar producto.
- La primera matriz global rechazó ALIAS_SQL_OWNER_POSITIVE: el fixture histórico customer compartía conexión con provenance={fixture:true}, incompatible con la nueva validación de cuenta de009. Se añadió source/account_id únicamente a ese fixture cuando009 está presente; el comportamiento anterior y los negativos se conservan.
- Mutantes SQL: aprobación ausente, fuga de tenant seleccionado y borrado destructivo del historial; cada uno demuestra verde→rojo por oráculo→verde restaurado. La implementación ausente falla ALIAS_IMPLEMENTATION_MISSING, no por instalación ni infraestructura.

La aprobación independiente y los gates reales S01/S02 siguen pendientes. No modificar el candidato oficial ni marcar17/60 como18/60 mediante estas pruebas locales.

## Revisión independiente214 y recuperación de concurrencia

El revisor reprodujo dos aprobaciones opuestas bajo REPEATABLE READ con snapshots anteriores al bloqueo; ambas confirmaban y la lectura posterior detectaba un ciclo. El guard SQL ahora exige READ COMMITTED para confirm y undo antes de escribir. La regresión usa createDatabase real y barrera de dos transacciones: antes fallaba con2commits frente a0esperados; después no quedan filas y el camino RC conserva confirmación/deshacer. También rechaza undo con SERIALIZABLE y READ UNCOMMITTED. No se cambian privilegios ni pruebas heredadas.

Resultado corregido:13/13 Node22 y26, tres mutantes de permiso/tenant/historial detectados, matrizglobal SQL/Auth/Storage/revocación209/209 repetida sobre SQL corregido; recursos eliminados por IDs. El consumidor TypeScript real createDatabase→createAliasRepository compila con strict. La primera hipótesis de identidad duplicada entre conexiones fue descartada por UNIQUE(tenant_id,source,account_id), no es un defecto del producto.

No confundir esta propuesta revisada localmente con aceptación oficial: S01/S02 reales y dependencias siguen pendientes,17/60 global. El manifiesto original35archivos y sus recibos se conservan antes del delta; el paquete final tiene manifiesto propio.
