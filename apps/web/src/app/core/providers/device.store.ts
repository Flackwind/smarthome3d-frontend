import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { CleaningArea, ConnectionStatus, DeviceCommand, ProviderId, RobotPosition, SmartDevice, SmartHomeProvider } from '@sh3d/device-model';
import { HomeAssistantProvider } from '../home-assistant/home-assistant.provider';
import { HomeAssistantSession, httpInstance } from '../home-assistant/oauth';
import { loginPopup } from '../home-assistant/oauth-popup';
import { StorageService } from '../persistence/storage.service';
import { loginBackendPopup } from '../home-assistant/backend-oauth-popup';
import { MockSmartHomeProvider } from './mock.provider';

@Injectable({providedIn:'root'})
export class DeviceStore {
  readonly devices=signal<SmartDevice[]>([]);readonly status=signal<ConnectionStatus>('disconnected');readonly providerId=signal<ProviderId>('mock');readonly error=signal('');readonly busy=signal<string[]>([]);
  readonly lightsOn=computed(()=>this.devices().filter(d=>d.domain==='light'&&d.state==='on').length);
  readonly authMode=signal<'demo'|'manual'|'oauth'|'backend'>('demo');private session?:HomeAssistantSession;
  readonly storage=inject(StorageService);private backendPending?:Promise<void>;
  private readonly backendKey=computed(()=>this.storage.mode()==='server'&&this.storage.session()?.authenticated&&this.storage.session()?.homeAssistant.connected?this.storage.endpoint():'');
  readonly positions=signal<Record<string,RobotPosition>>({});readonly positionBusy=signal<string[]>([]);readonly positionErrors=signal<Record<string,string>>({});readonly tracking=signal<string[]>([]);
  private readonly visible=signal(typeof document==='undefined'||!document.hidden);private readonly attempts=new Map<string,number>();private generation=0;
  private readonly mock=new MockSmartHomeProvider();private provider:SmartHomeProvider=this.mock;private unsubscribe?:()=>void;
  constructor(){
    void this.useMock();
    effect(()=>{const endpoint=this.backendKey(),server=this.storage.mode()==='server'||this.storage.serverPending();untracked(()=>{
      if(endpoint)void this.connectServer();
      else if(server)this.attach(new HomeAssistantProvider());
      else if(this.authMode()==='backend'||this.providerId()==='home-assistant'&&this.status()==='disconnected')void this.useMock();
    });});
    if(typeof document!=='undefined'){const visibility=()=>this.visible.set(!document.hidden);document.addEventListener('visibilitychange',visibility);inject(DestroyRef).onDestroy(()=>document.removeEventListener('visibilitychange',visibility));}
    effect(cleanup=>{const ids=this.tracking(),connected=this.status()==='connected',visible=this.visible();if(!ids.length||!connected||!visible)return;const interval=setInterval(()=>{for(const id of ids){const d=this.devices().find(item=>item.entityId===id);if(d&&['cleaning','returning'].includes(d.state))void this.readPosition(id,true);}},60000);cleanup(()=>clearInterval(interval));});
  }
  private attach(provider:SmartHomeProvider):void{
    this.closeSession();this.authMode.set(provider.id==='mock'?'demo':'manual');this.clearPositions();
    this.unsubscribe?.();this.provider.disconnect();this.provider=provider;this.providerId.set(provider.id);this.error.set('');
    this.unsubscribe=provider.subscribeToUpdates(s=>{this.status.set(s.status);this.devices.set(s.devices);this.error.set(s.error??'');});
  }
  async useMock():Promise<void>{this.attach(this.mock);await this.provider.connect();}
  async connect(url:string,token:string):Promise<void>{this.attach(new HomeAssistantProvider());const generation=this.generation;try{await this.provider.connect({url,token});}catch(e){if(generation===this.generation)this.error.set(e instanceof Error?e.message:'Connessione fallita');}}
  async login(url:string):Promise<void>{
    if(this.storage.mode()==='server'){await loginBackendPopup(this.storage.connection());await this.storage.refreshSession();await this.connectServer();return;}
    const instance=httpInstance(url),generation=this.generation;
    const result=await loginPopup(instance);
    const session=new HomeAssistantSession(instance,result.clientId,result.tokens,()=>{if(this.session===session){this.provider.disconnect();this.clearPositions();this.error.set('Sessione scaduta. Accedi nuovamente a Home Assistant.');this.session=undefined;}});
    if(generation!==this.generation){await session.close();return;}
    this.attach(new HomeAssistantProvider());this.session=session;this.authMode.set('oauth');
    try{await this.provider.connect({url:instance,tokenProvider:()=>session.accessToken()});}catch{if(this.session===session){this.provider.disconnect();this.closeSession();this.error.set('Accesso non riuscito. Riprova dalle Impostazioni.');}}
  }
  private async connectServer():Promise<void>{
    if(this.backendPending)return this.backendPending;
    if(this.authMode()==='backend'&&this.status()==='connected')return;
    try{const client=this.storage.connection();this.attach(new HomeAssistantProvider(()=>new WebSocket(client.socketUrl())));this.authMode.set('backend');
      const provider=this.provider;this.backendPending=provider.connect({url:client.url,sessionAuth:true}).catch(async error=>{if(this.provider===provider){this.error.set(error instanceof Error?error.message:'Collegamento Home Assistant tramite server non riuscito');await this.storage.refreshSession().catch(()=>{});}});await this.backendPending;
    }catch(error){this.error.set(error instanceof Error?error.message:'Collegamento server non riuscito');}finally{this.backendPending=undefined;}
  }
  private closeSession():void{const session=this.session;this.session=undefined;if(session)void session.close().catch(error=>this.error.set(error instanceof Error?error.message:'Revoca sessione non riuscita'));}
  disconnect():void{if(this.authMode()==='backend')void this.storage.connection().json('/ha/disconnect',{}).then(()=>this.storage.refreshSession()).catch(error=>this.error.set(error instanceof Error?error.message:'Disconnessione server non riuscita'));this.closeSession();this.clearPositions();this.provider.disconnect();}
  async getCleaningAreas(id:string):Promise<CleaningArea[]>{if(!this.provider.getCleaningAreas)throw new Error('Pulizia per stanza non disponibile');const generation=this.generation;const areas=await this.provider.getCleaningAreas(id);if(generation!==this.generation)throw new Error('Connessione cambiata. Aggiorna le stanze.');return areas;}

