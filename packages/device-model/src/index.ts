export type ProviderId = 'mock' | 'home-assistant';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';
export type Capability = 'power' | 'brightness' | 'color' | 'color-temperature' | 'temperature' | 'hvac-mode' | 'start' | 'pause' | 'return-to-base' | 'press' | 'select-option' | 'set-number' | 'set-time' | 'fan-speed' | 'read-position' | 'clean-areas';
export interface RobotPosition { x:number; y:number; updatedAt:string }
export interface CleaningArea { id:string; name:string; floorName?:string }
export interface SmartDevice {
  entityId: string; name: string; domain: string; state: string;
  attributes: Record<string, unknown>; capabilities: Capability[];
  deviceId?: string; areaId?: string; areaName?: string; floorName?: string;
  deviceName?:string; deviceGroupId?:string; manufacturer?:string; model?:string;
  integration?:string; entityCategory?:string; translationKey?:string;
}
export type DeviceCommand =
  | { type: 'power'; value: boolean }
  | { type: 'brightness'; value: number }
  | { type: 'color'; value: [number,number,number] }
  | { type: 'color-temperature'; value: number }
  | { type: 'temperature'; value: number }
  | { type: 'hvac-mode'; value: string }
  | { type: 'start' | 'pause' | 'return-to-base' | 'press' }
  | { type:'select-option' | 'set-time' | 'fan-speed'; value:string }
  | { type:'set-number'; value:number }
  | { type:'clean-areas'; areaIds:string[] };
