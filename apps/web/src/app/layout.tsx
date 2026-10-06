import Link from "next/link";
import {VexaBrand} from "../components/vexa-brand";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./fonts.css";
import "./globals.css";
import "./task-layout.css";

export const metadata: Metadata = {
  title: "Rovaq AI",
  description: "Rovaq AI · Decisiones con evidencia para tu equipo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <header className="site-header">
          <Link className="wordmark" href="/" aria-label="Rovaq AI, inicio"><VexaBrand/></Link>
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
