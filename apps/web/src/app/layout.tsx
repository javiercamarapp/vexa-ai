import Link from "next/link";
import {RovaqLogo} from "../components/rovaq-logo";
import {ArranqueLimpio} from "../components/arranque-limpio";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {SITE,siteUrl} from "../lib/site.mjs";
import "./fonts.css";
import "./globals.css";
import "./task-layout.css";
import "./ui.css";
import "../components/ui/ui.css";
import "../components/ui/overlay.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: {default:SITE.titulo,template:"%s · Rovaq AI"},
  description: SITE.descripcion,
  applicationName: SITE.nombre,
  keywords: [...SITE.palabrasClave],
  authors: [{name:SITE.nombre}],
  creator: SITE.nombre,
  publisher: SITE.nombre,
  category: SITE.categoria,
  alternates: {canonical:"/"},
  // Por defecto las páginas públicas se indexan; el espacio de trabajo, /platform, /auth, /seguridad y /sin-acceso declaran noindex en su propio segmento y por cabecera X-Robots-Tag (next.config.ts).
  robots: {index:true,follow:true,googleBot:{index:true,follow:true,"max-image-preview":"large","max-snippet":-1}},
  openGraph: {type:"website",locale:SITE.locale,siteName:SITE.nombre,title:SITE.titulo,description:SITE.descripcion,url:"/",images:[{url:"/opengraph-image",width:SITE.og.ancho,height:SITE.og.alto,alt:SITE.og.alt,type:"image/png"}]},
  twitter: {card:"summary_large_image",title:SITE.titulo,description:SITE.descripcion,images:[{url:"/twitter-image",width:SITE.og.ancho,height:SITE.og.alto,alt:SITE.og.alt}]},
  // Kit de logotipo de Rovaq: favicon completo + manifiesto (public/). El ícono SVG ya trae el fondo negro de marca, así que sirve igual en pestañas claras y oscuras.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: "/favicon.ico" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  appleWebApp: { capable: true, title: "Rovaq", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
};
// viewport-fit=cover habilita env(safe-area-inset-*); «resizes-content» hace que el teclado encoja el viewport en Android (iOS se maneja con visualViewport).
export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", colorScheme: "light dark", interactiveWidget: "resizes-content",
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#0e0e10" }],
};
// Aplica el tema guardado ANTES del primer pintado (sin destello claro->oscuro). Solo con preferencia guardada; fuera de /login y /auth.
const TEMA_ANTES_DEL_PINTADO = "(function(){try{if(/^\\/(login|auth)/.test(location.pathname))return;var s=localStorage.getItem('vexa-theme');var d=s==='dark'||(s==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);if(s==='light'||s==='system'||s==='dark'){document.documentElement.dataset.theme=d?'dark':'light';var m=document.querySelectorAll('meta[name=theme-color]');for(var i=0;i<m.length;i++)m[i].setAttribute('content',d?'#0e0e10':'#ffffff');}}catch(e){}})();";
// Arranque limpio: en carga/recarga de pantallas del espacio de trabajo solo se ve el logo animado hasta que todo esté listo. No aplica a /login, /auth ni a las páginas públicas
// donde el encabezado es parte del diseño (inicio sin sesión, invitaciones, plataforma). Seguro propio de 20 s por si React nunca hidrata (la suelta normal la decide ArranqueLimpio leyendo el DOM).
const ARRANQUE_ANTES_DEL_PINTADO = "(function(){try{if(/^\\/(login|auth|platform)(\\/|$)|^\\/$/.test(location.pathname))return;var d=document.documentElement;d.dataset.arranque='1';setTimeout(function(){d.removeAttribute('data-arranque');},20000);}catch(e){}})();";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DEL_PINTADO }} /><script dangerouslySetInnerHTML={{ __html: ARRANQUE_ANTES_DEL_PINTADO }} /><noscript><style>{"html[data-arranque] .site-header,html[data-arranque] .site-footer,html[data-arranque] main{display:revert!important}#arranque-logo{display:none!important}"}</style></noscript></head>
      <body>
        <div id="arranque-logo" aria-hidden="true"><RovaqLogo variante="horizontal" ancho={140} className="rovaq-respira" decorativo espacioLibre={false}/></div>
        <ArranqueLimpio/>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <header className="site-header">
          <Link prefetch={false} className="brand-link" href="/" aria-label="Rovaq, inicio"><RovaqLogo variante="horizontal" ancho={120} decorativo/></Link>
          <span className="site-purpose">Decisiones con evidencia</span>
        </header>
        <main id="contenido" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <span>Rovaq AI</span>
        </footer>
      </body>
    </html>
  );
}
