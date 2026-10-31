// Traducción grupo L (T48): selector «Idioma del documento» de los documentos que se envían a un tercero (paquete de evidencia, mensaje de reclamo, borradores).
// El idioma del DOCUMENTO lo elige quien lo genera y puede ser distinto del de la pantalla. tests/i18n.test.ts exige las mismas claves y {variables} en ES y EN.
export const trLEs = {
  'tr.doc.idioma': 'Idioma del documento',
  'tr.doc.nota': 'Los archivos se generan en este idioma, aunque la pantalla esté en otro. Cambiarlo regenera el borrador.',
} as const;
export const trLEn = {
  'tr.doc.idioma': 'Document language',
  'tr.doc.nota': 'The files are generated in this language, even if the screen is in another one. Changing it regenerates the draft.',
} as const;
