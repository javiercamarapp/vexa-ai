import type {ReactNode} from 'react';
import {ROBOTS_PRIVADO} from '../../../../lib/site.mjs';
import {metaTitulo} from '../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.auth-invitations',{robots:ROBOTS_PRIVADO});
export default function Layout({children}:{children:ReactNode}){return children;}
