import { BackendClient } from '../persistence/backend-client';
import { waitForAuthorization } from './oauth-popup';

export async function loginBackendPopup(client:BackendClient):Promise<void>{
  const popup=window.open('about:blank','_blank','popup,width=540,height=760');
  if(!popup)throw new Error('Consenti la finestra di accesso e riprova');
  let state:string|undefined,completed=false;
  try{
    const request=await client.json<{authorizeUrl:string;state:string}>('/ha/authorize',{origin:location.origin});state=request.state;
    const code=await waitForAuthorization(popup,request.authorizeUrl,request.state);
    await client.json('/ha/authorize/complete',{state:request.state,code});completed=true;
  }finally{popup.close();if(state&&!completed)void client.json('/ha/authorize/cancel',{state}).catch(()=>{});}
}
