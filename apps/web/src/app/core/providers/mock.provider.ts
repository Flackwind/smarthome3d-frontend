import { CleaningArea, commandToService, ConnectionStatus, DeviceCommand, fromHassState, ProviderSnapshot, RobotPosition, SmartDevice, SmartHomeProvider } from '@sh3d/device-model';

export class MockSmartHomeProvider implements SmartHomeProvider {
  readonly id='mock' as const;
  connectionStatus:ConnectionStatus='disconnected';
  private listeners=new Set<(s:ProviderSnapshot)=>void>();
  private devices:SmartDevice[]=[
    fromHassState({entity_id:'light.mock_living',state:'on',attributes:{friendly_name:'Luce soggiorno',supported_color_modes:['color_temp'],brightness:190,color_temp_kelvin:3000,min_color_temp_kelvin:2200,max_color_temp_kelvin:6500}}),
    fromHassState({entity_id:'light.mock_kitchen',state:'on',attributes:{friendly_name:'LED sottopensile',supported_color_modes:['brightness'],brightness:230}}),
    fromHassState({entity_id:'light.mock_bedroom',state:'off',attributes:{friendly_name:'Luce camera',supported_color_modes:['rgb','color_temp'],brightness:150,rgb_color:[255,195,120],min_color_temp_kelvin:2000,max_color_temp_kelvin:6500}}),
    fromHassState({entity_id:'sensor.mock_temperature',state:'21.8',attributes:{friendly_name:'Temperatura bagno',unit_of_measurement:'°C',device_class:'temperature'}}),
    fromHassState({entity_id:'sensor.mock_humidity',state:'46',attributes:{friendly_name:'Umidità bagno',unit_of_measurement:'%',device_class:'humidity'}}),
    fromHassState({entity_id:'binary_sensor.mock_motion',state:'off',attributes:{friendly_name:'Movimento ingresso',device_class:'motion'}}),
    fromHassState({entity_id:'vacuum.mock_robot',state:'docked',attributes:{friendly_name:'Robot dimostrativo',supported_features:8192|4|16|32,battery_level:87,fan_speed:'Bilanciato',fan_speed_list:['Silenzioso','Bilanciato','Turbo']}}),
    fromHassState({entity_id:'sensor.mock_robot_battery',state:'87',attributes:{friendly_name:'Batteria robot',device_class:'battery',unit_of_measurement:'%'}}),
    fromHassState({entity_id:'climate.mock_heating',state:'heat',attributes:{friendly_name:'Termostato camera',supported_features:1,current_temperature:20.5,temperature:21,hvac_action:'heating',hvac_modes:['off','heat','auto'],min_temp:5,max_temp:30}}),
    fromHassState({entity_id:'switch.mock_socket',state:'off',attributes:{friendly_name:'Presa studio'}}),
    fromHassState({entity_id:'sensor.mock_robot_cleaned_area',state:'23.4',attributes:{friendly_name:'Robot dimostrativo Area pulita',unit_of_measurement:'m²'}}),
    fromHassState({entity_id:'binary_sensor.mock_robot_water',state:'on',attributes:{friendly_name:'Robot dimostrativo Contenitore acqua collegato'}}),
    fromHassState({entity_id:'button.mock_robot_smart',state:'unknown',attributes:{friendly_name:'Robot dimostrativo Smart'}}),
    fromHassState({entity_id:'select.mock_robot_mop',state:'Bilanciato',attributes:{friendly_name:'Robot dimostrativo Intensità lavaggio',options:['Delicato','Bilanciato','Intenso']}}),
    fromHassState({entity_id:'switch.mock_robot_dock_empty',state:'off',attributes:{friendly_name:'Base robot Svuotamento polvere'}}),
    fromHassState({entity_id:'switch.mock_robot_dock_wash',state:'off',attributes:{friendly_name:'Base robot Lavaggio mocio'}}),
    fromHassState({entity_id:'sensor.mock_robot_filter',state:'110',attributes:{friendly_name:'Robot dimostrativo Filtro residuo',unit_of_measurement:'h'}}),
    fromHassState({entity_id:'image.mock_robot_map',state:'2026-11-03T12:00:00Z',attributes:{friendly_name:'Robot dimostrativo Mappa casa'}})
  ];
  private positionStep=0;
  constructor(){for(const d of this.devices.filter(d=>d.entityId.includes('mock_robot'))){d.deviceId=d.entityId.includes('_dock_')?'mock-dock':'mock-robot';d.deviceGroupId='mock-robot';d.deviceName=d.deviceId==='mock-dock'?'Base robot':'Robot dimostrativo';d.areaId='mock-storage';d.areaName='Ripostiglio';d.manufacturer='Demo';d.model='Robot dimostrativo';d.integration='mock';if(d.entityId.endsWith('_filter'))d.entityCategory='diagnostic';if(d.domain==='vacuum')d.capabilities.push('read-position','clean-areas');}}
  async getCleaningAreas(id:string):Promise<CleaningArea[]>{if(this.connectionStatus!=='connected'||id!=='vacuum.mock_robot')throw new Error('Pulizia per stanza non disponibile');return [{id:'mock-living',name:'Soggiorno'},{id:'mock-kitchen',name:'Cucina'}];}
  async readPosition(id:string):Promise<RobotPosition>{if(this.connectionStatus!=='connected'||id!=='vacuum.mock_robot')throw new Error('Posizione non disponibile');const moving=['cleaning','returning'].includes(this.getDeviceState(id)!.state);return {x:20000+(moving?this.positionStep++*500:0),y:25000,updatedAt:new Date().toISOString()};}
  async connect():Promise<void>{this.connectionStatus='connected';this.emit();}
  disconnect():void{this.connectionStatus='disconnected';this.emit();}
  getDevices():SmartDevice[]{return structuredClone(this.devices);}
  getDeviceState(id:string):SmartDevice|undefined{return this.getDevices().find(d=>d.entityId===id);}
  subscribeToUpdates(cb:(s:ProviderSnapshot)=>void):()=>void{this.listeners.add(cb);cb({status:this.connectionStatus,devices:this.getDevices()});return ()=>this.listeners.delete(cb);}
  async executeCommand(id:string,command:DeviceCommand):Promise<void> {
    if(this.connectionStatus!=='connected')throw new Error('Provider disconnesso');
    const d=this.devices.find(d=>d.entityId===id);if(!d)throw new Error('Entità sconosciuta');commandToService(d,command);
    switch(command.type){
      case 'power':d.state=command.value?'on':'off';break;
      case 'brightness':d.attributes['brightness']=Math.round(command.value*2.55);d.state=command.value>0?'on':'off';break;
      case 'color':d.attributes['rgb_color']=command.value;d.state='on';break;
      case 'color-temperature':d.attributes['color_temp_kelvin']=command.value;d.state='on';break;
      case 'temperature':d.attributes['temperature']=command.value;break;
      case 'hvac-mode':d.state=command.value;break;
      case 'clean-areas':{const areas=await this.getCleaningAreas(id);if(command.areaIds.some(id=>!areas.some(a=>a.id===id)))throw new Error('Stanza non associata');d.state='cleaning';d.attributes['cleaning_area_id']=[...command.areaIds];break;}
      case 'start':d.state='cleaning';break;
      case 'pause':d.state='paused';break;
      case 'return-to-base':d.state='returning';break;
      case 'press':d.state=new Date().toISOString();if(d.entityId==='button.mock_robot_smart')this.devices.find(item=>item.entityId==='vacuum.mock_robot')!.state='cleaning';break;
      case 'select-option':d.state=command.value;break;
      case 'set-number':d.state=String(command.value);break;
      case 'set-time':d.state=command.value.length===5?command.value+':00':command.value;break;
      case 'fan-speed':d.attributes['fan_speed']=command.value;break;
    }
    this.emit();
  }
  private emit():void{const snapshot={status:this.connectionStatus,devices:this.getDevices()};this.listeners.forEach(cb=>cb(snapshot));}
}
