'use client';
import {useMemo} from 'react';
import type {CoverageView} from '../../../../../packages/workspace-service/provenance.mjs';
import type {TrendsView} from '../../../../../packages/workspace-service/trends.mjs';
import {tarjetasFuentes} from '../../lib/legibilidad/fuentes.mjs';
import {useJson} from '../ui/use-json';
import {PageHeader} from '../ui/page-header';
import {Button,LinkButton,Refresh,Arrow} from '../ui/button';
import {SkeletonRows} from '../ui/skeletons';
import {StatusChip} from '../ui/status-chip';
import {nf} from '../ui/format';
import {ComoSeCalculoProvider,ComoSeCalculoBoton} from './como-se-calculo';
import {bloqueFuentes,bloqueFrescura,bloqueVentanas,queNoSabemos,FACTOR_ALERTA} from './confianza-modelo.mjs';
import type {EntradaComo} from '../hoy/hoy-modelo.mjs';
import './confianza.css';
import '../datos/datos.css';

const acceptFresh=(j:unknown)=>{const d=(j as {data?:{availability?:string;sources?:unknown[];insights?:unknown[]}})?.data;return d&&Array.isArray(d.sources)&&Array.isArray(d.insights)?d:null;};
const acceptCov=(j:unknown)=>{const d=(j as {data?:CoverageView})?.data;return Array.isArray(d?.sources)?d as CoverageView:null;};
const acceptTrends=(j:unknown)=>{const d=(j as {data?:TrendsView})?.data;return d?.conversations&&d?.ledger?d:null;};
const acceptFuga=(j:unknown)=>{const d=(j as {data?:{titular?:unknown;ventanas?:unknown[]}})?.data;return d&&typeof d==='object'&&'titular' in d?d:null;};
const acceptCarga=(j:unknown)=>{const d=(j as {data?:{sla?:unknown}})?.data;return d&&typeof d==='object'&&'sla' in d?d:null;};
const TONO={alerta:'bad',atrasada:'warn',ok:'ok',manual:'muted',pausa:'muted',sin_datos:'muted'} as const;
const REGLA:EntradaComo={id:'frescura',titulo:'alerta de frescura',clase:'observed',fuente:'Estado de sincronización de cada fuente (source_sync_state)',periodo:null,
 formula:`Cada fuente con cadencia esperada se marca «Atrasada» si pasaron más de 2 veces su cadencia sin un éxito, y «Alerta» si pasaron más de ${FACTOR_ALERTA} veces o si la última corrida falló. Las cargas manuales no tienen cadencia y no generan alerta.`,
 cobertura:null,noSabemos:['Una fuente que nunca corrió aparece «Sin datos», no «Al día».','El Tracker de Excel y los archivos son manuales: su frescura es la de la última carga, no un indicador de salud.']};

function Bloque({id,titulo,intro,extra,children}:{id:string;titulo:string;intro:string;extra?:React.ReactNode;children:React.ReactNode}){
 return <section className="dc-bloque" aria-labelledby={id}><header className="hoy-kpi-top"><div><h2 id={id}>{titulo}</h2><p>{intro}</p></div>{extra}</header>{children}</section>;
}
const Tabla=({etiqueta,children}:{etiqueta:string;children:React.ReactNode})=><div className="table-wrap" tabIndex={0} role="region" aria-label={etiqueta+', desplazamiento horizontal'}><table className="dc-tabla">{children}</table></div>;

