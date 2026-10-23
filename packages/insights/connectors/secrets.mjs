// Los conectores NUNCA llevan secretos en código ni en su configuración: solo una REFERENCIA «secret://nombre» a un almacén (Vault de Supabase, variables del servidor, etc.).
// El almacén se inyecta en tiempo de ejecución; aquí solo se valida la referencia y se resuelve sin registrar el valor.
export const SECRET_REF = /^secret:\/\/[a-z0-9][a-z0-9_.-]{0,78}$/;
export function assertSecretRef(ref) {
  if (typeof ref !== 'string' || !SECRET_REF.test(ref)) throw Object.assign(Error('SECRET_REF_INVALID'), {code: 'SECRET_REF_INVALID'});
  return ref;
}
/** store = {get(name): Promise<string|undefined>}. El valor devuelto no se guarda ni se imprime; los errores no lo incluyen. */
export function createSecretResolver(store) {
  return Object.freeze({
    async resolve(ref) {
      assertSecretRef(ref);
      const v = typeof store?.get === 'function' ? await store.get(ref.slice('secret://'.length)) : undefined;
      if (typeof v !== 'string' || !v) throw Object.assign(Error('SECRET_UNAVAILABLE'), {code: 'SECRET_UNAVAILABLE'});
      return v;
    },
  });
}
/** Transporte por defecto de los esqueletos: NO hay llamadas a APIs reales hasta que Javier autorice y se inyecte uno. */
export const transportApagado = Object.freeze({async request() { throw Object.assign(Error('EXTERNAL_CALLS_DISABLED'), {code: 'EXTERNAL_CALLS_DISABLED'}); }});
