import {redirect} from 'next/navigation';
import {AccessError} from '../auth';

/** Misma resolución de acceso que el layout del espacio de trabajo, para las páginas que leen la sesión por su cuenta.
 *  Next renderiza layout y página en paralelo: sin esto, un visitante sin sesión hace que la página lance `authentication_required`
 *  (401) y quede registrado como error de servidor aunque el layout lo mande a /login. 401 -> /login, 403 -> /sin-acceso; cualquier otro error se propaga. */
export async function conRedireccionDeAcceso<T>(leer: () => Promise<T>): Promise<T> {
  try { return await leer(); }
  catch (error) {
    if (error instanceof AccessError) {
      if (error.status === 401) redirect('/login');
      if (error.status === 403) redirect('/sin-acceso');
    }
    throw error;
  }
}
