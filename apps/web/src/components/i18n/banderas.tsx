import {useId} from 'react';
/** Banderas circulares de 16 px, dibujadas como SVG (sin emojis: no se ven en Windows) y sin estilos en línea (CSP). Español = México, inglés = Estados Unidos. */
export function Bandera({idioma}: {idioma: 'es' | 'en'}) {
  const id = useId().replace(/:/g, '');
  const clip = `bandera-${id}`;
  return <svg className="idioma-bandera" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <defs><clipPath id={clip}><circle cx="8" cy="8" r="8" /></clipPath></defs>
    <g clipPath={`url(#${clip})`}>
      {idioma === 'es' ? <>
        <rect width="5.34" height="16" x="0" fill="#006847" />
        <rect width="5.34" height="16" x="5.33" fill="#ffffff" />
        <rect width="5.34" height="16" x="10.66" fill="#ce1126" />
        <circle cx="8" cy="8" r="1.9" fill="none" stroke="#8a6a2f" strokeWidth="0.8" />
        <circle cx="8" cy="8" r="0.75" fill="#6b8e3a" />
      </> : <>
        <rect width="16" height="16" fill="#ffffff" />
        {[0, 1, 2, 3, 4, 5, 6].map(n => <rect key={n} x="0" y={n * 2.3} width="16" height="1.15" fill="#b22234" />)}
        <rect width="8" height="9.2" fill="#3c3b6e" />
        {[[2, 2], [4, 2], [6, 2], [3, 4], [5, 4], [2, 6], [4, 6], [6, 6], [3, 8], [5, 8]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y - 0.3} r="0.38" fill="#ffffff" />)}
      </>}
    </g>
    <circle cx="8" cy="8" r="7.75" fill="none" stroke="#00000026" strokeWidth="0.5" />
  </svg>;
}
