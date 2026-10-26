import './login.css';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {jsonLd,metadatosPublicos,siteUrl} from '../../lib/site.mjs';
/** /login es la página pública de entrada: se indexa, con canonical, Open Graph y datos estructurados (Organization + SoftwareApplication). */
export const metadata:Metadata=metadatosPublicos({titulo:'Iniciar sesión',ruta:'/login'});
export default function LoginLayout({children}:{children:ReactNode}){
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd(siteUrl())).replace(/</g,'\\u003c')}}/>{children}</>;
}
