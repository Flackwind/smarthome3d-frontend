// Minimal local production preview for automated tests; production uses Nginx.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

const root=resolve('dist/web/browser');
const mime={'.html':'text/html','.js':'application/javascript','.mjs':'application/javascript','.json':'application/json','.webmanifest':'application/manifest+json','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.wasm':'application/wasm'};
const server=createServer(async(request,response)=>{
  try{
    const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    let target=resolve(root,'.'+path);
    if(target!==root&&!target.startsWith(root+sep)){response.writeHead(403);response.end();return;}
    try{if(!(await stat(target)).isFile())target=resolve(root,'index.html');}catch{if(extname(target)){response.writeHead(404);response.end();return;}target=resolve(root,'index.html');}
    response.writeHead(200,{'Content-Type':mime[extname(target)]??'application/octet-stream','Cache-Control':'no-cache'});response.end(await readFile(target));
  }catch{response.writeHead(500);response.end('Preview error');}
});
server.listen(4308,'127.0.0.1',()=>console.log('Production preview http://127.0.0.1:4308'));
for(const event of ['SIGTERM','SIGINT'])process.on(event,()=>server.close(()=>process.exit(0)));
