import { SmartDevice } from '@sh3d/device-model';
export interface RegistryEntry {
  entity_id?:string;device_id?:string;area_id?:string;id?:string;name?:string;name_by_user?:string;floor_id?:string;
  manufacturer?:string;model?:string;via_device_id?:string;identifiers?:[string,string][];
  platform?:string;entity_category?:string;translation_key?:string;
}
export interface RegistryData { entities:RegistryEntry[];devices:RegistryEntry[];areas:RegistryEntry[];floors:RegistryEntry[] }
export function enrichEntity(entity:SmartDevice,registry:RegistryData):SmartDevice{
  const registered=registry.entities.find(e=>e.entity_id===entity.entityId),device=registry.devices.find(d=>d.id===registered?.device_id),area=registry.areas.find(a=>a.area_id===(registered?.area_id??device?.area_id)),floor=registry.floors.find(f=>f.floor_id===area?.floor_id);
  let family=device?.id;
  // The Roborock integration registers the dock with the exact vacuum identifier
  // plus "_dock". Resolve this here, keeping manufacturer logic out of the UI.
  const identifier=device?.identifiers?.find(([domain])=>domain==='roborock')?.[1];
  if(identifier?.endsWith('_dock'))family=registry.devices.find(d=>d.identifiers?.some(([domain,id])=>domain==='roborock'&&id===identifier.slice(0,-5)))?.id??family;
  if(device?.via_device_id&&registry.entities.some(e=>e.device_id===device.via_device_id&&e.entity_id?.startsWith('vacuum.')))family=device.via_device_id;
  return {...entity,deviceId:registered?.device_id,deviceGroupId:family,deviceName:device?.name_by_user??device?.name,manufacturer:device?.manufacturer,model:device?.model,integration:registered?.platform,entityCategory:registered?.entity_category,translationKey:registered?.translation_key,areaId:area?.area_id,areaName:area?.name,floorName:floor?.name};
}
