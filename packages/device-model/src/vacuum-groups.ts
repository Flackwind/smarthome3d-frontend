import type { SmartDevice } from './index';

export interface VacuumGroup { robot:SmartDevice; members:SmartDevice[] }
export interface EntityRelation { entityId:string; relatedEntityIds:readonly string[] }
/** Membership comes from registry identity or explicit user links, never names or areas. */
export function vacuumGroups(devices:readonly SmartDevice[],relations:readonly EntityRelation[]=[]):VacuumGroup[]{
  const groups:VacuumGroup[]=[],family=(d:SmartDevice)=>d.deviceGroupId??d.deviceId;
  for(const robot of devices.filter(d=>d.domain==='vacuum')){
    const existing=groups.find(g=>family(robot)&&family(g.robot)===family(robot));
    if(existing)continue;groups.push({robot,members:[]});
  }
  for(const entity of devices){
    let group=groups.find(g=>g.robot.entityId===entity.entityId||(family(entity)&&family(entity)===family(g.robot)));
    if(!group)group=groups.find(g=>relations.some(r=>r.entityId===g.robot.entityId&&r.relatedEntityIds.includes(entity.entityId)));
    group?.members.push(entity);
  }
  return groups;
}
export interface VacuumSection { id:string; title:string; entities:SmartDevice[] }
export function vacuumSections(group:VacuumGroup):VacuumSection[]{
  const result:VacuumSection[]=[{id:'routines',title:'Routine e comandi',entities:[]},{id:'dock',title:'Base di ricarica',entities:[]},{id:'status',title:'Sensori e pulizia',entities:[]},{id:'settings',title:'Impostazioni',entities:[]},{id:'diagnostics',title:'Manutenzione e diagnostica',entities:[]},{id:'maps',title:'Mappe',entities:[]}];
  for(const entity of group.members){
    if(entity.entityId===group.robot.entityId)continue;
    const id=['image','camera'].includes(entity.domain)?'maps':entity.deviceId&&group.robot.deviceId&&entity.deviceId!==group.robot.deviceId?'dock':entity.domain==='button'&&entity.entityCategory!=='diagnostic'&&entity.entityCategory!=='config'?'routines':entity.entityCategory==='diagnostic'?'diagnostics':entity.entityCategory==='config'||['select','number','time','switch'].includes(entity.domain)?'settings':'status';
    result.find(s=>s.id===id)!.entities.push(entity);
  }
  return result.filter(s=>s.entities.length>0);
}
export function vacuumBattery(group:VacuumGroup):number|undefined{
  const direct=group.robot.attributes['battery_level'];
  if(typeof direct==='number'&&Number.isFinite(direct)&&direct>=0&&direct<=100)return direct;
  const sensor=group.members.find(d=>d.domain==='sensor'&&d.attributes['device_class']==='battery'&&(!group.robot.deviceId||d.deviceId===group.robot.deviceId));
  if(!sensor||!sensor.state.trim())return undefined;const value=Number(sensor.state);return Number.isFinite(value)&&value>=0&&value<=100?value:undefined;
}
