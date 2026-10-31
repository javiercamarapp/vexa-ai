# Cómo contribuir

Repositorio **público** de Rovaq AI (su historial se recreó limpio el 31-oct-2026); las contribuciones se coordinan con el fundador.

- **Rama y commits:** una rama por cambio; commits pequeños y atómicos, con mensaje en español que explique la causa raíz. Sin squash artificial.
- **Antes de proponer un cambio:** `npm run typecheck --workspace @vexa/web`, las pruebas del área tocada (ver [README](README.md#pruebas)) y, si cambia una pantalla, las de `apps/web/tests`.
- **Reglas de datos:** ingreso bruto, nunca margen; dato desconocido no es cero; las monedas no se suman entre sí; toda cifra con procedencia y etiqueta Observado / Estimado / Inferido. La IA no crea importes.
- **No cambies identificadores técnicos** (`@vexa/*`, esquema `vexa_platform`, variables `VEXA_*`, claves `vexa:`): conservan el nombre original del proyecto; la marca visible es Rovaq AI.
- **Migraciones:** nunca edites una migración ya aplicada; agrega una nueva con su reversa.
- **Costos de despliegue:** cada push a la rama principal puede disparar un build facturable en Vercel; agrupa los cambios.
- **Seguridad:** ver [SECURITY.md](SECURITY.md). No subas secretos ni datos reales de clientes: ni nombres de personas, bodegas, empresas o SKU, ni cifras de su operación (ver [docs/seguridad/DATOS-DE-CLIENTE.md](docs/seguridad/DATOS-DE-CLIENTE.md)); usa roles y valores sintéticos, y deja los reales en configuración externa. `npm run test:datos-cliente` lo comprueba.
