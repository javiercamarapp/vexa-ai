import settings from './brand.json' with {type:'json'};
// Both the website and Auth emails read this public, credential-free asset setting.
export function brand(input=settings){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join(',')!=='height,logoPath,width')throw Error('Invalid VEXA brand configuration');
 if(input.logoPath!==null&&(typeof input.logoPath!=='string'||!/^\/brand\/[A-Za-z0-9/_-]+\.(?:png|jpe?g)$/.test(input.logoPath)))throw Error('VEXA logo must be a same-origin PNG/JPEG under /brand/');
 for(const dimension of ['width','height'])if(!Number.isInteger(input[dimension])||input[dimension]<16||input[dimension]>600)throw Error('Invalid VEXA logo dimensions');
 return {logoPath:input.logoPath,width:input.width,height:input.height};
}
