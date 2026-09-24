# Robustez de cálculos: F07-02

Esta suite complementa los controles del kernel económico. La revisión
independiente cubre el dominio puro; no acredita RLS ni un CRM.

```sh
node --test packages/economics/robustness.test.mjs
python3 packages/economics/robustness-mutations.py --node node --output /ruta/absoluta/nuevo-reporte.json
```

El runner exige una ruta de salida nueva, conserva los logs y copia únicamente
cinco módulos puros a temporales propios. No instala dependencias, lee secretos,
envía solicitudes ni modifica los módulos originales. `--node` se puede repetir
para comparar runtimes. `VEXA_CANDIDATE` permite examinar otra copia de los módulos
desde la suite; el runner limpia esa variable para su baseline.

La semilla 42 genera 97 pedidos con importes mayores que el entero seguro de
JavaScript. Los oráculos cruzan ledger → envelope monetario → agregación/FX:

- Reordenar y reproducir páginas conserva valores, cobertura y digest canónico.
- Particiones **disjuntas** conservan importes y cobertura al agregarse. Si las
  páginas se solapan, se reúnen los registros canónicos antes de agregar. No se
  afirma que dos métricas distintas de lotes solapados sean aditivas.
- Nulos mantienen el total desconocido y el subtotal conocido exacto, incluso
  tras duplicación y conversión aprobada con redondeo explícito.
- Migrar identidades ya resueltas conserva importes y vínculos de reversión;
  cambia el digest de procedencia. Resolver alias en CRM/SQL es otro contrato.
- Monedas, exponentes, pertenencia de filas, conflictos de identidad,
  incompletitud de fuentes/ventanas y exposición no aditiva conservan sus guardas.

Se ensayan cinco defectos concretos: nulo convertido a cero, duplicación de una
métrica, suma que ignora moneda, omisión de tenant en una fila y pérdida de
precisión al convertir a Number. Un mutante sólo cuenta como `killed` si termina
con `ERR_ASSERTION` y el oráculo de valor esperado. Un error de sintaxis, setup,
contrato inesperado o timeout es `invalid`; no infla la protección medida. Un
`survived` requiere una nueva aserción o una equivalencia revisada.

El reporte de esta propuesta registra 9/9 casos en Node 22 y Node 26, y los cinco
mutantes detectados en ambos runtimes. No es un porcentaje de cobertura de todo
VEXA. La primera calibración de moneda produjo un error de exponente, no una
aserción válida; su recibo se preservó fuera del producto. Se corrigió el ensayo
para aislar la suma USD/EUR con el mismo exponente, sin modificar el producto.

Revisión independiente311:6/6 controles en Node22 y26 y cinco mutantes
propios detectados en cada runtime. La evidencia de autor permanece intacta en
`docs/blueprint/mutation-report.json`; su estado describe ese corte anterior.
Los cinco módulos examinados conservan sus hashes en esta integración.

Pendiente: aceptación formal de F07-02 y su dependencia F07-01. Los cambios
son pruebas y runner; no sustituyen los ensayos de autorización HTTP/DB,
persistencia de alias, carga, caos, restore ni validación con cuentas del cliente.
