export type ImportConnection={id:string;source:string;account_id:string};
export type ConnectionPage={connections:ImportConnection[];next_connection_offset:number|null};

// A first-page miss does not establish that a selected connection was removed.
// Revalidate against current authorized pages; never retain a cached option.
export async function refreshConnectionOptions(first:ConnectionPage,selected:string,loadPage:(offset:number)=>Promise<ConnectionPage>):Promise<ImportConnection[]>{
 if(!selected||first.connections.some(item=>item.id===selected))return first.connections;
 let offset=first.next_connection_offset,previousOffset=0;
 while(offset!==null){
  if(!Number.isSafeInteger(offset)||offset<=previousOffset||offset>1000000)throw Error('No se pudo verificar la paginación de conexiones. Reintenta.');
  const page=await loadPage(offset),found=page.connections.find(item=>item.id===selected);
  if(found)return [...first.connections,found];
  previousOffset=offset;offset=page.next_connection_offset;
 }
 return first.connections;
}
