# Cómo contribuir

El código de Rovaq AI es propietario (todos los derechos reservados, ver [LICENSE](LICENSE)). El repositorio es visible públicamente, pero **no se aceptan contribuciones externas sin un acuerdo previo por escrito con el titular**. Quien trabaja en el proyecto coordina los cambios con el fundador.

- **Rama y commits:** una rama por cambio; commits pequeños y atómicos, con mensaje en español que explique la causa raíz. Sin squash artificial.
- **Antes de proponer un cambio:** `npm run typecheck`, las pruebas del área tocada (ver [README](README.md#cómo-correrlo-y-probarlo)) y, si cambia una pantalla, las de `apps/web/tests`. `npm test` debe quedar verde.
- **Reglas de datos:** ingreso bruto, nunca margen; dato desconocido no es cero; las monedas no se suman entre sí; toda cifra con procedencia y etiqueta Observado / Estimado / Inferido. La IA no crea importes.
- **No cambies identificadores técnicos** (`@vexa/*`, esquema `vexa_platform`, variables `VEXA_*`, claves `vexa:`): conservan el nombre original del proyecto; la marca visible es Rovaq AI.
- **Migraciones:** nunca edites una migración ya aplicada; agrega una nueva con su reversa (ver `ops/rollback`).
- **Datos de clientes:** no subas datos reales, ni cifras de producción en pruebas o documentos; usa datos sintéticos. La guarda `npm run test:datos-cliente` lo comprueba. Ver [docs/seguridad/DATOS-DE-CLIENTE.md](docs/seguridad/DATOS-DE-CLIENTE.md).
- **Costos de despliegue:** cada push a la rama principal puede disparar un build facturable en el proveedor de alojamiento; agrupa los cambios.
- **Seguridad:** ver [SECURITY.md](SECURITY.md). No subas secretos.
