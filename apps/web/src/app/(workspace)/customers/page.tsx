import {redirect} from 'next/navigation';
export const metadata={title:'Clientes'};
/** No hay lista de clientes: el historial de un cliente se abre desde la ficha de un problema (/customers/[id]). */
export default function Page(){redirect('/problems');}
