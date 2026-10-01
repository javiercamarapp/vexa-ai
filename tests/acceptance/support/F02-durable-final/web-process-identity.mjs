// Control-only identity; process handles and ordinary signals remain unchanged.
const title='vexa-syn-web-'+process.pid;
process.title=title;
Object.defineProperty(process,'title',{get:()=>title,set:()=>{},enumerable:true,configurable:false});
