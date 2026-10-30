# Vinculo pedido -> cliente (determinista, rotulo Inferido)

`vincular-pedido-cliente.mjs` liga un pedido del libro a un cliente solo por coincidencias exactas de identificadores. No usa nombres, similitud ni inferencia estadistica.

## Por que existe
El libro economico no guarda quien compro: `details` esta vacio y las exportaciones de marketplaces no traen correo, telefono ni id de comprador. `customers` solo tiene el id externo del CRM y un nombre visible. Por eso la metrica (filas vigentes con `customer_key` en `economic_order_customers`) arranca en 0 y no se puede subir con cruces por correo o telefono mientras ninguno de los dos lados los almacene.

## Cadena usada
1. Pedido -> ticket: `pares-economia.jsonl` (salida de `packages/ai-scale/economia-problemas/puente.mjs`; marketplace y order_id exactos).
2. Ticket -> cliente, tres llaves exactas:
   - K1 hecho nativo `native_customer_associations` (ticket_id, contact_id) cuyo contacto es un cliente vigente.
   - K2 vinculo vigente conversacion-cliente (`conversation_customer_association_bindings`).
   - K3 `conversations.customer_id`.
3. Un pedido se liga solo si todas las llaves que responden apuntan a un unico cliente y todos sus tickets coinciden. Ambiguo, conflicto entre tickets, contacto no cargado o vinculo previo distinto: no se escribe y se cuenta.

## Rotulo
Todo lo ligado por ticket es **Inferido**: el contacto del ticket de soporte de un pedido no prueba que sea el comprador. **Observado** queda reservado a una fuente que traiga el id o correo del comprador dentro del propio pedido. Ingreso bruto; nunca margen.

## Uso
Solo lo corre un owner humano. Pasos `medir` (solo SELECT), dry-run, canario y completo; ver la cabecera del script. Escribe dos tablas existentes (sin migracion nueva), con atestacion del owner, por lotes atomicos, idempotente y reversible. Pruebas: `node --test scripts/vinculos/test-vincular-pedido-cliente.mjs`.

## Lo que falta para subir la cobertura
Un identificador de comprador en el pedido (correo o id de cliente de la tienda) y, del lado del CRM, el correo del contacto (o su hash normalizado con la misma regla en ambos lados). Sin eso, el techo es la fraccion de pedidos que tienen un ticket de soporte.
