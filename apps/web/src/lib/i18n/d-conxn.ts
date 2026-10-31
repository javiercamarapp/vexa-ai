// Textos de interfaz (conxn): clave -> español / inglés. es.ts y en.ts los incorporan; test:i18n exige las mismas claves y {variables}.
export const conxnEs = {
  'conx.n.soloProp': 'Sólo una persona administradora del espacio puede configurar los envíos de la organización.',
} as const;
export const conxnEn: Record<keyof typeof conxnEs, string> = {
  'conx.n.soloProp': 'Only a workspace administrator can configure the organization’s deliveries.',
};
