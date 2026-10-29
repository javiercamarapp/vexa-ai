import type {ReactNode} from 'react';
import {metaTitulo} from '../../../../../lib/i18n/titulo';
export const generateMetadata=()=>metaTitulo('meta.titulo.notifications-push');
export default function Layout({children}:{children:ReactNode}){return children;}
