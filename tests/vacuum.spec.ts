import { describe,expect,it } from 'vitest';
import { canCommand, commandToService, fromHassState, SmartDevice, vacuumBattery, vacuumGroups, vacuumSections } from '@sh3d/device-model';
import { createDemoProject, projectRobotPosition, RobotMapCalibration, validateProject } from '@sh3d/home-model';
import { enrichEntity, RegistryData } from '../apps/web/src/app/core/home-assistant/registry';
import { robotPlacements } from '../apps/web/src/app/core/providers/robot-placements';

const device=(entityId:string,state='off',attributes:Record<string,unknown>={}):SmartDevice=>fromHassState({entity_id:entityId,state,attributes:{friendly_name:entityId,...attributes}});
const registry:RegistryData={
  entities:[{entity_id:'vacuum.a',device_id:'robot-a',platform:'roborock'},{entity_id:'sensor.a_battery',device_id:'robot-a',platform:'roborock'},{entity_id:'switch.a_dock',device_id:'dock-a',platform:'roborock'},{entity_id:'vacuum.b',device_id:'robot-b',platform:'roborock'},{entity_id:'sensor.b_battery',device_id:'robot-b',platform:'roborock'}],
  devices:[{id:'robot-a',name:'Robot',area_id:'storage',identifiers:[['roborock','identifier-a']]},{id:'dock-a',name:'Robot Dock',area_id:'storage',identifiers:[['roborock','identifier-a_dock']]},{id:'robot-b',name:'Robot',area_id:'storage',identifiers:[['roborock','identifier-b']]}],areas:[{area_id:'storage',name:'Ripostiglio'}],floors:[]
};
const calibration:RobotMapCalibration={sourceA:{x:20000,y:25000},sourceB:{x:24000,y:25000},homeA:{x:1,y:1},homeB:{x:5,y:1},flipY:false};

