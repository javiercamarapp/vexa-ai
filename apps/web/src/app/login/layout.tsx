import './login.css';
import type {Metadata} from 'next';
import type {ReactNode} from 'react';
import {jsonLd,metadatosPublicos,siteUrl} from '../../lib/site.mjs';
import {traducir} from '../../lib/i18n';
import {idiomaActual} from '../../lib/i18n/servidor';
/** /login es la página pública de entrada: se indexa, con canonical, Open Graph y datos estructurados (Organization + SoftwareApplication). */
export async function generateMetadata():Promise<Metadata>{
 return metadatosPublicos({titulo:traducir(await idiomaActual(),'meta.titulo.login'),ruta:'/login'});
}
export default function LoginLayout({children}:{children:ReactNode}){
 return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(jsonLd(siteUrl())).replace(/</g,'\\u003c')}}/>{children}</>;
}
