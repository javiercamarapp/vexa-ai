# Límites de F02-01 y bloqueo de freeze

1. **Revisión independiente pendiente.** Esta autoría no congela ni acepta el gate.
   Deben revisarse contrato aditivo, matriz y evidencia; no hubo delegación.
2. **Observador de pre-expansión dependiente de Node zlib.** El control positivo
   exige observar expansión real. Lectores JS puros/nativos requieren observador
   adecuado antes de freeze; INSTRUMENTATION_UNAVAILABLE no mata mutantes. El
   control independiente Python sí demuestra read0→lectura adelantada1→read0.
3. **Controles positivos pendientes:** cancelación/aborto pendiente/consumo acotado
   del stream; límites normalizados50K y2000codepoints/importe inválido. Sus
   aserciones están escritas y el banco falla; no existe positivo íntegro de
   producto ni se creó implementación escondida para hacerlo verde. Dos controles
   streaming independientes cubren emisión temprana y splits reales, no todos los
   restantes casos de stream.
4. **Seguridad XLSX no exhaustiva:** la batería cubre límites inclusivos20/100MiB,
   diez hojas, bomb real, pre-expansión observada, fórmula cached, macros/external
   relationships y truncamiento. No demuestra resistencia a ZIP64, metadatos
   mentirosos, CRC malicioso, XML entities ni entradas duplicadas/path traversal.
   La validación independiente confirma CRC/ZIP/XML/XPath de fixtures buenos;
   no confundirla con pruebas adversarias de todas esas variantes contra producto.
5. Sin parser XLSX ni streaming en banco. Elegir/revisar dependencia Node XLSX y
   cualquier cambio package/lock requiere el trabajo de producto posterior;
   no se instaló ni modificó nada de ello. Su ausencia y el rojo del baseline
   **no impiden por sí mismos congelar un examen íntegro y revisado**.
6. No RSS/heap límite demostrado; OOM, timeout y error de infraestructura jamás
   se cuentan como PASS o mutante muerto. Los controles100MiB expanden realmente
   datos sintéticos. No garantía ante fuentes que entregan un chunk gigantesco.
7. HTML/fórmulas: valores y hooks fetch/eval/marker cubiertos; no browser ni prueba
   universal de todas las APIs de red/procesos. Marcador VBA inerte, no macro real.
8. Fuera de alcance: F02-02..06, SQL, Storage, Auth, workerhost/cloud, producción,
   MCP, gastos, modelos API. No regresiones npm/controller/grafo en esta autoría
   de pruebas; se ejecutaron checks dirigidos y sintaxis.

Faltan1–4 para sostener freeze íntegro con cobertura de seguridad amplia. Conservar
los rojos y revisar el examen; no relajar contratos para aceptar el banco parcial.
