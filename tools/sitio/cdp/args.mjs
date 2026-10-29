// Lector mínimo de argumentos: --clave valor, --bandera, --clave=valor.
export function leerArgs(argv = process.argv.slice(2)) {
  const o = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      o._.push(a);
      continue;
    }
    const eq = a.indexOf('=');
    if (eq > 0) {
      o[a.slice(2, eq)] = a.slice(eq + 1);
      continue;
    }
    const k = a.slice(2);
    const sig = argv[i + 1];
    if (sig !== undefined && !sig.startsWith('--')) {
      o[k] = sig;
      i++;
    } else o[k] = true;
  }
  return o;
}
export const lista = (v, def) => (v === undefined || v === true ? def : String(v).split(',').map((s) => s.trim()).filter(Boolean));
