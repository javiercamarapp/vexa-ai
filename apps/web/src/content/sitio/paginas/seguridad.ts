// Seguridad y privacidad (T11). Fuente: landing/producto/03-SEGURIDAD-CONFIANZA.md sección 5 y la portada.
// Pendiente de revisión de Responsable A y de un abogado. El contacto de seguridad y la fecha usan marcadores que no se resuelven todavía,
// así que esas hojas no se publican. Sin certificaciones, sin cifras de tablas ni de pruebas, sin auditoría interna.
import type { Pagina } from '../tipos.ts';
import { b, m } from '../ayudas.ts';
import { LANDING } from '../landing.ts';

export const SEGURIDAD: Pagina = {
  id: 'seguridad-y-privacidad',
  estado: 'pendiente-de-revision',
  pendiente: 'Revisión de Responsable A y de un abogado. Condiciones 1 y 12: falta un buzón de seguridad que reciba correo y la fecha de revisión. La verificación de producción de las cabeceras reales sigue abierta.',
  seo: {
    titulo: b('Seguridad y privacidad | Prácticas existentes y brechas', 'Security and Privacy | Existing Practices and Declared Gaps'),
    descripcion: b(
      'Prácticas verificadas y brechas declaradas: aislamiento por organización, cuatro roles y conexiones de lectura. Sin certificaciones que no tenemos.',
      'Verified practices and declared gaps: isolation per organization, four roles and read-only connections. No certifications we do not hold, no empty claims.',
    ),
  },
  h1: b('Seguridad y privacidad: prácticas existentes y brechas declaradas', 'Security and privacy: existing practices and declared gaps'),
  subtitulo: b(
    'Una lista corta de prácticas y otra de brechas, dichas de frente, con la fecha de la última revisión.',
    'A short list of practices and another of gaps, stated plainly, with the date of the last review.',
  ),
  bloques: [
    {
      tipo: 'texto',
      titulo: b('Cómo lo pensamos', 'How we think about it'),
      texto: b(
        'Rovaq trabaja con conversaciones de soporte y con datos de ingreso de tu negocio. Por eso cada organización queda separada de las demás, la autorización se decide siempre en el servidor y lo que no sabemos se dice como tal.',
        'Rovaq works with support conversations and revenue data from your business. That is why each organization stays separate from the others, authorization is always decided on the server, and what we do not know is stated as such.',
      ),
    },
    { tipo: 'lista', titulo: LANDING.seguridad.hayEtiqueta, items: LANDING.seguridad.hay },
    {
      tipo: 'texto',
      titulo: b('Datos personales', 'Personal data'),
      texto: m(
        11,
        'Misma materia que la pregunta de datos personales con IA del FAQ y la fila de anonimización de los límites: revisión de Responsable A y de un abogado.',
        b(
          'Las conversaciones se guardan con una versión redactada, separada de la original. Redactar no equivale a anonimizar, y por eso no decimos que tus datos estén anonimizados.',
          'Conversations are stored with a redacted version, separate from the original. Redaction is not anonymization, and that is why we do not say your data is anonymized.',
        ),
        { req: ['responsable_a', 'abogado'] },
      ),
    },
    {
      tipo: 'texto',
      titulo: b('Retención y borrado', 'Retention and deletion'),
      texto: b(
        'Cada organización puede definir políticas de retención. Antes de borrar, la pantalla muestra el alcance exacto y no borra nada todavía. El borrado no elimina el origen de los datos en tu herramienta ni las copias que mantengas fuera de Rovaq.',
        'Each organization can define retention policies. Before deleting, the screen shows the exact scope and deletes nothing yet. Deletion does not remove the source data in your tool or copies you keep outside Rovaq.',
      ),
    },
    { tipo: 'lista', titulo: LANDING.seguridad.noHayEtiqueta, items: LANDING.seguridad.noHay },
    {
      tipo: 'lista',
      titulo: b('Hoja de ruta', 'Roadmap'),
      items: [
        b('Verificación en dos pasos para propietarios, planeada.', 'Two-step verification for owners, planned.'),
        b('Una política de contenido estricta, en endurecimiento.', 'A strict content security policy, being hardened.'),
        b('Una vista de auditoría para el cliente, planeada.', 'A customer-facing audit view, planned.'),
        b('Una prueba de penetración externa, planeada.', 'An external penetration test, planned.'),
        b('Recuperación a un punto en el tiempo y certificaciones, solo bajo petición de clientes.', 'Point-in-time recovery and certifications, on customer request only.'),
        b('No publicamos fechas hasta que podamos cumplirlas.', 'We do not publish dates until we can meet them.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Reportar una vulnerabilidad', 'Report a vulnerability'),
      texto: b(
        'No incluyas datos reales de clientes ni credenciales. Confirmaremos la recepción, evaluaremos la gravedad y atenderemos primero lo que afecte el aislamiento entre organizaciones o la exposición de datos personales. No perseguimos a quien reporta de buena fe.',
        'Do not include real customer data or credentials. We will acknowledge receipt, assess severity and address first anything that affects isolation between organizations or exposure of personal data. We do not pursue good-faith reporters.',
      ),
    },
    { tipo: 'texto', titulo: b('Contacto', 'Contact'), texto: LANDING.seguridad.contactoSeguridad },
    { tipo: 'texto', titulo: b('Fecha de revisión', 'Review date'), texto: LANDING.seguridad.fecha },
  ],
  cta: b('Solicitar acceso', 'Request access'),
};
