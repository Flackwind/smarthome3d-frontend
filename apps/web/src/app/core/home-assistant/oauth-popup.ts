import { authorizationRequest, exchangeAuthorization, SessionTokens } from './oauth';

/** Open synchronously from a user click, before awaiting PKCE generation. */
export async function loginPopup(instance:string):Promise<{tokens:SessionTokens;clientId:string}> {
  const popup=window.open('about:blank','_blank','popup,width=540,height=760');
  if(!popup)throw new Error('Consenti la finestra di accesso nel browser e riprova.');
  try{
    const request=await authorizationRequest(instance,location.origin);
    const code=await waitForAuthorization(popup,request.url,request.state);
    return {tokens:await exchangeAuthorization(instance,request.clientId,code,request.verifier),clientId:request.clientId};
  }finally{popup.close();}
}

/** Runs before Angular, so callback codes never enter routing or error logs. */
export function completeLoginPopup():void {
  const params=new URLSearchParams(location.search),code=params.get('code'),state=params.get('state');
  history.replaceState(null,'',location.pathname);
  if(window.opener){window.opener.postMessage({type:'sh3d-ha-auth',code,state},location.origin);document.body.textContent='Accesso in corso. Puoi tornare a Smart Home 3D.';}
  else document.body.textContent='Finestra di accesso non collegata. Torna a Smart Home 3D e ripeti l’accesso dalle Impostazioni.';
}

export function waitForAuthorization(popup:Window,url:string,state:string):Promise<string>{
  return new Promise<string>((resolve,reject)=>{
      const finish=(code?:string,error?:string)=>{clearTimeout(timeout);clearInterval(closed);window.removeEventListener('message',receive);error?reject(new Error(error)):resolve(code!);};
      const receive=(event:MessageEvent)=>{
        if(event.origin!==location.origin||event.source!==popup||event.data?.type!=='sh3d-ha-auth')return;
        if(event.data.state!==state){finish(undefined,'Risposta di accesso non valida. Riprova.');return;}
        if(typeof event.data.code!=='string'||!event.data.code||event.data.code.length>4096){finish(undefined,'Accesso annullato o rifiutato.');return;}
        finish(event.data.code);
      };
      const timeout=setTimeout(()=>finish(undefined,'Accesso scaduto. Riprova.'),300000);
      const closed=setInterval(()=>{if(popup.closed)finish(undefined,'Finestra di accesso chiusa.');},500);
      window.addEventListener('message',receive);popup.location.href=url;
    });
}
