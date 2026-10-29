// Acerca y Solicitar acceso (T11). Fuente: posicionamiento 6.7 y 6.8. Acerca va sin nombres, sin clientes, sin domicilio y sin tracción.
import type { Pagina } from '../tipos.ts';
import { b } from '../ayudas.ts';
import { LANDING } from '../landing.ts';

export const ACERCA: Pagina = {
  id: 'acerca',
  estado: 'pendiente-de-revision',
  pendiente: 'Revisión de Javier y de Responsable A. Sin nombres de personas, sin clientes, sin domicilio y sin tracción hasta que lo decidan.',
  seo: {
    titulo: b('Acerca de Rovaq AI | Tres principios guían el producto', 'About Rovaq AI | Three Principles Guide the Product'),
    descripcion: b(
      'Tres principios guían a Rovaq AI: cada cifra dice su origen, lo que no se sabe no cuenta como cero y una persona decide cada acción. Así construimos.',
      'Three principles guide Rovaq AI: every figure states its origin, what is unknown never counts as zero and a person decides every action. How we build.',
    ),
  },
  h1: b('Acerca de Rovaq AI: tres principios', 'About Rovaq AI: three principles'),
  subtitulo: b(
    'Cada cifra dice su origen. Lo desconocido no es cero. Una persona decide cada acción.',
    'Every figure states its origin. What is unknown is not zero. A person decides every action.',
  ),
  bloques: [
    {
      tipo: 'texto',
      titulo: b('Para quién se construye', 'Who it is built for'),
      texto: b(
        'Rovaq AI se construye para equipos que venden en marketplaces y atienden a sus compradores por varios canales. Preferimos declarar un límite a esconderlo.',
        'Rovaq AI is built for teams that sell on marketplaces and serve their buyers across channels. We prefer to state a limit rather than hide it.',
      ),
    },
    {
      tipo: 'principios',
      items: [
        { t: b('Cada cifra dice su origen', 'Every figure states its origin'), d: b('Se ve en el sello de cuatro campos: clase, fuente, fecha de corte y antigüedad.', 'You see it in the four-field seal: class, source, cut-off date and age.') },
        { t: b('Lo desconocido no es cero', 'What is unknown is not zero'), d: b('Se ve en las tablas y en los mapas, donde lo que falta dice Sin dato.', 'You see it in tables and maps, where what is missing says No data.') },
        { t: b('Una persona decide', 'A person decides'), d: b('Se ve en Proceder, Ajustar o Descartar: nada se envía solo.', 'You see it in Proceed, Adjust or Dismiss: nothing is sent automatically.') },
      ],
    },
    { tipo: 'texto', titulo: b('Lo que no hacemos', 'What we do not do'), texto: LANDING.limites.subtitulo },
  ],
  cta: b('Solicitar acceso', 'Request access'),
};

export const SOLICITAR_ACCESO: Pagina = {
  id: 'solicitar-acceso',
  estado: 'publicable',
  seo: {
    titulo: b('Solicitar acceso a Rovaq AI | Escríbenos por correo', 'Request Access to Rovaq AI | Write to Our Team by Email'),
    descripcion: b(
      'Escríbenos con tu puesto y las herramientas que usas. Te decimos qué se puede cargar hoy y qué sigue en hoja de ruta. El precio todavía no está publicado.',
      'Write to us with your role and the tools you use. We tell you what can be loaded today and what is still on the roadmap. Pricing is not published yet.',
    ),
  },
  h1: LANDING.cierre.titulo,
  subtitulo: b(
    'Escríbenos con tu puesto y las herramientas que usas. Te decimos con claridad qué se puede cargar hoy y qué sigue en hoja de ruta.',
    'Write to us with your role and the tools you use. We tell you plainly what can be loaded today and what is still on the roadmap.',
  ),
  bloques: [
    { tipo: 'lista', titulo: b('Qué incluir en tu mensaje', 'What to include in your message'), items: LANDING.cierre.incluir },
    {
      tipo: 'texto',
      titulo: b('Qué pasa después', 'What happens next'),
      texto: b(
        'Revisamos tu caso y te decimos qué se puede cargar o conectar hoy.',
        'We review your case and tell you what can be loaded or connected today.',
      ),
    },
    { tipo: 'texto', titulo: b('Precio', 'Pricing'), texto: LANDING.cierre.precio },
    { tipo: 'texto', titulo: b('Escríbenos', 'Write to us'), texto: LANDING.cierre.ayudaCorreo },
  ],
  cta: LANDING.cierre.cta,
};
