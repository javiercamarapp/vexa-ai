# Restauración y retorno de versión — 1 de octubre de 2026

**Verificación local aprobada; 59/60 técnicas, 28 aceptadas formalmente y producción pendiente.** El gate F07-06 terminó con exit 0 en 263207 ms contra el candidato limpio `0691dbdea97b9e27f451ad3676cfffacc6629608`. No cambió el producto desplegado `f893851` ni se enviaron correos, notificaciones o solicitudes a proveedores reales.

## Resultado comprobado

- Restauración: cinco resultados PASS (cuatro subtests y su contenedor), con PostgreSQL real y Storage en filesystem. Respaldo anterior, borrado posterior y reproducción del registro firmado para dos organizaciones; no resucita el contenido eliminado y conserva el hash del respaldo original.
- Siete tablas de histórico, evaluación y equipos conservan sus hashes. Se comprueban la invitación revocada, la invitación vencida, la exclusión del contenido borrado y el costo desconocido como null.
- Retorno de versión: el binario anterior `d1956d991bbf3d0332b4abb0fd50be464ea312db` compiló, pasó lint y sirvió su SHA. Conservó la consulta financiera y el snapshot, devolvió 404 a la otra organización y permitió volver a la versión actual con resultado idéntico. El importe de prueba fue 1500 unidades menores.
- El adaptador pasó 3/3 pruebas, incluido el rechazo de un contrato de logs alterado. Las pruebas de base pasaron 24/24.
- Ocho recursos propios fueron eliminados y su ausencia se volvió a comprobar. Los procesos terminaron y las fuentes del candidato permanecieron limpias.

## Causas corregidas

El bootstrap Auth del ensayo carecía de `banned_until`, usado por la composición SQL actual. Se añadió como timestamptz nullable sin default, conforme al esquema gestionado consultado.

La imagen PostgreSQL iniciaba un worker `pg_net` no superusuario durante la restauración. La guarda detectó esa conexión y rechazó continuar. El entorno offline ahora arranca con las diez bibliotecas restantes de la misma imagen; excluye únicamente `pg_net`, exige la lista exacta mediante SHOW y conserva las dos guardas del producto. [Funcionamiento de pg_net](https://github.com/supabase/pg_net).

El adaptador de retorno esperaba un formato antiguo de nombres de logs. Ahora exige exactamente una aparición del formato vigente; la prueba negativa comprueba que una alteración se rechaza. El inventario de carga conserva 2156 fuentes y actualiza únicamente los dos hashes del adaptador y su prueba. No hay un nuevo resultado de carga atribuido a ese inventario.

Se conservaron los tres fallos anteriores y el ensayo diagnóstico; no se borraron ni se contaron como aprobados.

## Recibos

| Artefacto | SHA256 |
|---|---|
| Gate completo | `695b43704cea856da8c33f01e59e1e0eaf1bd47751e79fa534c2ea6c47aac569` |
| Observaciones de restauración | `e5bd1d696a7bef074462511a73c4d5e0294837e7500b13df23da96fc1ea8e251` |
| Recibo de retorno de versión | `351a07f682a45afd9e56321672e7de9a2e25f640f6b21c11d40055fdf0a0b6b1` |
| Controles congelados | `c837d81775013bf8d6b6f411c753880c560ebbdcc49a1d31891ce57886f5ed81` |

Comando del gate: `VEXA_CANDIDATE=<candidato limpio> node --test tests/acceptance/F07-06.test.mjs`, con Node 22.23.2 y controles externos a ese candidato. Los recibos originales permanecen en custodia privada; este documento no contiene credenciales ni datos de clientes.

## Límites

Es recuperación local offline. No acredita recuperación gestionada de Auth/Storage, recuperación con `pg_net` activo, todas las rutas del binario anterior ni todos los estados de entrega de correo/push. La versión anterior conserva un defecto conocido al listar más de 100 candidatos; no se recomienda como rollback general. No hubo downmigration.

No concede aceptación formal a F07-06, no cierra F07-01 y no aprueba producción. Siguen pendientes la revisión global, capacidad actual de 50K/150K, validaciones externas y actos operativos/humanos legítimos descritos en la auditoría de veinte rubros. Las API por sí solas no resuelven estos pendientes.