describe('Vacuum devices and positions',()=>{
  it('groups an exact robot/dock identity without merging robots with the same name or area',()=>{
    const entities=['vacuum.a','sensor.a_battery','switch.a_dock','vacuum.b','sensor.b_battery'].map(id=>enrichEntity(device(id),registry));
    const groups=vacuumGroups(entities);expect(groups).toHaveLength(2);expect(groups[0].members.map(d=>d.entityId)).toEqual(['vacuum.a','sensor.a_battery','switch.a_dock']);expect(groups[1].members).toHaveLength(2);expect(groups[0].members[2].deviceId).toBe('dock-a');
  });
  it('does not infer ownership from names and supports explicit links when registries are unavailable',()=>{
    const robot=device('vacuum.a'),sensor=device('sensor.a_battery');sensor.name='Robot a battery';
    expect(vacuumGroups([robot,sensor])[0].members).toHaveLength(1);expect(vacuumGroups([robot,sensor],[{entityId:robot.entityId,relatedEntityIds:[sensor.entityId]}])[0].members).toHaveLength(2);
  });
  it('keeps controls, dock, diagnostics and maps under the same parent with no duplicate members',()=>{
    const robot={...device('vacuum.a'),deviceId:'a',deviceGroupId:'a'},button={...device('button.smart','unknown'),deviceId:'a',deviceGroupId:'a'},dock={...device('switch.dock'),deviceId:'dock',deviceGroupId:'a'},diagnostic={...device('sensor.filter'),deviceId:'a',deviceGroupId:'a',entityCategory:'diagnostic'},map={...device('image.map'),deviceId:'a',deviceGroupId:'a'};
    const group=vacuumGroups([robot,button,dock,diagnostic,map])[0],sections=vacuumSections(group);expect(sections.map(s=>s.id)).toEqual(['routines','dock','diagnostics','maps']);expect(sections.flatMap(s=>s.entities)).toHaveLength(4);
  });
  it('shows zero battery correctly and does not use a different robot or dock battery',()=>{
    const robot={...device('vacuum.a'),deviceId:'a'},battery={...device('sensor.battery','0',{device_class:'battery'}),deviceId:'a'};
    expect(vacuumBattery({robot,members:[robot,battery]})).toBe(0);expect(vacuumBattery({robot,members:[robot,{...battery,deviceId:'dock'}]})).toBeUndefined();expect(vacuumBattery({robot,members:[robot,{...battery,state:'unknown'}]})).toBeUndefined();
  });
  it('allows never-run buttons while rejecting unavailable entities and invalid select options',()=>{
    const button=device('button.smart','unknown');expect(canCommand(button)).toBe(true);expect(commandToService(button,{type:'press'})).toMatchObject({domain:'button',service:'press'});expect(()=>commandToService({...button,state:'unavailable'},{type:'press'})).toThrow('non disponibile');
    const select=device('select.mop','unknown',{options:['balanced','deep']});expect(commandToService(select,{type:'select-option',value:'deep'}).service_data).toEqual({option:'deep'});expect(()=>commandToService(select,{type:'select-option',value:'unsupported'})).toThrow();
  });
  it('validates number steps, time values and fan modes before creating a service call',()=>{
    const number=device('number.volume','50',{min:0,max:100,step:5});expect(commandToService(number,{type:'set-number',value:55}).service_data).toEqual({value:55});for(const value of [-1,101,52,NaN])expect(()=>commandToService(number,{type:'set-number',value})).toThrow();
    expect(commandToService(device('time.dnd'),{type:'set-time',value:'23:30'}).service_data).toEqual({time:'23:30:00'});expect(()=>commandToService(device('time.dnd'),{type:'set-time',value:'25:90'})).toThrow();
    const robot=device('vacuum.a','docked',{supported_features:32,fan_speed_list:['quiet','turbo']});expect(commandToService(robot,{type:'fan-speed',value:'turbo'}).service_data).toEqual({fan_speed:'turbo'});expect(()=>commandToService(robot,{type:'fan-speed',value:'imaginary'})).toThrow();
  });
  it('aligns scale, translation, rotation and reflected axes using measured pairs',()=>{
    expect(projectRobotPosition({x:22000,y:27000},calibration)).toEqual({x:3,y:3});
    const rotated={...calibration,homeB:{x:1,y:5}};const point=projectRobotPosition({x:24000,y:25000},rotated);expect(point.x).toBeCloseTo(1);expect(point.y).toBeCloseTo(5);
    expect(projectRobotPosition({x:22000,y:27000},{...calibration,flipY:true})).toEqual({x:3,y:-1});expect(()=>projectRobotPosition({x:1,y:1},{...calibration,sourceB:calibration.sourceA})).toThrow();
  });
  it('updates only the runtime placement, respects provider/map/floor and keeps project geometry unchanged',()=>{
    const project=createDemoProject(),floor=project.building.floors[0],binding=project.bindings.find(b=>b.entityId==='vacuum.mock_robot')!;binding.positionCalibration={...calibration,mapEntityId:'select.map',mapState:'Ground'};const before=JSON.stringify(project),robot=device(binding.entityId,'cleaning'),map=device('select.map','Ground'),positions={[binding.entityId]:{x:22000,y:27000,updatedAt:new Date().toISOString()}};
    expect(robotPlacements(project,floor,'mock',[robot,map],positions)[binding.objectId]).toEqual({x:3,y:3});expect(JSON.stringify(project)).toBe(before);
    expect(robotPlacements(project,floor,'home-assistant',[robot,map],positions)).toEqual({});expect(robotPlacements(project,floor,'mock',[robot,{...map,state:'Upstairs'}],positions)).toEqual({});expect(robotPlacements(project,floor,'mock',[robot,map],{[binding.entityId]:{...positions[binding.entityId],x:999999}})).toEqual({});
    expect(validateProject(project)).toEqual([]);binding.positionCalibration.sourceB={...binding.positionCalibration.sourceA};expect(validateProject(project)).toContain('Allineamento posizione robot non valido');
  });
});