  private clearPositions():void{this.generation++;this.busy.set([]);this.positions.set({});this.positionBusy.set([]);this.positionErrors.set({});this.tracking.set([]);this.attempts.clear();}
  trackPosition(id:string,enabled:boolean):void{if(enabled&&!this.devices().find(d=>d.entityId===id)?.capabilities.includes('read-position'))return;this.tracking.update(ids=>enabled?[...new Set([...ids,id])]:ids.filter(value=>value!==id));if(enabled&&this.visible()&&['cleaning','returning'].includes(this.devices().find(d=>d.entityId===id)?.state??''))void this.readPosition(id,true);}
  async readPosition(id:string,background=false):Promise<void>{
    if(this.positionBusy().includes(id))return;const generation=this.generation,device=this.devices().find(d=>d.entityId===id);
    if(this.status()!=='connected'||!device?.capabilities.includes('read-position')||!this.provider.readPosition)return;
    if(Date.now()-(this.attempts.get(id)??-Infinity)<60000){if(!background)this.positionErrors.update(errors=>({...errors,[id]:'Attendi almeno un minuto tra due letture della posizione.'}));return;}
    this.attempts.set(id,Date.now());this.positionBusy.update(ids=>[...ids,id]);this.positionErrors.update(errors=>({...errors,[id]:''}));
    try{const position=await this.provider.readPosition(id);if(generation===this.generation)this.positions.update(positions=>({...positions,[id]:position}));}
    catch(error){if(generation===this.generation){this.positionErrors.update(errors=>({...errors,[id]:error instanceof Error?error.message:'Posizione non disponibile'}));this.tracking.update(ids=>ids.filter(value=>value!==id));}}
    finally{if(generation===this.generation)this.positionBusy.update(ids=>ids.filter(value=>value!==id));}
  }
  async command(id:string,command:DeviceCommand):Promise<void>{if(this.busy().includes(id))return;const generation=this.generation;this.busy.update(v=>[...v,id]);this.error.set('');try{await this.provider.executeCommand(id,command);}catch(e){if(generation===this.generation)this.error.set(e instanceof Error?e.message:'Comando fallito');}finally{if(generation===this.generation)this.busy.update(v=>v.filter(x=>x!==id));}}
}
