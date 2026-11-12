import { distance, Floor, material, Point2, uid, Vertex, Wall } from './model';
import { polygonArea, segmentsCross } from './validation';

export function nearestPointOnWall(p: Point2,a:Point2,b:Point2):{point:Point2;t:number;distance:number} {
  const length2=(b.x-a.x)**2+(b.y-a.y)**2;
  const t=length2?Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/length2)):0;
  const point={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};return {point,t,distance:distance(p,point)};
}
export function snapPoint(floor:Floor,p:Point2,grid=.25,tolerance=.18):Point2 {
  const vertex=floor.vertices.find(v=>distance(v,p)<tolerance);if(vertex)return {x:vertex.x,y:vertex.y};
  const rounded={x:Math.round(p.x/grid)*grid,y:Math.round(p.y/grid)*grid};
  for(const w of floor.walls) {
    const a=floor.vertices.find(v=>v.id===w.startId)!,b=floor.vertices.find(v=>v.id===w.endId)!;
    const hit=nearestPointOnWall(rounded,a,b);if(hit.distance<.06)return hit.point;
  }
  return rounded;
}
function ensureVertex(f:Floor,p:Point2):Vertex {
  const existing=f.vertices.find(v=>distance(v,p)<.01);if(existing)return existing;
  const v:Vertex={id:uid(),...p};f.vertices.push(v);
  for(const w of [...f.walls]) {
    const a=f.vertices.find(v=>v.id===w.startId)!,b=f.vertices.find(v=>v.id===w.endId)!;
    const hit=nearestPointOnWall(p,a,b);if(hit.distance>.01||hit.t<.001||hit.t>.999)continue;
    const offset=distance(a,p);
    if(w.openings.some(o=>o.offset<offset&&o.offset+o.width>offset))throw new Error('Non dividere un muro dentro una porta o finestra');
    const end=w.endId;w.endId=v.id;
    const second:Wall={...structuredClone(w),id:uid(),startId:v.id,endId:end,openings:w.openings.filter(o=>o.offset>=offset).map(o=>({...o,offset:o.offset-offset}))};
    w.openings=w.openings.filter(o=>o.offset<offset);f.walls.push(second);
  }
  return v;
}
/** Mutates a transaction draft; overlapping edges are reused, never duplicated. */
export function drawWall(f:Floor,start:Point2,end:Point2):void {
  if(distance(start,end)<.05)throw new Error('Il muro deve misurare almeno 5 cm');
  for(const w of f.walls) {
    const a=f.vertices.find(v=>v.id===w.startId)!,b=f.vertices.find(v=>v.id===w.endId)!;
    if(segmentsCross(start,end,a,b))throw new Error('Termina il muro sul punto di incrocio prima di continuare');
  }
  const a=ensureVertex(f,start),b=ensureVertex(f,end);
  // Split a new edge at existing collinear vertices, supporting adjacent rooms.
  const chain=f.vertices.filter(v=>nearestPointOnWall(v,a,b).distance<.005).sort((u,v)=>distance(a,u)-distance(a,v));
  for(let i=0;i<chain.length-1;i++) {
    const x=chain[i],y=chain[i+1];
    if(!f.walls.some(w=>[w.startId,w.endId].includes(x.id)&&[w.startId,w.endId].includes(y.id)))
      f.walls.push({id:uid(),startId:x.id,endId:y.id,height:f.ceilingHeight,thickness:.15,material:material(),openings:[]});
  }
  discoverRooms(f);
}
/** Traverse directed half-edges to find bounded faces in a planar wall graph. */
export function discoverRooms(f:Floor):void {
  const old=f.rooms, adjacency=new Map<string,string[]>();
  for(const w of f.walls){adjacency.set(w.startId,[...(adjacency.get(w.startId)??[]),w.endId]);adjacency.set(w.endId,[...(adjacency.get(w.endId)??[]),w.startId]);}
  // Unfinished partitions remain editable walls, but do not form a room border.
  // Peel dangling branches before traversing faces, which must be simple cycles.
  const dangling=[...adjacency.keys()].filter(id=>adjacency.get(id)!.length<2);
  for(let i=0;i<dangling.length;i++){
    const id=dangling[i];for(const neighbor of adjacency.get(id)??[]){const next=adjacency.get(neighbor)!.filter(value=>value!==id);adjacency.set(neighbor,next);if(next.length===1)dangling.push(neighbor);}adjacency.delete(id);
  }
  const vertex=(id:string)=>f.vertices.find(v=>v.id===id)!;
  for(const [id,neighbors] of adjacency)neighbors.sort((a,b)=>Math.atan2(vertex(a).y-vertex(id).y,vertex(a).x-vertex(id).x)-Math.atan2(vertex(b).y-vertex(id).y,vertex(b).x-vertex(id).x));
  const used=new Set<string>();const rooms:Floor['rooms']=[];const reused=new Set<string>();
  for(const [a,neighbors] of adjacency)for(const b of neighbors) {
    if(used.has(`${a}/${b}`))continue;
    const path:string[]=[];let u=a,v=b;
    for(let step=0;step<=f.walls.length*2;step++) {
      const edge=`${u}/${v}`;if(used.has(edge))break;used.add(edge);path.push(u);
      const around=adjacency.get(v)!;const next=around[(around.indexOf(u)-1+around.length)%around.length];u=v;v=next;
      if(u===a&&v===b)break;
    }
    if(u!==a||v!==b||new Set(path).size!==path.length||polygonArea(path.map(vertex))<.01)continue;
    const previous=old.find(r=>!reused.has(r.id)&&r.vertexIds.filter(id=>path.includes(id)).length>=Math.min(r.vertexIds.length,path.length)-1);
    if(previous)reused.add(previous.id);
    rooms.push({id:previous?.id??uid(),name:previous?.name??`Stanza ${rooms.length+1}`,vertexIds:path,wallIds:path.map((id,i)=>f.walls.find(w=>[w.startId,w.endId].includes(id)&&[w.startId,w.endId].includes(path[(i+1)%path.length]))!.id),material:previous?.material??material('#b5a58c')});
  }
  f.rooms=rooms;for(const o of f.objects)if(o.roomId&&!rooms.some(r=>r.id===o.roomId))delete o.roomId;
}
export function removeWall(f:Floor,id:string):void { f.walls=f.walls.filter(w=>w.id!==id);f.vertices=f.vertices.filter(v=>f.walls.some(w=>w.startId===v.id||w.endId===v.id));discoverRooms(f); }