/** «Datos y confianza»: un solo lugar, cuatro bloques. Lo que no se sabe pesa lo mismo que lo que sí. */
export function ConfianzaPantalla(){
 const fresh=useJson('/api/freshness',acceptFresh),cov=useJson<CoverageView>('/api/coverage',acceptCov),tr=useJson<TrendsView>('/api/trends',acceptTrends);
 const fuga=useJson('/api/refunds',acceptFuga),carga=useJson('/api/workload',acceptCarga);
 const fuentes=useMemo(()=>bloqueFuentes(fresh.data),[fresh.data]),frescura=useMemo(()=>bloqueFrescura(fresh.data),[fresh.data]);
 const ventanas=useMemo(()=>bloqueVentanas(fuga.data),[fuga.data]),tarjetas=useMemo(()=>tarjetasFuentes(cov.data,tr.data),[cov.data,tr.data]);
 const tareas=useMemo(()=>queNoSabemos({fuga:fuga.data,carga:carga.data,cobertura:cov.data,frescura:fresh.data}),[fuga.data,carga.data,cov.data,fresh.data]);
 const ocupado=fresh.busy||cov.busy||fuga.busy||carga.busy;
 const recargar=()=>{fresh.reload();cov.reload();tr.reload();fuga.reload();carga.reload();};
 const pendiente=(r:{busy:boolean;data:unknown;error:string})=>r.busy&&!r.data;
 return <ComoSeCalculoProvider><section className="task-page stack dc" aria-label="Datos y confianza">
  <PageHeader eyebrow="Datos y confianza" title="Qué tan confiables son tus cifras" description="De dónde sale cada número, qué tan fresco es, qué cubre y qué todavía no sabemos." actions={<Button icon={<Refresh/>} loading={ocupado} onClick={recargar}>Actualizar</Button>}/>

  <Bloque id="dc-fuentes" titulo="Fuentes conectadas" intro="Cómo entra cada fuente, cuándo funcionó por última vez y cuándo vuelve a correr." extra={<LinkButton href="/connections" size="sm" icon={<Arrow/>}>Administrar fuentes</LinkButton>}>
   {pendiente(fresh)?<SkeletonRows rows={3}/>:!fuentes.disponible?<p className="dc-vacio">{fresh.error||'La actualización automática aún no está activada para esta organización: las cargas siguen siendo manuales.'}</p>
    :fuentes.filas.length===0?<p className="dc-vacio">Todavía no se registró ninguna sincronización.</p>
    :<Tabla etiqueta="Fuentes conectadas"><thead><tr><th scope="col">Fuente</th><th scope="col">Cómo entra</th><th scope="col">Estado</th><th scope="col">Último éxito</th><th scope="col">Siguiente</th><th scope="col">Datos hasta</th></tr></thead>
     <tbody>{fuentes.filas.map(f=><tr key={f.clave}><th scope="row">{f.nombre}</th><td>{f.metodo}</td><td><StatusChip tone={TONO[f.nivel]}>{f.estado}</StatusChip>{f.error&&<div className="dc-vacio">{f.error}</div>}</td><td>{f.exito}</td><td>{f.siguiente??'—'}</td><td>{f.hasta??'sin fecha de corte'}</td></tr>)}</tbody></Tabla>}
   <p className="dc-linea">HubSpot es la fuente de verdad. Zendesk no se usa mientras su configuración esté en transición.</p>
  </Bloque>

  <Bloque id="dc-frescura" titulo="Frescura por cifra" intro="Cuándo se recalculó cada cifra y hasta qué corte de datos llega." extra={<ComoSeCalculoBoton entrada={REGLA}/>}>
   {pendiente(fresh)?<SkeletonRows rows={4}/>:!frescura.disponible?<p className="dc-vacio">No disponible ahora. Eso no significa que las cifras estén al día.</p>
    :<>{frescura.alertas!==undefined&&frescura.alertas>0&&<p className="dc-alerta" data-nivel="alerta" role="status">{frescura.alertas} {frescura.alertas===1?'alerta':'alertas'} de frescura: revisa lo marcado abajo.</p>}
     <Tabla etiqueta="Frescura por cifra"><thead><tr><th scope="col">Cifra</th><th scope="col">Estado</th><th scope="col">Actualizada</th><th scope="col">Datos hasta</th><th scope="col" className="num">Filas</th></tr></thead>
      <tbody>{frescura.filas.map(f=><tr key={f.clave}><th scope="row">{f.nombre}</th><td><span className="dc-alerta" data-nivel={f.nivel}>{f.estado}</span></td><td>{f.actualizado}{f.pendientes>0?` · faltan ${f.pendientes} periodos`:''}</td><td>{f.corte??'sin fecha de corte'}</td><td className="num">{nf.format(f.filas)}</td></tr>)}</tbody></Tabla></>}
  </Bloque>

  <Bloque id="dc-cobertura" titulo="Cobertura" intro="Cuánto trajo cada fuente y qué ventanas de exportación cubre cada canal.">
   {pendiente(cov)?<SkeletonRows rows={4}/>:cov.error&&!cov.data?<p className="dc-vacio">No disponible ahora: {cov.error}</p>
    :<Tabla etiqueta="Cobertura por fuente"><thead><tr><th scope="col">Fuente</th><th scope="col">Estado</th><th scope="col" className="num">Incorporado</th><th scope="col">Datos hasta</th><th scope="col">Rango</th></tr></thead>
     <tbody>{tarjetas.map(t=><tr key={t.clave}><th scope="row">{t.nombre}</th><td>{t.estado==='cargada'?'Cargada':t.estado==='no_disponible'?'No disponible ahora':'Sin cargar'}</td><td className="num">{t.estado==='cargada'?`${nf.format(t.incorporadas)} de ${nf.format(t.leidas)} ${t.unidad}`:'—'}</td><td>{t.estado==='cargada'?t.datosHasta??'sin fecha de corte':'—'}</td><td>{t.estado==='cargada'?t.rango??'sin rango registrado':'—'}</td></tr>)}</tbody></Tabla>}
   {ventanas.disponible?<><p className="dc-linea">{ventanas.linea||'No hay ventanas de exportación registradas.'}</p>
     {ventanas.filas.length>0&&<Tabla etiqueta="Ventanas de exportación"><thead><tr><th scope="col">Canal</th><th scope="col">Tipo</th><th scope="col">Ventana</th><th scope="col">Desde</th><th scope="col">Hasta</th></tr></thead>
      <tbody>{ventanas.filas.map((w,i)=><tr key={i}><th scope="row">{w.canal}</th><td>{w.tipo}</td><td>{w.completa?'Completa':'Parcial'}</td><td>{w.desde??'sin fecha'}</td><td>{w.hasta??w.corte??'sin fecha de corte'}</td></tr>)}</tbody></Tabla>}</>
    :<p className="dc-vacio">{fuga.status===403?'Las ventanas de exportación del dinero las ven propietarios y analistas.':pendiente(fuga)?'Cargando ventanas de exportación…':'Las ventanas de exportación no están disponibles ahora.'}</p>}
  </Bloque>

  <Bloque id="dc-nosabemos" titulo="Qué no sabemos" intro="Lo que hoy impide calcular o afirmar una cifra, y qué lo cierra. Pesa lo mismo que lo que sí sabemos.">
   {tareas.length===0?<p className="dc-vacio">{ocupado?'Revisando…':'Con las fuentes que respondieron no hay huecos conocidos. Las que no respondieron no se cuentan como completas.'}</p>
    :<ol className="dc-tareas">{tareas.map(t=><li key={t.clave}><h3>{t.titulo}</h3><dl><dt>Afecta</dt><dd>{t.afecta}</dd><dt>Se cierra con</dt><dd>{t.cierra}</dd><dt>Base</dt><dd>{t.base}</dd></dl></li>)}</ol>}
  </Bloque>
 </section></ComoSeCalculoProvider>;
}
