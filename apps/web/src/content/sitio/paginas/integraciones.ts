// Integraciones y Hoja de ruta (T11). Fuente: landing/producto/02-DATOS-IA-INTEGRACIONES.md, posicionamiento 6.5 y 6.6.
// Los nombres de marketplaces van solo como texto. Sin fechas, sin Zendesk, sin triple análisis.
import type { Pagina } from '../tipos.ts';
import { b, m } from '../ayudas.ts';
import { LANDING } from '../landing.ts';

export const INTEGRACIONES: Pagina = {
  id: 'integraciones',
  estado: 'pendiente-de-revision',
  pendiente: 'Revisión de Responsable A. Condiciones 5, 8 y 9: corridas exitosas del cron de HubSpot, exportes de marketplaces con ayuda del equipo y HubSpot acreditado sobre una muestra.',
  seo: {
    titulo: b('Integraciones | Qué se conecta hoy y qué viene después', 'Integrations | What Connects Today and What Comes Next'),
    descripcion: b(
      'Qué se conecta hoy con Rovaq AI: HubSpot en solo lectura y archivos de Excel y CSV con vista previa. Amazon, Walmart y Shopify siguen en la hoja de ruta.',
      'What connects to Rovaq AI today: HubSpot read-only, and Excel and CSV files with a preview. Amazon, Walmart and Shopify remain on the roadmap.',
    ),
  },
  h1: b('Integraciones: qué se conecta hoy y qué viene', 'Integrations: what connects today and what comes next'),
  subtitulo: LANDING.integraciones.subtitulo,
  bloques: [
    { tipo: 'tarjetas', titulo: LANDING.integraciones.hoyEtiqueta, items: LANDING.integraciones.hoy },
    { tipo: 'lista', titulo: LANDING.integraciones.rutaEtiqueta, items: LANDING.integraciones.ruta },
    {
      tipo: 'lista',
      titulo: b('Cómo cargar un exporte de marketplace', 'How to load a marketplace export'),
      items: [
        m(
          8,
          'Hoy no hay carga de autoservicio para los exportes de marketplaces; entran con ayuda del equipo.',
          b('Descarga el exporte de pedidos y reembolsos desde tu marketplace y compártelo con nuestro equipo.', 'Download the order and refund export from your marketplace and share it with our team.'),
        ),
        b('El archivo se revisa con una vista previa y se valida antes de ingerir.', 'The file is reviewed with a preview and validated before ingesting.'),
        b('Cada registro conserva su fuente, su fecha de lectura y su huella de contenido.', 'Every record keeps its source, its read date and its content fingerprint.'),
      ],
    },
    { tipo: 'texto', titulo: b('Frente a tu herramienta de soporte', 'Next to your support tool'), texto: LANDING.integraciones.posicion },
  ],
  cta: b('Solicitar acceso e indicar tus herramientas', 'Request access and list your tools'),
};

export const HOJA_DE_RUTA: Pagina = {
  id: 'hoja-de-ruta',
  estado: 'pendiente-de-revision',
  pendiente: 'Revisión de Responsable A. Lista de dirección, no una promesa de entrega; se omiten a propósito fechas, Zendesk y el triple análisis.',
  seo: {
    titulo: b('Hoja de ruta | Hacia dónde va Rovaq AI, sin fechas', 'Roadmap | Where Rovaq AI Is Heading, Without Dates'),
    descripcion: b(
      'La dirección del producto sin fechas ni compromisos: conectores directos de marketplaces, verificación en dos pasos y más. Puede cambiar con el uso real.',
      'The product direction without dates or commitments: direct marketplace connectors, two-step verification and more. It may change as we learn from real use.',
    ),
  },
  h1: b('Hoja de ruta: hacia dónde va Rovaq AI', 'Roadmap: where Rovaq AI is heading'),
  subtitulo: b(
    'Una lista de dirección y no una promesa de entrega. Puede cambiar, y lo que cambie se dirá aquí.',
    'A list of direction and not a promise of delivery. It may change, and any change will be stated here.',
  ),
  bloques: [
    {
      tipo: 'lista',
      titulo: b('Fuentes', 'Sources'),
      items: [
        b('Conectores directos con Amazon, Walmart y Shopify, planeados. Hoy se cargan sus exportes.', 'Direct connectors for Amazon, Walmart and Shopify, planned. Today their exports are loaded.'),
        b('Mapa de problemas completo por dirección de envío, que requiere esos conectores, planeado.', 'A full problem map by shipping address, which requires those connectors, planned.'),
      ],
    },
    {
      tipo: 'lista',
      titulo: b('Seguridad', 'Security'),
      items: [
        b('Verificación en dos pasos para administradores del espacio, planeada.', 'Two-step verification for workspace administrators, planned.'),
        b('Política de contenido estricta, en endurecimiento.', 'Strict content security policy, being hardened.'),
        b('Vista de auditoría para el cliente, planeada.', 'Customer-facing audit view, planned.'),
        b('Prueba de penetración externa, planeada.', 'External penetration test, planned.'),
        b('Recuperación a un punto en el tiempo, bajo petición de clientes.', 'Point-in-time recovery, on customer request.'),
        b('Certificaciones, bajo petición de clientes.', 'Certifications, on customer request.'),
      ],
    },
    {
      tipo: 'lista',
      titulo: b('Producto', 'Product'),
      items: [
        b('Reporte semanal configurable, planeado.', 'Configurable weekly report, planned.'),
        b('Medición continua de la calidad de la IA, planeada.', 'Continuous measurement of AI quality, planned.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Cómo leer esta página', 'How to read this page'),
      texto: b(
        'Los estados permitidos son Planeado, En endurecimiento y Bajo petición. No hay fechas comprometidas. Lo que existe hoy está en Seguridad y privacidad e Integraciones.',
        'The allowed statuses are Planned, Being hardened and On request. There are no committed dates. What exists today is in Security and privacy and Integrations.',
      ),
    },
  ],
  cta: b('Contarnos qué necesitas primero', 'Tell us what you need first'),
};
