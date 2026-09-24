import fs from 'node:fs';import {transport} from './fixture.mjs';
globalThis.fetch=(url,options)=>{if(url!=='https://openrouter.ai/api/v1/chat/completions')throw Error('NETWORK_DENIED');if(process.env.SYN339_SENT){fs.writeFileSync(process.env.SYN339_SENT,'SYN-attempt-sent',{mode:0o600,flag:'wx'});return new Promise(()=>{setInterval(()=>{},1000);});}return transport(url,options);};
