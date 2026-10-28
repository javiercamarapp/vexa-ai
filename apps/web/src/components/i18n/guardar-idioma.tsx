'use client';
import {useEffect} from 'react';
import {guardarIdiomaEnNavegador, type Idioma} from '../../lib/i18n';
/** Login: cuando el idioma viene de ?lang=, lo guarda en la cookie compartida con la app autenticada. No renderiza nada. */
export function GuardarIdioma({idioma, explicito}: {idioma: Idioma; explicito: boolean}) {
  useEffect(() => { if (explicito) guardarIdiomaEnNavegador(idioma); }, [idioma, explicito]);
  return null;
}
