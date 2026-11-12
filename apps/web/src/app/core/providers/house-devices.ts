import { ProviderId, SmartDevice } from '@sh3d/device-model';
import { HomeProject } from '@sh3d/home-model';

export interface HouseDevice {entityId:string;name:string;device?:SmartDevice}
/** Only explicit bindings to actual objects belong to a house. Areas and names are not ownership. */
export function houseDevices(project:HomeProject,devices:SmartDevice[],provider:ProviderId):HouseDevice[]{
  const objects=new Map(project.building.floors.flatMap(f=>f.objects).map(o=>[o.id,o]));
  const result=new Map<string,HouseDevice>();
  for(const b of project.bindings)if(b.provider===provider&&objects.has(b.objectId)&&!result.has(b.entityId)){
    const device=devices.find(d=>d.entityId===b.entityId);
    result.set(b.entityId,{entityId:b.entityId,name:device?.name??objects.get(b.objectId)!.name,device});
  }
  return [...result.values()];
}
export function houseEntities(project:HomeProject,devices:SmartDevice[],provider:ProviderId,entityId?:string):SmartDevice[]{
  const primary=houseDevices(project,devices,provider).filter(d=>entityId===undefined||d.entityId===entityId);
  const ids=new Set(primary.map(d=>d.entityId));
  for(const b of project.bindings)if(b.provider===provider&&ids.has(b.entityId))for(const id of b.relatedEntityIds)ids.add(id);
  return devices.filter(d=>ids.has(d.entityId)||primary.some(p=>p.device&&(
    !!p.device.deviceId&&d.deviceId===p.device.deviceId||!!p.device.deviceGroupId&&d.deviceGroupId===p.device.deviceGroupId)));
}
export function electricMeasurement(device:SmartDevice,mode:'power'|'counter'):boolean {
  return device.domain==='sensor'&&(mode==='power'?['W','kW']:['Wh','kWh','MWh']).includes(String(device.attributes['unit_of_measurement']));
}
