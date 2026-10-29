// Pie del sitio (T7): cinco columnas del registro, línea de marca, rótulo legal solo si se resolvió y la marca gigante recortada.
// El pie va en el flujo normal, sin espaciador ni barrido: el tema global deja las secciones sin fondo propio.
import {LogoSitio} from '../logo-sitio';
import {columnasPie, lineasPie, textosShell} from './datos';
import type {Lang} from './datos';

export function Pie({lang}: {lang: Lang}) {
  const t = textosShell(lang);
  const columnas = columnasPie(lang);
  const l = lineasPie(lang);
  return (
    <>
      <footer className="s-pie" data-tema="oscuro" aria-label={t.pie}>
        <div className="s-pie__cuerpo s-contenedor">
          <div className="s-pie__cols">
            {columnas.map((c) => (
              <div className="s-pie__col" key={c.titulo}>
                <h2 className="s-pie__titulo">{c.titulo}</h2>
                <ul className="s-pie__enlaces">
                  {c.items.map((it) => (
                    <li key={it.href}>
                      <a className="s-enlace" href={it.href}>{it.titulo}</a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="s-pie__legal s-mono-min">
            {l.linea}
            {l.derechos ? <> {l.derechos}</> : null}
            {l.revision ? <> {l.revision}</> : null}
          </p>
        </div>
        <LogoSitio variante="pie" />
      </footer>
    </>
  );
}
