// Estado (T24). Fuente: SEO 02-PLAN-POR-URL-DETALLE fila 23. La página es estática: no lee la versión en vivo.
// Decisión: /api/health/version solo atestigua la identidad de la compilación (meta.state build-identity-only), no que el servicio funcione, y mostrar
// su valor exigiría JavaScript de cliente en una página estática sin poder verificarlo en navegador aquí. Por eso la página explica qué se publica
// y dónde consultarlo, y no renderiza el valor. El correo de reportes sale de [CORREO_DE_CONTACTO], la misma configuración que usa solicitar-acceso.
import type { Pagina } from '../tipos.ts';
import { b } from '../ayudas.ts';

export const ESTADO: Pagina = {
  id: 'estado',
  estado: 'publicable',
  seo: {
    titulo: b('Estado del servicio | Versión y reporte de problemas', 'Service Status | Deployed Version and Problem Reports'),
    descripcion: b(
      'Cómo identificar la versión desplegada de Rovaq AI y cómo reportar un problema. No es un acuerdo de nivel de servicio ni una promesa de disponibilidad.',
      'How to identify the deployed version of Rovaq AI and how to report a problem. This page is not an availability commitment or a service level agreement.',
    ),
  },
  h1: b('Estado del servicio', 'Service status'),
  subtitulo: b(
    'Cómo saber qué versión está desplegada y cómo reportar un problema. No es un compromiso de disponibilidad.',
    'How to tell which version is deployed and how to report a problem. It is not an availability commitment.',
  ),
  bloques: [
    {
      tipo: 'texto',
      titulo: b('Qué publicamos aquí', 'What we publish here'),
      texto: b(
        'El servicio expone un identificador público de la versión desplegada: el número de versión y el identificador de la compilación. Se consulta en la dirección rovaq.ai/api/health/version. Esta página es estática y no muestra ese valor en vivo; el identificador solo dice qué compilación está en uso y no dice si cada parte del servicio está funcionando.',
        'The service exposes a public identifier of the deployed version: the version number and the build identifier. You can read it at rovaq.ai/api/health/version. This page is static and does not show that value live; the identifier only says which build is in use and does not say whether each part of the service is working.',
      ),
    },
    {
      tipo: 'lista',
      titulo: b('Qué no es esta página', 'What this page is not'),
      items: [
        b('No es un acuerdo de nivel de servicio ni un compromiso de disponibilidad.', 'It is not a service level agreement or an availability commitment.'),
        b('No es un monitor en vivo ni un historial de incidentes. No publicamos porcentajes de disponibilidad ni tiempos de respuesta.', 'It is not a live monitor or an incident history. We do not publish availability percentages or response times.'),
        b('No sustituye la pantalla de Confianza de los datos, que dentro del producto dice hasta qué fecha llegan tus datos, qué cubren y qué no se sabe.', 'It does not replace the Data trust screen, which inside the product says what date your data reaches, what it covers and what is not known.'),
      ],
    },
    {
      tipo: 'texto',
      titulo: b('Cómo reportar un problema', 'How to report a problem'),
      texto: b(
        'Para reportar un problema, escribe a [CORREO_DE_CONTACTO]. Esta página no fija un tiempo de respuesta.',
        'To report a problem, write to [CONTACT_EMAIL]. This page does not set a response time.',
      ),
    },
    {
      tipo: 'lista',
      titulo: b('Qué incluir en el reporte', 'What to include in the report'),
      items: [
        b('La pantalla donde ocurrió y qué esperabas ver.', 'The screen where it happened and what you expected to see.'),
        b('Lo que pasó en su lugar, con la hora aproximada y tu zona horaria.', 'What happened instead, with the approximate time and your time zone.'),
        b('La versión que muestra rovaq.ai/api/health/version, si la consultaste.', 'The version shown at rovaq.ai/api/health/version, if you checked it.'),
        b('Ninguna contraseña ni datos personales de tus clientes: no los necesitamos para entender el problema.', 'No passwords and no personal data of your customers: we do not need them to understand the problem.'),
      ],
    },
  ],
};
