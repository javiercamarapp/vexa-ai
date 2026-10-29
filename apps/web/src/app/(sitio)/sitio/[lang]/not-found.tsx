// 404 del sitio público, en los dos idiomas porque no-encontrada no recibe el idioma. noindex: un 404 no se indexa.
import Link from 'next/link';

export const metadata = {title: {absolute: 'Página no encontrada | Rovaq AI'}, robots: {index: false, follow: true}};

export default function NoEncontrada() {
  return (
    <main>
      <h1>No encontramos esta página</h1>
      <p><Link prefetch={false} href="/">Ir al inicio</Link></p>
      <p lang="en">Page not found. <Link prefetch={false} href="/en" hrefLang="en">Go to the English site</Link>.</p>
    </main>
  );
}
