export interface BackendSession {
  authenticated:boolean;setupRequired:boolean;username:string;csrfToken:string;
  homeAssistant:{configured:boolean;url:string;connected:boolean;message?:string};
}
export class BackendError extends Error { constructor(readonly status:number,message:string){super(message);} }
/** HTTPS uses the same-origin /api proxy; the local HTTP setup keeps its separate API port. */
export function suggestedBackendUrl(pageUrl?:string):string {
  if(!pageUrl)return 'http://localhost:8090';
  const page=new URL(pageUrl);
  return page.protocol==='https:'?page.origin:`http://${page.hostname}:8090`;
}
export function backendUrl(value:string):string {
  const url=new URL(value);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Inserisci l’URL HTTP(S) del backend, senza credenziali o parametri');
  if(typeof location!=='undefined'&&location.protocol==='https:'&&url.protocol!=='https:')throw new Error('Una pagina HTTPS richiede anche il backend via HTTPS');
  return url.toString().replace(/\/$/,'');
}
/** Only the non-secret server URL is persisted by the storage service. */
export class BackendClient {
  readonly url:string;private csrf='';onSession?:(session:BackendSession|undefined)=>void;
  constructor(url:string){this.url=backendUrl(url);}
  socketUrl():string{return this.url.replace(/^http/,'ws')+'/api/v1/ha/ws';}
  async request(path:string,options:RequestInit={},allowMissing=false):Promise<Response>{
    const headers=new Headers(options.headers),method=options.method??'GET';
    if(!['GET','HEAD'].includes(method)){if(!this.csrf)await this.session();headers.set('X-SH3D-CSRF',this.csrf);}
    let response:Response;
    try{response=await fetch(this.url+'/api/v1'+path,{...options,headers,credentials:'include',cache:'no-store',redirect:'error',signal:options.signal??AbortSignal.timeout(120000)});}
    catch{throw new BackendError(0,'Server non raggiungibile. Le modifiche restano nella scheda: riconnetti oppure esporta il progetto.');}
    if(!response.ok&&!(allowMissing&&response.status===404)){
      let message='Richiesta al server non riuscita';try{
        const body=await response.text();
        if(response.status===403&&body.trim()==='Invalid CORS request')message='L’indirizzo del frontend non è autorizzato dal backend. Aggiungilo a SH3D_ORIGINS e riavvia il backend.';
        else {const data=JSON.parse(body) as {message?:unknown};if(typeof data.message==='string')message=data.message;}
      }catch{}
      if(response.status===401){this.csrf='';this.onSession?.(undefined);}
      throw new BackendError(response.status,message);
    }return response;
  }
  async session():Promise<BackendSession>{
    const response=await this.request('/session'),data=await response.json() as BackendSession;
    if(typeof data.authenticated!=='boolean'||typeof data.setupRequired!=='boolean'||typeof data.csrfToken!=='string'||!data.csrfToken||typeof data.homeAssistant?.connected!=='boolean')throw new Error('Il server non espone l’API Smart Home 3D v1');
    this.csrf=data.csrfToken;this.onSession?.(data);return data;
  }
  async authenticate(username:string,password:string,setup:boolean):Promise<BackendSession>{await this.json('/auth/'+(setup?'setup':'login'),{username,password});this.csrf='';return this.session();}
  async logout():Promise<void>{await this.json('/auth/logout',{});this.csrf='';this.onSession?.(undefined);}
  async json<T>(path:string,body:unknown):Promise<T>{const response=await this.request(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return response.status===204||response.headers.get('Content-Length')==='0'?undefined as T:await response.text().then(text=>text?JSON.parse(text) as T:undefined as T);}
}
