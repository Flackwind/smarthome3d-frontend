import { Building, Floor, FURNITURE_CATALOG, FurnitureObject, FurnitureType, HomeProject, material, uid } from './model';
import { drawWall } from './editing';

/** Copy the JSON tree while reusing immutable string storage, notably raster data URLs. */
export function cloneProject(project:HomeProject):HomeProject {
  const copy=(value:unknown):unknown=>{
    if(Array.isArray(value))return value.map(copy);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,copy(v)]));
    return value;
  };
  return copy(project) as HomeProject;
}

export function createFloor(name='Piano terra'):Floor {return {id:uid(),name,elevation:0,ceilingHeight:2.7,vertices:[],walls:[],rooms:[],objects:[]};}
export function createProject(name='La mia casa'):HomeProject {
  const building:Building={id:uid(),name,floors:[createFloor()]};
  return {schemaVersion:1,id:uid(),name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),building,bindings:[],scene:{quality:'medium',theme:'dark',showWalls:true,presentation:'map',camera:{position:{x:4,y:14,z:15},target:{x:4,y:0,z:4}}}};
}
export function createFurniture(type:FurnitureType,x=2,z=2,roomId?:string):FurnitureObject {
  const item=FURNITURE_CATALOG.find(i=>i.type===type)!;
  return {id:uid(),name:item.name,type,roomId,position:{x,y:type==='ceiling-light'?2.4:0,z},rotation:{x:0,y:0,z:0},scale:{x:1,y:1,z:1},dimensions:{...item.dimensions},material:material(item.color)};
}
export function createDemoProject():HomeProject {
  const p=createProject('Casa Aurora'),f=p.building.floors[0];
  const rect=(x:number,y:number,w:number,h:number,name:string,color:string)=>{
    drawWall(f,{x,y},{x:x+w,y});drawWall(f,{x:x+w,y},{x:x+w,y:y+h});drawWall(f,{x:x+w,y:y+h},{x,y:y+h});drawWall(f,{x,y:y+h},{x,y});
    const room=f.rooms.find(r=>!['Soggiorno','Cucina','Camera','Bagno'].includes(r.name))!;room.name=name;room.material=material(color);
  };
  rect(0,0,5,5,'Soggiorno','#c8e8a5');rect(5,0,3,3,'Cucina','#f5df98');rect(5,3,3,2,'Bagno','#b6d7ff');rect(0,5,8,3.5,'Camera','#efc4e8');
  // After shared-edge splits room IDs are retained by discoverRooms.
  const room=(name:string)=>f.rooms.find(r=>r.name===name)!.id;
  const add=(type:FurnitureType,x:number,z:number,name:string,r:string)=>{const o=createFurniture(type,x,z,room(r));o.name=name;f.objects.push(o);return o;};
  add('sofa',1.25,1.1,'Divano','Soggiorno');add('table',2.5,2.7,'Tavolino','Soggiorno');add('plant',.6,4.3,'Monstera','Soggiorno');
  add('table',6.6,1.4,'Tavolo cucina','Cucina');add('bed',2,6.8,'Letto','Camera');add('plant',7.3,7.8,'Pianta camera','Camera');
  const lamp=add('floor-lamp',.7,2.6,'Luce soggiorno','Soggiorno');
  const led=add('led-strip',6.5,.25,'LED sottopensile','Cucina');led.position.y=1.5;
  const bulb=add('bulb',4,6,'Luce camera','Camera');bulb.position.y=1.2;
  const robot=add('vacuum',4,4.3,'Robot aspirapolvere','Soggiorno');
  const sensor=add('sensor',7.6,4.4,'Clima bagno','Bagno');sensor.position.y=1.3;
  const radiator=add('radiator',6,8.2,'Riscaldamento','Camera');radiator.position.y=.2;
  [[lamp,'light.mock_living'],[led,'light.mock_kitchen'],[bulb,'light.mock_bedroom'],[robot,'vacuum.mock_robot'],[sensor,'sensor.mock_temperature'],[radiator,'climate.mock_heating']].forEach(([obj,entity])=>p.bindings.push({id:uid(),objectId:(obj as FurnitureObject).id,provider:'mock',entityId:entity as string,relatedEntityIds:entity==='vacuum.mock_robot'?['sensor.mock_robot_battery']:[]}));
  const outside=f.walls.find(w=>{const a=f.vertices.find(v=>v.id===w.startId)!,b=f.vertices.find(v=>v.id===w.endId)!;return a.y===0&&b.y===0&&Math.abs(a.x-b.x)>=5;})!;
  outside.openings.push({id:uid(),type:'window',offset:1.5,width:2,height:1.2,sill:.9});
  const door=f.walls.find(w=>{const a=f.vertices.find(v=>v.id===w.startId)!,b=f.vertices.find(v=>v.id===w.endId)!;return a.x===5&&b.x===5&&Math.abs(a.y-b.y)>=3;})!;
  door.openings.push({id:uid(),type:'door',offset:1,width:.9,height:2.1,sill:0});
  return p;
}
