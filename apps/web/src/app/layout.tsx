import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "VEXA AI",
  description: "VEXA AI · Decisiones con evidencia para tu equipo.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>
        <a className="skip-link" href="#contenido">Saltar al contenido</a>
        <header className="site-header">
          <Link className="wordmark" href="/" aria-label="VEXA, inicio">VEXA<span aria-hidden="true">.</span></Link>
          <span className="status">En construcción</span>
        </header>
        <main id="contenido" tabIndex={-1}>{children}</main>
        <footer className="site-footer">
          <span>VEXA</span>
        </footer>
      </body>
    </html>
  );
}
