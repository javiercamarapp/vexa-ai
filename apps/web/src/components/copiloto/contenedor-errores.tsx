'use client';
import {Component, type ReactNode} from 'react';
/** Contiene un fallo de dibujo dentro de un bloque (el briefing) para que el resto de la pantalla, incluido el chat, siga funcionando. */
export class ContenedorErrores extends Component<{children: ReactNode; alFallar: ReactNode}, {fallo: boolean}> {
  state = {fallo: false};
  static getDerivedStateFromError() { return {fallo: true}; }
  componentDidCatch(e: unknown) { if (typeof console !== 'undefined') console.error('[briefing]', e instanceof Error ? e.message : 'fallo de dibujo'); }
  render() { return this.state.fallo ? this.props.alFallar : this.props.children; }
}
