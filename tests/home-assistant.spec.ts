import { describe,it,expect,vi } from 'vitest';
import { HomeAssistantProvider, SocketLike, websocketUrl } from '../apps/web/src/app/core/home-assistant/home-assistant.provider';
class FakeSocket implements SocketLike {
  onopen:SocketLike['onopen']=null;onmessage:SocketLike['onmessage']=null;onclose:SocketLike['onclose']=null;onerror:SocketLike['onerror']=null;
  sent:Record<string,unknown>[]=[];closed=false;
  respond?:(message:Record<string,unknown>)=>void;
  send(data:string):void{const m=JSON.parse(data) as Record<string,unknown>;this.sent.push(m);this.respond?.(m);}
  emit(data:object):void{this.onmessage?.({data:JSON.stringify(data)} as MessageEvent);}
  close():void{this.closed=true;this.onclose?.({} as CloseEvent);}
}
const tick=async()=>{for(let i=0;i<15;i++)await Promise.resolve();};
const light={entity_id:'light.real',state:'off',attributes:{friendly_name:'Reale',supported_color_modes:['brightness']}};
function preparedSocket():FakeSocket {
  const s=new FakeSocket();s.respond=m=>queueMicrotask(()=>{
    if(m['type']==='auth')s.emit({type:'auth_ok'});
    else if(m['type']==='get_states')s.emit({id:m['id'],type:'result',success:true,result:[light]});
    else s.emit({id:m['id'],type:'result',success:true,result:[]});
  });return s;
}
describe('Home Assistant WebSocket',()=>{
  it('loads robot and dock registry relationships and queries position through the advertised HA action',async()=>{
    const socket=preparedSocket(),states=[{entity_id:'vacuum.robot',state:'docked',attributes:{supported_features:8192|16}},{entity_id:'switch.dock',state:'off',attributes:{}}];
    socket.respond=m=>queueMicrotask(()=>{
      let result:unknown=[];
      if(m['type']==='auth'){socket.emit({type:'auth_ok'});return;}
      if(m['type']==='get_states')result=states;
      if(m['type']==='config/entity_registry/list')result=[{entity_id:'vacuum.robot',device_id:'robot',platform:'roborock'},{entity_id:'switch.dock',device_id:'dock',platform:'roborock'}];
      if(m['type']==='config/device_registry/list')result=[{id:'robot',name:'Saros 10R',identifiers:[['roborock','test-id']]},{id:'dock',name:'Saros 10R Dock',identifiers:[['roborock','test-id_dock']]}];
      if(m['type']==='get_services')result={roborock:{get_vacuum_current_position:{}}};
      if(m['type']==='call_service')result={response:{'vacuum.robot':{x:22500,y:28000}}};
      socket.emit({id:m['id'],type:'result',success:true,result});
    });
    const provider=new HomeAssistantProvider(()=>socket),ready=provider.connect({url:'http://localhost:8123',token:'fake-test-token'});socket.emit({type:'auth_required'});await ready;await tick();
    expect(provider.getDeviceState('switch.dock')).toMatchObject({deviceId:'dock',deviceGroupId:'robot'});expect(provider.getDeviceState('vacuum.robot')?.capabilities).toContain('read-position');
    expect(await provider.readPosition('vacuum.robot')).toMatchObject({x:22500,y:28000});expect(socket.sent.find(m=>m['type']==='call_service')).toMatchObject({domain:'roborock',service:'get_vacuum_current_position',return_response:true,target:{entity_id:'vacuum.robot'}});
    socket.emit({type:'event',event:{event_type:'state_changed',data:{entity_id:'switch.dock',new_state:{...states[1],state:'on'}}}});expect(provider.getDeviceState('switch.dock')).toMatchObject({deviceGroupId:'robot',state:'on'});provider.disconnect();
  });
  it('does not advertise position when the integration or service is absent',async()=>{
    const socket=preparedSocket(),provider=new HomeAssistantProvider(()=>socket),ready=provider.connect({url:'http://localhost:8123',token:'fake'});socket.emit({type:'auth_required'});await ready;await tick();await expect(provider.readPosition('light.real')).rejects.toThrow('non disponibile');expect(socket.sent.some(m=>m['service']==='get_vacuum_current_position')).toBe(false);provider.disconnect();
  });
  it('authenticates, loads real entity IDs, sends commands and applies external updates',async()=>{
    const s=preparedSocket(),p=new HomeAssistantProvider(()=>s);const connected=p.connect({url:'http://homeassistant.local:8123',token:'fake-test-token'});s.emit({type:'auth_required'});await connected;
    expect(p.connectionStatus).toBe('connected');expect(p.getDevices()[0].entityId).toBe('light.real');
    await p.executeCommand('light.real',{type:'power',value:true});expect(s.sent.find(m=>m['type']==='call_service')).toMatchObject({domain:'light',service:'turn_on',target:{entity_id:'light.real'}});
    expect(p.getDeviceState('light.real')?.state).toBe('off');
    s.emit({type:'event',event:{event_type:'state_changed',data:{entity_id:'light.real',new_state:{...light,state:'on'}}}});expect(p.getDeviceState('light.real')?.state).toBe('on');
    s.emit({type:'event',event:{event_type:'state_changed',data:{entity_id:'light.real',new_state:null}}});expect(p.getDevices()).toHaveLength(0);p.disconnect();expect(s.closed).toBe(true);
  });
  it('keeps updates received during the initial snapshot',async()=>{
    const s=preparedSocket(),p=new HomeAssistantProvider(()=>s),base=s.respond!;
    s.respond=m=>{if(m['type']==='get_states')s.emit({type:'event',event:{event_type:'state_changed',data:{entity_id:'light.real',new_state:{...light,state:'on'}}}});base(m);};
    const ready=p.connect({url:'http://localhost:8123',token:'fake'});s.emit({type:'auth_required'});await ready;expect(p.getDeviceState('light.real')?.state).toBe('on');p.disconnect();
  });
  it('rejects authentication without retrying invalid credentials',async()=>{
    vi.useFakeTimers();const s=new FakeSocket(),factory=vi.fn(()=>s),p=new HomeAssistantProvider(factory);const ready=p.connect({url:'http://localhost:8123',token:'invalid'});const rejection=expect(ready).rejects.toThrow('Token non valido');s.emit({type:'auth_invalid'});await rejection;await vi.advanceTimersByTimeAsync(60000);expect(factory).toHaveBeenCalledTimes(1);expect(p.connectionStatus).toBe('error');p.disconnect();vi.useRealTimers();
  });
  it('reconnects with backoff and refreshes state',async()=>{
    vi.useFakeTimers();const sockets:FakeSocket[]=[];const p=new HomeAssistantProvider(()=>{const s=preparedSocket();sockets.push(s);return s;});
    const ready=p.connect({url:'http://localhost:8123',token:'fake'});sockets[0].emit({type:'auth_required'});await tick();await vi.advanceTimersByTimeAsync(0);await ready;
    sockets[0].close();expect(p.connectionStatus).toBe('reconnecting');await vi.advanceTimersByTimeAsync(1300);expect(sockets).toHaveLength(2);sockets[1].emit({type:'auth_required'});await vi.advanceTimersByTimeAsync(0);await tick();expect(p.connectionStatus).toBe('connected');p.disconnect();await vi.advanceTimersByTimeAsync(60000);expect(sockets).toHaveLength(2);vi.useRealTimers();
  });
  it('validates URLs and strips no tokens into query strings',()=>{expect(websocketUrl('https://ha.example')).toBe('wss://ha.example/api/websocket');expect(()=>websocketUrl('https://user:pass@ha.example')).toThrow();expect(()=>websocketUrl('javascript:alert(1)')).toThrow();});
});

