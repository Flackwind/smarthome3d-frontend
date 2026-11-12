import { ProviderId, RobotPosition, SmartDevice } from '@sh3d/device-model';
import { Floor, HomeProject, Point2, pointInPolygon, projectRobotPosition } from '@sh3d/home-model';

/** Runtime view state, never copied into project geometry or exported telemetry. */
export function robotPlacements(project:HomeProject,floor:Floor,provider:ProviderId,devices:readonly SmartDevice[],positions:Readonly<Record<string,RobotPosition>>):Record<string,Point2>{
  const result:Record<string,Point2>={};
  for(const binding of project.bindings){
    const object=floor.objects.find(o=>o.id===binding.objectId),calibration=binding.positionCalibration,position=positions[binding.entityId],device=devices.find(d=>d.entityId===binding.entityId);
    if(binding.provider!==provider||object?.type!=='vacuum'||!calibration||!position||device?.domain!=='vacuum'||device.state==='unavailable')continue;
    if(calibration.mapEntityId&&devices.find(d=>d.entityId===calibration.mapEntityId)?.state!==calibration.mapState)continue;
    try{const point=projectRobotPosition(position,calibration);if(Math.abs(point.x)<=10000&&Math.abs(point.y)<=10000&&(!floor.rooms.length||floor.rooms.some(room=>pointInPolygon(point,room.vertexIds.map(id=>floor.vertices.find(v=>v.id===id)!)))))result[object.id]=point;}catch{/* Imported invalid calibration cannot move the renderer. */}
  }
  return result;
}
