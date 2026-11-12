import { canCommand, CleaningArea, commandToService, ConnectionOptions, ConnectionStatus, DeviceCommand, fromHassState, HassState, ProviderSnapshot, RobotPosition, SmartDevice, SmartHomeProvider } from '@sh3d/device-model';
import { enrichEntity, RegistryData, RegistryEntry } from './registry';

export interface SocketLike {
  onopen:((event:Event)=>void)|null;onmessage:((event:MessageEvent)=>void)|null;
  onclose:((event:CloseEvent)=>void)|null;onerror:((event:Event)=>void)|null;
  send(data:string):void;close():void;
}
export type SocketFactory=(url:string)=>SocketLike;
export function websocketUrl(input:string):string {
  const u=new URL(input);if(!['http:','https:','ws:','wss:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw new Error('Usa un URL HTTP(S) di Home Assistant, senza credenziali o parametri');
  u.protocol=['https:','wss:'].includes(u.protocol)?'wss:':'ws:';u.pathname=u.pathname.replace(/\/$/,'').replace(/\/api\/websocket$/,'')+'/api/websocket';return u.toString();
}
/** Tokens live only in this instance. Transport never knows about Angular or Three.js. */
export class HomeAssistantProvider implements SmartHomeProvider {
  readonly id='home-assistant' as const;
  connectionStatus:ConnectionStatus='disconnected';
  private socket?:SocketLike;private options?:ConnectionOptions;private stopped=true;private authFailed=false;
  private nextId=0;private attempt=0;private reconnectTimer?:ReturnType<typeof setTimeout>;
  private heartbeat?:ReturnType<typeof setInterval>;private handshakeTimer?:ReturnType<typeof setTimeout>;
  private listeners=new Set<(s:ProviderSnapshot)=>void>();private devices=new Map<string,SmartDevice>();
  private pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  private ready?:{resolve:()=>void;reject:(e:Error)=>void};private error?:string;
  private buffered=new Map<string,HassState|null>();private initializing=false;
  private registry:RegistryData={entities:[],devices:[],areas:[],floors:[]};private positionService=false;private areaService=false;
  constructor(private readonly factory:SocketFactory=url=>new WebSocket(url)){}
  async connect(options?:ConnectionOptions):Promise<void> {
    this.disconnect();if(!options?.url||!(options.token?.trim()||options.tokenProvider||options.sessionAuth))throw new Error('Inserisci URL e token Home Assistant');
    const url=websocketUrl(options.url);
    if(typeof location!=='undefined'&&location.protocol==='https:'&&url.startsWith('ws:'))throw new Error('Una pagina HTTPS richiede Home Assistant via HTTPS/WSS');
    this.options={url,token:options.token?.trim(),tokenProvider:options.tokenProvider,sessionAuth:options.sessionAuth};this.stopped=false;this.authFailed=false;this.attempt=0;
    return new Promise<void>((resolve,reject)=>{this.ready={resolve,reject};this.open();});
  }
  disconnect():void {
    this.stopped=true;clearTimeout(this.reconnectTimer);clearTimeout(this.handshakeTimer);clearInterval(this.heartbeat);
    const socket=this.socket;this.socket=undefined;
    if(socket){socket.onmessage=null;socket.onclose=null;socket.onerror=null;socket.close();}
    this.rejectPending('Connessione chiusa');this.ready?.reject(new Error('Connessione chiusa'));this.ready=undefined;
    this.options=undefined;this.devices.clear();this.buffered.clear();this.registry={entities:[],devices:[],areas:[],floors:[]};this.positionService=false;this.areaService=false;this.error=undefined;this.setStatus('disconnected');
  }
  getDevices():SmartDevice[]{return structuredClone([...this.devices.values()]);}
  getDeviceState(id:string):SmartDevice|undefined{return this.getDevices().find(d=>d.entityId===id);}
  subscribeToUpdates(cb:(s:ProviderSnapshot)=>void):()=>void{this.listeners.add(cb);cb({status:this.connectionStatus,devices:this.getDevices(),error:this.error});return ()=>this.listeners.delete(cb);}
  async executeCommand(id:string,command:DeviceCommand):Promise<void>{
    if(this.connectionStatus!=='connected')throw new Error('Home Assistant non è connesso');
    const device=this.devices.get(id);if(!device)throw new Error('Entità non trovata');
    commandToService(device,command);
    if(command.type==='clean-areas'){const socket=this.socket,areas=await this.getCleaningAreas(id);if(socket!==this.socket||command.areaIds.some(area=>!areas.some(a=>a.id===area)))throw new Error('Stanze non associate o connessione cambiata. Aggiorna le stanze.');}
    if(!canCommand(this.devices.get(id)??device))throw new Error('Dispositivo non disponibile');
    const current=this.devices.get(id);if(!current)throw new Error('Entità non trovata');
    await this.request('call_service',commandToService(current,command));
  }
  async readPosition(id:string):Promise<RobotPosition>{
    const entity=this.devices.get(id);if(this.connectionStatus!=='connected'||!entity?.capabilities.includes('read-position')||entity.state==='unavailable')throw new Error('Lettura posizione non disponibile per questo robot');
    const result=await this.request('call_service',{domain:'roborock',service:'get_vacuum_current_position',target:{entity_id:id},return_response:true}) as {response?:Record<string,unknown>};
    const response=result?.response,position=(response?.[id]??response) as {x?:unknown;y?:unknown}|undefined;
    if(typeof position?.x!=='number'||typeof position?.y!=='number'||!Number.isFinite(position.x)||!Number.isFinite(position.y)||Math.abs(position.x)>1e9||Math.abs(position.y)>1e9)throw new Error('Home Assistant non ha restituito coordinate valide');
    return {x:position.x,y:position.y,updatedAt:new Date().toISOString()};
  }
  async getCleaningAreas(id:string):Promise<CleaningArea[]>{
    const device=this.devices.get(id);if(this.connectionStatus!=='connected'||!device?.capabilities.includes('clean-areas')||!canCommand(device))throw new Error('Pulizia per stanza non disponibile');
    const socket=this.socket;
    const [entry,areas,floors]=await Promise.all([
      this.request('config/entity_registry/get',{entity_id:id}) as Promise<{options?:{vacuum?:{area_mapping?:unknown}}}>,
      this.request('config/area_registry/list') as Promise<RegistryEntry[]>,
      this.request('config/floor_registry/list').catch(()=>this.registry.floors) as Promise<RegistryEntry[]>
    ]);
    if(socket!==this.socket||this.connectionStatus!=='connected')throw new Error('Connessione cambiata. Aggiorna le stanze.');
    const mapping=entry?.options?.vacuum?.area_mapping;
    if(!mapping||typeof mapping!=='object'||Array.isArray(mapping)||!Array.isArray(areas))return [];
    return areas.filter(a=>{const segments=a.area_id?(mapping as Record<string,unknown>)[a.area_id]:undefined;return a.area_id&&Array.isArray(segments)&&segments.length>0&&segments.every(s=>typeof s==='string'&&s.length>0);})
      .map(a=>({id:a.area_id!,name:a.name??a.area_id!,floorName:Array.isArray(floors)?floors.find(f=>f.floor_id===a.floor_id)?.name:undefined}));
  }
  private async authenticate():Promise<void>{
    const socket=this.socket;
    try{if(this.options?.sessionAuth){socket?.send(JSON.stringify({type:'auth'}));return;}const token=this.options?.tokenProvider?await this.options.tokenProvider():this.options?.token;if(this.socket!==socket||this.stopped)return;if(!token)throw new Error();socket?.send(JSON.stringify({type:'auth',access_token:token}));}
    catch{if(socket!==this.socket||this.stopped)return;this.authFailed=true;this.error='Sessione scaduta. Accedi di nuovo a Home Assistant.';clearTimeout(this.handshakeTimer);this.ready?.reject(new Error(this.error));this.ready=undefined;this.setStatus('error');socket?.close();}
  }
  private open():void {
    if(this.stopped||!this.options)return;
    this.setStatus(this.attempt?'reconnecting':'connecting');this.initializing=true;this.buffered.clear();
    let socket:SocketLike;
    try{socket=this.factory(this.options.url!);this.socket=socket;}catch{this.lost('Impossibile aprire WebSocket');return;}
    this.handshakeTimer=setTimeout(()=>{if(this.socket===socket){socket.close();this.lost('Timeout autenticazione');}},15000);
    socket.onmessage=event=>{if(this.socket!==socket)return;try{this.message(JSON.parse(event.data) as Record<string,unknown>);}catch{this.error='Messaggio WebSocket non valido';this.emit();}};
    socket.onerror=()=>{if(this.socket===socket){this.error='Connessione WebSocket non riuscita';this.emit();socket.close();}};
    socket.onclose=()=>{if(this.socket===socket)this.lost(this.authFailed?'Token non valido':'Home Assistant non raggiungibile');};
  }
  private message(m:Record<string,unknown>):void {
    if(m['type']==='auth_required'){void this.authenticate();return;}
    if(m['type']==='auth_invalid'){
      this.authFailed=true;this.error='Token non valido. Inserisci un nuovo token.';clearTimeout(this.handshakeTimer);
      this.ready?.reject(new Error(this.error));this.ready=undefined;this.setStatus('error');this.socket?.close();return;
    }
    if(m['type']==='auth_ok'){clearTimeout(this.handshakeTimer);void this.initialize();return;}
    if(m['type']==='result'||m['type']==='pong'){
      const pending=this.pending.get(Number(m['id']));if(!pending)return;clearTimeout(pending.timer);this.pending.delete(Number(m['id']));
      if(m['success']===false)pending.reject(new Error(String((m['error'] as Record<string,unknown>)?.['message']??'Comando rifiutato da Home Assistant')));
      else pending.resolve(m['result']);return;
    }
    if(m['type']==='event') {
      const event=m['event'] as {event_type?:string;data?:{entity_id?:string;new_state?:HassState|null}};
      if(event?.event_type!=='state_changed'||!event.data?.entity_id)return;
      const {entity_id,new_state}=event.data;
      if(this.initializing)this.buffered.set(entity_id,new_state??null);else{this.applyState(entity_id,new_state??null);this.emit();}
    }
  }
  private async initialize():Promise<void> {
    const socket=this.socket;
    try {
      // Subscribe first; buffer changes until the initial snapshot has arrived.
      await this.request('subscribe_events',{event_type:'state_changed'});
      const states=await this.request('get_states') as HassState[];
      if(this.socket!==socket||this.stopped)return;
      this.devices.clear();for(const s of states)this.applyState(s.entity_id,s);
      for(const [id,state] of this.buffered)this.applyState(id,state);this.buffered.clear();this.initializing=false;
      this.attempt=0;this.error=undefined;this.setStatus('connected');this.ready?.resolve();this.ready=undefined;
      this.heartbeat=setInterval(()=>{void this.request('ping').catch(()=>this.socket?.close());},30000);
      void this.loadRegistries(socket);
    }catch(e){if(this.socket!==socket||this.stopped)return;this.error=e instanceof Error?e.message:'Errore lettura stati';this.ready?.reject(new Error(this.error));this.ready=undefined;this.socket?.close();}
  }
  private async loadRegistries(socket:SocketLike|undefined):Promise<void> {
    const result=await Promise.allSettled(['config/entity_registry/list','config/device_registry/list','config/area_registry/list','config/floor_registry/list','get_services'].map(type=>this.request(type)));
    if(socket!==this.socket)return;
    const data=result.map(r=>r.status==='fulfilled'&&Array.isArray(r.value)?r.value as RegistryEntry[]:[]);
    const [entities,devices,areas,floors]=data;
    this.registry={entities,devices,areas,floors};const services=result[4];this.positionService=services.status==='fulfilled'&&!!(services.value as {roborock?:{get_vacuum_current_position?:unknown}}|undefined)?.roborock?.get_vacuum_current_position;
    this.areaService=services.status==='fulfilled'&&!!(services.value as {vacuum?:{clean_area?:unknown}}|undefined)?.vacuum?.clean_area;
    for(const d of this.devices.values())this.devices.set(d.entityId,this.enrich(d));
    this.emit();
  }
  private applyState(id:string,s:HassState|null):void {
    if(!s){this.devices.delete(id);return;}
    this.devices.set(id,this.enrich(fromHassState(s)));
  }
  private enrich(entity:SmartDevice):SmartDevice{const enriched=enrichEntity(entity,this.registry);if(enriched.domain==='vacuum'&&enriched.integration==='roborock'&&this.positionService&&!enriched.capabilities.includes('read-position'))enriched.capabilities.push('read-position');if(enriched.domain==='vacuum'&&(Number(enriched.attributes['supported_features'])&16384)&&this.areaService&&!enriched.capabilities.includes('clean-areas'))enriched.capabilities.push('clean-areas');return enriched;}
  private request(type:string,data:object={}):Promise<unknown> {
    const socket=this.socket;if(!socket)return Promise.reject(new Error('WebSocket chiuso'));
    const id=++this.nextId;
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('Timeout risposta Home Assistant'));},10000);
      this.pending.set(id,{resolve,reject,timer});
      try{socket.send(JSON.stringify({id,type,...data}));}catch{clearTimeout(timer);this.pending.delete(id);reject(new Error('Invio comando fallito'));}
    });
  }
  private lost(message:string):void {
    clearTimeout(this.handshakeTimer);clearInterval(this.heartbeat);this.socket=undefined;this.rejectPending(message);
    if(this.stopped)return;this.error=message;
    if(this.authFailed){this.setStatus('error');return;}
    this.setStatus('reconnecting');
    // Bound the first connection attempt; background retries continue until disconnect.
    this.ready?.reject(new Error(message));this.ready=undefined;
    const delay=Math.min(30000,1000*2**Math.min(this.attempt++,5))+Math.random()*250;
    clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>this.open(),delay);
  }
  private rejectPending(message:string):void{for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(message));}this.pending.clear();}
  private setStatus(status:ConnectionStatus):void{this.connectionStatus=status;this.emit();}
  private emit():void{const snapshot={status:this.connectionStatus,devices:this.getDevices(),error:this.error};this.listeners.forEach(cb=>cb(snapshot));}
}