describe('Vacuum mapped areas and renewable credentials',()=>{
  it('revalidates HA area mappings before targeting one robot with clean_area',async()=>{
    const socket=preparedSocket();let mapping:Record<string,string[]>={living:['0_16']};
    socket.respond=m=>queueMicrotask(()=>{let result:unknown=[];
      if(m['type']==='auth'){socket.emit({type:'auth_ok'});return;}
      if(m['type']==='get_states')result=[{entity_id:'vacuum.robot',state:'docked',attributes:{supported_features:8192|16384}}];
      if(m['type']==='get_services')result={vacuum:{clean_area:{}}};
      if(m['type']==='config/area_registry/list')result=[{area_id:'living',name:'Soggiorno',floor_id:'ground'},{area_id:'kitchen',name:'Cucina'}];
      if(m['type']==='config/floor_registry/list')result=[{floor_id:'ground',name:'Piano terra'}];
      if(m['type']==='config/entity_registry/get')result={options:{vacuum:{area_mapping:mapping}}};
      socket.emit({id:m['id'],type:'result',success:true,result});
    });
    const provider=new HomeAssistantProvider(()=>socket),ready=provider.connect({url:'http://ha.local',token:'test'});socket.emit({type:'auth_required'});await ready;await tick();
    expect(provider.getDeviceState('vacuum.robot')?.capabilities).toContain('clean-areas');expect(await provider.getCleaningAreas('vacuum.robot')).toEqual([{id:'living',name:'Soggiorno',floorName:'Piano terra'}]);
    await expect(provider.executeCommand('vacuum.robot',{type:'clean-areas',areaIds:['kitchen']})).rejects.toThrow('non associate');expect(socket.sent.some(m=>m['type']==='call_service')).toBe(false);
    await provider.executeCommand('vacuum.robot',{type:'clean-areas',areaIds:['living']});expect(socket.sent.filter(m=>m['type']==='call_service')).toEqual([expect.objectContaining({domain:'vacuum',service:'clean_area',target:{entity_id:'vacuum.robot'},service_data:{cleaning_area_id:['living']}})]);
    mapping={};await expect(provider.executeCommand('vacuum.robot',{type:'clean-areas',areaIds:['living']})).rejects.toThrow('non associate');expect(socket.sent.filter(m=>m['type']==='call_service')).toHaveLength(1);
    await expect(provider.executeCommand('vacuum.robot',{type:'clean-areas',areaIds:[]})).rejects.toThrow('valide');provider.disconnect();
  });
  it('gets fresh credentials at each reconnect and ignores stale token promises',async()=>{
    vi.useFakeTimers();const sockets:FakeSocket[]=[],getter=vi.fn().mockResolvedValueOnce('access-one').mockResolvedValueOnce('access-two');const provider=new HomeAssistantProvider(()=>{const socket=preparedSocket();sockets.push(socket);return socket;});
    const ready=provider.connect({url:'http://ha.local',tokenProvider:getter});sockets[0].emit({type:'auth_required'});await tick();await vi.advanceTimersByTimeAsync(0);await ready;expect(sockets[0].sent[0]).toEqual({type:'auth',access_token:'access-one'});
    sockets[0].close();await vi.advanceTimersByTimeAsync(1300);sockets[1].emit({type:'auth_required'});await tick();await vi.advanceTimersByTimeAsync(0);expect(sockets[1].sent[0]).toEqual({type:'auth',access_token:'access-two'});provider.disconnect();
    let resolve!:(token:string)=>void;const stale=new FakeSocket(),pending=new HomeAssistantProvider(()=>stale),connect=pending.connect({url:'http://ha.local',tokenProvider:()=>new Promise(r=>resolve=r)}),reject=expect(connect).rejects.toThrow('chiusa');stale.emit({type:'auth_required'});pending.disconnect();resolve('discarded');await reject;await tick();expect(stale.sent).toEqual([]);vi.useRealTimers();
  });
});
