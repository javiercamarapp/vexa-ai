import Link from "next/link";
import {RovaqLogo} from "../../components/rovaq-logo";
import {ArranqueLimpio} from "../../components/arranque-limpio";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import {SITE,siteUrl} from "../../lib/site.mjs";
import {idiomaActual} from "../../lib/i18n/servidor";
import "./fonts.css";
import "./globals.css";
import "./task-layout.css";
import "./ui.css";
import "../../components/ui/ui.css";
import "../../components/ui/overlay.css";

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
// Arranque limpio: en carga/recarga de pantallas del espacio de trabajo solo se ve el logo animado hasta que todo esté listo. Aplica también a /login y /auth (en una primera visita en frío el encabezado del sitio y su texto se veían unos segundos antes de que montara la pantalla de acceso);
// no aplica a las páginas públicas donde el encabezado es parte del diseño (inicio sin sesión, plataforma). Seguro propio de 60 s solo por si React nunca hidrata (sin ArranqueLimpio vivo) (la suelta normal la decide ArranqueLimpio leyendo el DOM).
const ARRANQUE_ANTES_DEL_PINTADO = "(function(){try{if(/^\\/(platform|landing)(\\/|$)|^\\/$/.test(location.pathname))return;var d=document.documentElement;d.dataset.arranque='1';setTimeout(function(){if(!window.__arranqueVivo)d.removeAttribute('data-arranque');},60000);}catch(e){}})();";

// Critical first-paint styles travel with the HTML, before any streamed body or CSS chunk.
// Keep the boot screen usable even when external stylesheets arrive late on a cold visit.
const ARRANQUE_CSS_CRITICO = `
#arranque-logo{display:none}
html[data-arranque],html[data-arranque] body{margin:0;background:#fff}
html[data-arranque][data-theme=dark],html[data-arranque][data-theme=dark] body{background:#0e0e10}
html[data-arranque] body>:not(#arranque-logo){display:none!important}
html[data-arranque] #arranque-logo{display:flex;position:fixed;inset:0;z-index:2000;align-items:center;justify-content:center;background:#fff;opacity:1;visibility:visible}
html[data-arranque][data-theme=dark] #arranque-logo{background:#0e0e10}
body:has(.rovaq-cargando:not(.rovaq-cargando-compacto)) :is(.site-header,.site-footer,.skip-link){display:none!important}
body:has(:is(.login,.access-selection,.access-invitacion,.workspace-shell)) :is(.site-header,.site-footer,.skip-link){display:none!important}
body:has(.access-selection) .rovaq-cargando{min-height:100dvh;width:100%;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
.rovaq-cargando:not(.rovaq-cargando-compacto){min-height:100dvh;width:100%;display:flex;align-items:center;justify-content:center;box-sizing:border-box}
#arranque-logo .rovaq-logo{display:inline-flex;line-height:0}
#arranque-logo svg{display:block}
html[data-theme=dark] #arranque-logo .rovaq-logo-tinta{fill:#fff}
@keyframes rovaq-arranque-respira{0%,100%{opacity:.35;transform:scale(.985)}50%{opacity:1;transform:scale(1)}}
html[data-arranque] #arranque-logo .rovaq-respira{animation:rovaq-arranque-respira 1.6s cubic-bezier(.22,1,.36,1) infinite}
@media(prefers-reduced-motion:reduce){html[data-arranque] #arranque-logo .rovaq-respira{animation:none;opacity:.6}}
`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // <html lang> sigue al idioma activo (cookie rovaq_lang, inglés por omisión), no a uno fijo. El sitio público tiene su propia raíz con lang estático.
  const idioma = await idiomaActual();
  return (
    <html lang={idioma} suppressHydrationWarning>
      <head><style id="arranque-estilos-criticos">{ARRANQUE_CSS_CRITICO}</style><script dangerouslySetInnerHTML={{ __html: TEMA_ANTES_DEL_PINTADO }} /><script dangerouslySetInnerHTML={{ __html: ARRANQUE_ANTES_DEL_PINTADO }} /><noscript><style>{"html[data-arranque] .site-header,html[data-arranque] .site-footer,html[data-arranque] main{display:revert!important}#arranque-logo{display:none!important}"}</style></noscript></head>
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
