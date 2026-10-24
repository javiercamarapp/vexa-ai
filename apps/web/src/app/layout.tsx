import Link from "next/link";
import {RovaqLogo} from "../components/rovaq-logo";
import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./fonts.css";
import "./globals.css";
import "./task-layout.css";
import "./ui.css";
import "../components/ui/ui.css";
import "../components/ui/overlay.css";

export const metadata: Metadata = {
  title: {default:"Rovaq AI",template:"%s · Rovaq AI"},
  description: "Rovaq AI · Decisiones con evidencia para tu equipo.",
  robots: { index: false, follow: false },
  // Kit de logotipo de Rovaq: favicon completo + manifiesto (public/). El ícono SVG ya trae el fondo negro de marca, así que sirve igual en pestañas claras y oscuras.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
};
export const viewport: Viewport = { themeColor: "#0E0E10" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
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