export interface ProviderSnapshot { status: ConnectionStatus; devices: SmartDevice[]; error?: string }
export interface ConnectionOptions { url?: string; token?: string; tokenProvider?:()=>Promise<string>; sessionAuth?:boolean }
export interface SmartHomeProvider {
  readonly id: ProviderId;
  readonly connectionStatus: ConnectionStatus;
  connect(options?: ConnectionOptions): Promise<void>;
  disconnect(): void;
  getDevices(): SmartDevice[];
  getDeviceState(entityId: string): SmartDevice | undefined;
  subscribeToUpdates(callback:(snapshot: ProviderSnapshot)=>void):()=>void;
  executeCommand(entityId:string,command:DeviceCommand):Promise<void>;
  readPosition?(entityId:string):Promise<RobotPosition>;
  getCleaningAreas?(entityId:string):Promise<CleaningArea[]>;
}
export interface HassState { entity_id: string; state: string; attributes: Record<string,unknown> }
export function fromHassState(s:HassState):SmartDevice {
  const domain=s.entity_id.split('.')[0],a=s.attributes,flags=Number(a['supported_features']??0),caps:Capability[]=[];
  if(domain==='light') {
    const modes=Array.isArray(a['supported_color_modes'])?a['supported_color_modes'] as string[]:[];
    caps.push('power');
    if(modes.some(m=>['brightness','color_temp','hs','xy','rgb','rgbw','rgbww','white'].includes(m)))caps.push('brightness');
    if(modes.some(m=>['hs','xy','rgb','rgbw','rgbww'].includes(m)))caps.push('color');
    if(modes.includes('color_temp'))caps.push('color-temperature');
  }
  if(['switch','input_boolean'].includes(domain))caps.push('power');
  if(domain==='vacuum') {if(flags&8192)caps.push('start');if(flags&4)caps.push('pause');if(flags&16)caps.push('return-to-base');if((flags&32)&&Array.isArray(a['fan_speed_list'])&&a['fan_speed_list'].length)caps.push('fan-speed');}
  if(domain==='button')caps.push('press');
  if(domain==='select'&&Array.isArray(a['options'])&&a['options'].length)caps.push('select-option');
  if(domain==='number'&&[a['min'],a['max'],a['step']].every(v=>typeof v==='number'&&Number.isFinite(v))&&Number(a['step'])>0)caps.push('set-number');
  if(domain==='time')caps.push('set-time');
  if(domain==='climate') {if(flags&1)caps.push('temperature');if(Array.isArray(a['hvac_modes'])&&a['hvac_modes'].length)caps.push('hvac-mode');}
  return {entityId:s.entity_id,name:String(a['friendly_name']??s.entity_id),domain,state:s.state,attributes:{...a},capabilities:caps};
}
export function isCompatible(type:string,device:SmartDevice):boolean {
  if(['bulb','floor-lamp','ceiling-light','led-strip'].includes(type))return device.domain==='light';
  if(type==='vacuum')return device.domain==='vacuum';
  if(type==='radiator')return device.domain==='climate';
  if(type==='sensor')return ['sensor','binary_sensor'].includes(device.domain);
  if(['outlet','switch'].includes(type))return ['switch','input_boolean','light'].includes(device.domain);
  return false;
}
export function commandToService(device:SmartDevice,command:DeviceCommand):{domain:string;service:string;service_data:Record<string,unknown>;target:{entity_id:string}} {
  if(!device.capabilities.includes(command.type))throw new Error('Funzione non supportata da questa entità');
  if(!canCommand(device))throw new Error('Dispositivo non disponibile');
  const data:Record<string,unknown>={};let service:string=command.type;
  switch(command.type) {
    case 'power':service=command.value?'turn_on':'turn_off';break;
    case 'brightness':if(!Number.isFinite(command.value)||command.value<0||command.value>100)throw new Error('Luminosità non valida');service='turn_on';data['brightness_pct']=command.value;break;
    case 'color':if(command.value.length!==3||command.value.some(v=>!Number.isFinite(v)||v<0||v>255))throw new Error('Colore non valido');service='turn_on';data['rgb_color']=command.value;break;
    case 'color-temperature': {
      const min=Number(device.attributes['min_color_temp_kelvin']??2000),max=Number(device.attributes['max_color_temp_kelvin']??6500);
      if(!Number.isFinite(command.value)||command.value<min||command.value>max)throw new Error('Temperatura colore fuori intervallo');service='turn_on';data['color_temp_kelvin']=command.value;break;
    }
    case 'temperature': {
      const min=Number(device.attributes['min_temp']??5),max=Number(device.attributes['max_temp']??35);
      if(!Number.isFinite(command.value)||command.value<min||command.value>max)throw new Error('Temperatura fuori intervallo');service='set_temperature';data['temperature']=command.value;break;
    }
    case 'hvac-mode':if(!(device.attributes['hvac_modes'] as string[]).includes(command.value))throw new Error('Modalità non supportata');service='set_hvac_mode';data['hvac_mode']=command.value;break;
    case 'return-to-base':service='return_to_base';break;
    case 'press':service='press';break;
    case 'select-option':if(!(device.attributes['options'] as unknown[]).includes(command.value))throw new Error('Opzione non supportata');service='select_option';data['option']=command.value;break;
    case 'fan-speed':if(!(device.attributes['fan_speed_list'] as unknown[]).includes(command.value))throw new Error('Potenza non supportata');service='set_fan_speed';data['fan_speed']=command.value;break;
    case 'set-number':{
      const min=Number(device.attributes['min']),max=Number(device.attributes['max']),step=Number(device.attributes['step']),steps=(command.value-min)/step;
      if(!Number.isFinite(command.value)||command.value<min||command.value>max||Math.abs(steps-Math.round(steps))>1e-6)throw new Error('Valore fuori intervallo o passo non valido');service='set_value';data['value']=command.value;break;
    }
    case 'set-time':if(!/^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(command.value))throw new Error('Orario non valido');service='set_value';data['time']=command.value.length===5?command.value+':00':command.value;break;
    case 'clean-areas':if(!command.areaIds.length||command.areaIds.length>100||command.areaIds.some(id=>!id||id.length>200)||new Set(command.areaIds).size!==command.areaIds.length)throw new Error('Seleziona stanze valide');service='clean_area';data['cleaning_area_id']=[...command.areaIds];break;
  }
  return {domain:device.domain,service,service_data:data,target:{entity_id:device.entityId}};
}
export function canCommand(device:SmartDevice):boolean{return device.state!=='unavailable'&&(device.state!=='unknown'||['button','select','number','time'].includes(device.domain));}
export * from './vacuum-groups';
