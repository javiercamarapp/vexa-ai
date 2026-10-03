import Link from 'next/link';
export function GettingStarted({canManage,pending}:{canManage:boolean;pending:boolean}){
 return <section className="getting-started" aria-labelledby="getting-started-title">
  <header><p className="eyebrow">Primeros pasos</p><h2 id="getting-started-title">{pending?'Hay datos pendientes de publicación':'Prepara tu primer resumen'}</h2><p>{pending?'Revisa el procesamiento y la publicación para el periodo seleccionado.':'Este alcance aún no tiene cifras publicadas. Puede faltar la carga, la publicación o un periodo que coincida con tus datos.'}</p></header>
  {canManage?<ol>
   <li><span className="step-number" aria-hidden="true">01</span><h3>Incorpora datos autorizados</h3><p>Revisa tus conexiones o valida un archivo antes de importarlo. Conserva sus fechas originales.</p><Link href="/imports">Importar archivo →</Link><Link href="/connections">Revisar conexiones →</Link></li>
   <li><span className="step-number" aria-hidden="true">02</span><h3>Comprueba el procesamiento</h3><p>Abre una importación y selecciona «Ver progreso real de ingestión» para consultar avances y rechazos. El análisis requiere un proveedor y presupuesto configurados.</p><Link href="/imports">Ver importaciones →</Link><Link href="/analysis">Revisar análisis →</Link></li>
   <li><span className="step-number" aria-hidden="true">03</span><h3>Publica y explora</h3><p>Verifica fuentes, moneda y periodo en Finanzas. Tras publicar, vuelve al resumen con el mismo periodo.</p><Link href="/economics">Revisar finanzas →</Link><Link href="/problems">Explorar problemas →</Link></li>
  </ol>:<p>Pide al administrador del espacio que revise la carga y la publicación. Puedes consultar <Link href="/problems">problemas</Link> y ajustar el periodo y los filtros del resumen.</p>}
 </section>;
}
