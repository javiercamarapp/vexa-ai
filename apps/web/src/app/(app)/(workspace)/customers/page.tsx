import {redirect} from 'next/navigation';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.customers');
/** No hay lista de clientes: el historial de un cliente se abre desde la ficha de un problema (/customers/[id]). */
export default function Page(){redirect('/problems');}
