import {brand} from '../lib/brand.mjs';
export function VexaBrand(){
 const asset=brand();
 // eslint-disable-next-line @next/next/no-img-element -- The same public raster asset is used unmodified by Auth email clients.
 return asset.logoPath?<img src={asset.logoPath} width={asset.width} height={asset.height} alt="VEXA AI" style={{maxWidth:'100%',height:'auto',objectFit:'contain'}}/>:<span className="wordmark">VEXA<span aria-hidden="true">.</span></span>;
}
