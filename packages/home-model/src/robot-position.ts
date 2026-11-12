import { distance, Point2, RobotMapCalibration } from './model';

export function validRobotCalibration(value:unknown):value is RobotMapCalibration{
  if(!value||typeof value!=='object')return false;const c=value as RobotMapCalibration;
  const point=(p:Point2)=>p&&typeof p.x==='number'&&typeof p.y==='number'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Math.abs(p.x)<=1e9&&Math.abs(p.y)<=1e9;
  return !!(point(c.sourceA)&&point(c.sourceB)&&point(c.homeA)&&point(c.homeB)&&[c.homeA.x,c.homeA.y,c.homeB.x,c.homeB.y].every(v=>Math.abs(v)<=10000)&&distance(c.sourceA,c.sourceB)>1e-6&&distance(c.homeA,c.homeB)>=.05&&typeof c.flipY==='boolean'&&
    ((c.mapEntityId===undefined&&c.mapState===undefined)||(typeof c.mapEntityId==='string'&&/^[a-z_]+\.[a-z0-9_]+$/.test(c.mapEntityId)&&typeof c.mapState==='string'&&c.mapState.length>0&&c.mapState.length<=200)));
}
/** Similarity transform from two measured point pairs; no assumed native units. */
export function projectRobotPosition(point:Point2,c:RobotMapCalibration):Point2{
  if(!validRobotCalibration(c)||![point.x,point.y].every(Number.isFinite))throw new Error('Allineamento posizione non valido: servono due punti distinti');
  const sign=c.flipY?-1:1,dx=c.sourceB.x-c.sourceA.x,dy=(c.sourceB.y-c.sourceA.y)*sign,hx=c.homeB.x-c.homeA.x,hy=c.homeB.y-c.homeA.y;
  const angle=Math.atan2(hy,hx)-Math.atan2(dy,dx),scale=Math.hypot(hx,hy)/Math.hypot(dx,dy),x=point.x-c.sourceA.x,y=(point.y-c.sourceA.y)*sign;
  return {x:c.homeA.x+(x*Math.cos(angle)-y*Math.sin(angle))*scale,y:c.homeA.y+(x*Math.sin(angle)+y*Math.cos(angle))*scale};
}
