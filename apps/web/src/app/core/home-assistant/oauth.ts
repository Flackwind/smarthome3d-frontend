/** HA OAuth credentials never leave this object's memory. No browser storage. */
export interface SessionTokens { accessToken:string; refreshToken:string; expiresAt:number }
export function httpInstance(input:string):string {
  const url=new URL(input);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('Inserisci un URL HTTP(S) senza credenziali o parametri');
  if(typeof location!=='undefined'&&location.protocol==='https:'&&url.protocol!=='https:')throw new Error('Una pagina HTTPS richiede Home Assistant via HTTPS');
  return url.toString().replace(/\/$/,'');
}
function base64url(bytes:Uint8Array):string{return btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
export async function authorizationRequest(instance:string,origin:string):Promise<{url:string;state:string;verifier:string;clientId:string}> {
  const base=httpInstance(instance),client=new URL(origin);if(!['https:','http:'].includes(client.protocol)||client.origin!==origin)throw new Error('Origine applicazione non valida');
  if(!globalThis.crypto?.subtle)throw new Error('Per accedere usa localhost o HTTPS; il token manuale resta disponibile.');
  const state=base64url(crypto.getRandomValues(new Uint8Array(32))),verifier=base64url(crypto.getRandomValues(new Uint8Array(32)));
  const challenge=base64url(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
  const clientId=origin+'/',url=new URL(base+'/auth/authorize');
  url.search=new URLSearchParams({client_id:clientId,redirect_uri:origin+'/auth/callback',state,code_challenge:challenge,code_challenge_method:'S256'}).toString();
  return {url:url.toString(),state,verifier,clientId};
}
async function postToken(instance:string,fields:Record<string,string>,signal?:AbortSignal):Promise<Record<string,unknown>> {
  let response:Response;
  try{response=await fetch(instance+'/auth/token',{method:'POST',body:new URLSearchParams(fields),credentials:'omit',cache:'no-store',redirect:'error',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(15000)]):AbortSignal.timeout(15000)});}
  catch{throw new Error('Accesso Home Assistant non riuscito. Verifica connessione, HTTPS e origine consentita (CORS).');}
  if(!response.ok)throw new Error('Sessione Home Assistant rifiutata. Accedi nuovamente.');
  try{return await response.json() as Record<string,unknown>;}catch{throw new Error('Risposta di autenticazione non valida');}
}
function tokens(data:Record<string,unknown>,refreshToken?:string):SessionTokens {
  if(!data||typeof data!=='object'||Array.isArray(data))throw new Error('Risposta di autenticazione non valida');
  const refresh=data['refresh_token']??refreshToken,expires=data['expires_in'];
  if(typeof data['access_token']!=='string'||!data['access_token']||typeof refresh!=='string'||!refresh||data['token_type']!=='Bearer'||typeof expires!=='number'||!Number.isFinite(expires)||expires<1||expires>86400)throw new Error('Risposta di autenticazione non valida');
  return {accessToken:data['access_token'],refreshToken:refresh,expiresAt:Date.now()+expires*1000};
}
export async function exchangeAuthorization(instance:string,clientId:string,code:string,verifier:string,signal?:AbortSignal):Promise<SessionTokens>{
  if(!code||!verifier)throw new Error('Autorizzazione incompleta');
  return tokens(await postToken(httpInstance(instance),{grant_type:'authorization_code',client_id:clientId,code,code_verifier:verifier},signal));
}
export class HomeAssistantSession {
  private current?:SessionTokens;private pending?:Promise<string>;private timer?:ReturnType<typeof setTimeout>;private readonly abort=new AbortController();
  constructor(private readonly instance:string,private readonly clientId:string,initial:SessionTokens,private readonly expired:()=>void){this.current=initial;this.schedule();}
  async accessToken():Promise<string>{
    if(!this.current)throw new Error('Sessione terminata');
    if(this.current.expiresAt-Date.now()>60000)return this.current.accessToken;
    return this.refresh();
  }
  private refresh():Promise<string>{
    if(this.pending)return this.pending;
    const refresh=this.current?.refreshToken;if(!refresh)return Promise.reject(new Error('Sessione terminata'));
    this.pending=(async()=>{
      try{const next=tokens(await postToken(this.instance,{grant_type:'refresh_token',client_id:this.clientId,refresh_token:refresh},this.abort.signal),refresh);
        if(this.abort.signal.aborted)throw new Error('Sessione terminata');this.current=next;this.schedule();return next.accessToken;
      }catch{if(!this.abort.signal.aborted){this.clear();this.expired();}throw new Error('Sessione scaduta. Accedi nuovamente.');}
      finally{this.pending=undefined;}
    })();return this.pending;
  }
  private schedule():void{clearTimeout(this.timer);this.timer=setTimeout(()=>void this.refresh().catch(()=>{}),Math.max(1000,(this.current?.expiresAt??0)-Date.now()-60000));}
  private clear():void{clearTimeout(this.timer);this.current=undefined;this.abort.abort();}
  async close():Promise<void>{
    const refresh=this.current?.refreshToken;this.clear();if(!refresh)return;
    try{const response=await fetch(this.instance+'/auth/revoke',{method:'POST',body:new URLSearchParams({token:refresh}),credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});if(!response.ok)throw new Error();}catch{throw new Error('Disconnesso localmente. Revoca la sessione anche dal profilo Home Assistant se il server non è raggiungibile.');}
  }
}
