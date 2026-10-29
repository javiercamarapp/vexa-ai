// Contrato K9: <Mock id="m1".."m6" lang="es|en" /> con rótulo siempre visible, texto alternativo y sin style.
// Componente de servidor. variante: completo (por defecto), apoyo (440 por 260, paso de la escena) o miniatura (352 por 220, tarjeta de las seis
// pantallas, sin rojo). Todo lo que se dibuja sale de datos.ts.
import type {IdMock, Lang} from './datos';
import {T, UI} from './datos';
import {M1, M2, M3} from './pantallas-a';
import {M4, M5, M6} from './pantallas-b';
import {Ventana} from './piezas';
import type {Variante} from './piezas';

const PANTALLAS = {m1: M1, m2: M2, m3: M3, m4: M4, m5: M5, m6: M6} as const;

export type MockProps = {id: IdMock; lang: Lang; variante?: Variante};

export function Mock({id, lang, variante = 'completo'}: MockProps) {
  const Pantalla = PANTALLAS[id];
  if (!Pantalla) throw new Error(`MOCK_DESCONOCIDO: ${String(id)}`);
  const t = T(lang);
  return (
    <Ventana id={id} variante={variante} ruta={UI(lang).rutas[id]} org={t.organizacion} alt={t[id].alt} rotulo={t.rotulo}>
      <Pantalla lang={lang} variante={variante} />
    </Ventana>
  );
}

export {IDS_MOCK} from './datos';
export type {IdMock, Lang} from './datos';
export type {Variante} from './piezas';
