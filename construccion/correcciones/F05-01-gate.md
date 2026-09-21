# F05-01 — examen independiente del adaptador financiero

El gate conserva sin cambios los doce casos E00. Añade dieciocho casos del adaptador: tenant antes de filtros, identidad económica estable, conflictos fuera de ventana, procedencia operacional, moneda/base/exponente, calendario y ventana semiabierta, asOf, período abierto, precisión de enteros mayores de2^53, null frente a cero, fuente incompleta, settlement, reversals, unión global, hashes y pureza. Los hashes de alcance permanecen estables entre snapshots; los de entrada cambian con los datos y su procedencia.

El examen detectó una pérdida de filas con una clave canónica `__proto__`: el diccionario de problemas usaba un objeto con prototipo. La corrección mantiene claves propias incluso al serializar JSON. El rojo específico y los verdes finales se conservaron. Las correcciones previas de identidad estable sin revisión, calendario y orden binario también tienen oráculos externos.

Tres mutantes financieros se calibran0→1→0: fuente incompleta transformada en cero, precisión perdida por Number y omisión de la guarda de tenant. Cada uno falla una aserción financiera, no setup. El primer ajuste de los blancos de mutación por la condición WINDOW_INCOMPLETE no se contabiliza como mutante rechazado.

Resultado final local:34/34 en Node22 y Node26 (doce E00, dieciocho casos nuevos, tres calibraciones y un grupo). Kernel original intacto. Adaptador puro: no sustituye Auth, RLS, ledger, UI ni validación contable con fuentes reales. Un original de refund fuera de período deja conciliación explícita/null; no se inventa saldo inicial ni cero observado. La dependencia externa F03 y la aceptación oficial permanecen separadas de este dictamen técnico.
