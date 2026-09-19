export default function Home() {
  return (
    <div className="home">
      <p className="eyebrow">Inteligencia de posventa</p>
      <h1>Las decisiones empiezan<br />con evidencia.</h1>
      <p className="intro">
        Estamos construyendo VEXA para conectar conversaciones de posventa
        con problemas de negocio e impacto económico verificable.
      </p>
      <section className="notice" aria-labelledby="estado-titulo">
        <p className="eyebrow">Estado actual</p>
        <h2 id="estado-titulo">Producto aún en construcción</h2>
        <p>
          Esta es la base inicial de la aplicación. No hay fuentes conectadas,
          datos de clientes ni métricas disponibles. No se muestran cifras simuladas.
        </p>
        <p className="scope">
          El acceso con cuenta, el aislamiento de datos y las funciones de análisis
          todavía no están implementados.
        </p>
      </section>
      <p className="closing">Primero, datos con procedencia. Después, decisiones informadas.</p>
    </div>
  );
}
