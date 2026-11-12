import * as THREE from 'three';
export { validateEmbeddedGlb } from './glb';
import { distance, Floor, FurnitureObject, HomeProject, Room, ROOM_PALETTE, Wall } from '@sh3d/home-model';

export interface WallSegment { x:number; y:number; width:number; height:number }
/** Partition along every opening edge, then fill only solid vertical intervals. */
export function wallSegments(length:number,wall:Wall):WallSegment[] {
  if(!Number.isFinite(length)||length<.05)throw new Error('Muro degenere');
  if(!Number.isFinite(wall.height)||wall.height<.5||!Number.isFinite(wall.thickness)||wall.thickness<.03)throw new Error('Dimensioni muro non valide');
  const ordered=[...wall.openings].sort((a,b)=>a.offset-b.offset);
  for(const [i,o] of ordered.entries())if(![o.offset,o.width,o.height,o.sill].every(Number.isFinite)||o.offset<0||o.width<=0||o.height<=0||o.sill<0||o.offset+o.width>length+1e-6||o.sill+o.height>wall.height+1e-6||(i>0&&ordered[i-1].offset+ordered[i-1].width>o.offset+1e-6))throw new Error('Aperture muro non valide');
  const edges=[...new Set([0,length,...wall.openings.flatMap(o=>[o.offset,o.offset+o.width])])].sort((a,b)=>a-b);
  const pieces:WallSegment[]=[];
  for(let i=0;i<edges.length-1;i++) {
    const left=edges[i],right=edges[i+1],middle=(left+right)/2;
    const holes=wall.openings.filter(o=>o.offset<middle&&o.offset+o.width>middle).map(o=>[o.sill,o.sill+o.height]).sort((a,b)=>a[0]-b[0]);
    let bottom=0;
    for(const [low,high] of [...holes,[wall.height,wall.height]]) {
      if(low>bottom+1e-6)pieces.push({x:(left+right)/2,y:(bottom+low)/2,width:right-left,height:low-bottom});bottom=Math.max(bottom,high);
    }
  }
  return pieces;
}
const standard=(color:string,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness});
export function createWallMesh(floor:Floor,wall:Wall):THREE.Group {
  const a=floor.vertices.find(v=>v.id===wall.startId),b=floor.vertices.find(v=>v.id===wall.endId);
  if(!a||!b)throw new Error('Vertici muro mancanti');
  const group=new THREE.Group();group.name=wall.id;group.userData['wallId']=wall.id;
  group.position.set(a.x,0,a.y);group.rotation.y=-Math.atan2(b.y-a.y,b.x-a.x);
  const mat=standard(wall.material.color,wall.material.roughness);
  for(const piece of wallSegments(distance(a,b),wall)) {
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(piece.width,piece.height,wall.thickness),mat);
    mesh.position.set(piece.x,piece.y,0);mesh.receiveShadow=true;group.add(mesh);
  }
  // Transparent glass occupies the window opening; doors remain physically open.
  for(const o of wall.openings)if(o.type==='window'){
    const glass=new THREE.Mesh(new THREE.BoxGeometry(o.width,o.height,.025),new THREE.MeshStandardMaterial({color:'#9ac6ca',transparent:true,opacity:.17,roughness:.25,depthWrite:false}));glass.position.set(o.offset+o.width/2,o.sill+o.height/2,0);group.add(glass);
  }
  return group;
}
export function createFloorMesh(floor:Floor,room:Room):THREE.Mesh {
  const points=room.vertexIds.map(id=>floor.vertices.find(v=>v.id===id)).filter(v=>v!==undefined);
  if(points.length!==room.vertexIds.length||points.length<3)throw new Error('Pavimento non valido');
  const shape=new THREE.Shape(points.map(v=>new THREE.Vector2(v.x,-v.y)));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.09,bevelEnabled:false,steps:1,curveSegments:1});
  geometry.rotateX(-Math.PI/2);geometry.translate(0,-.09,0);
  const mesh=new THREE.Mesh(geometry,standard(room.material.color));mesh.name=room.id;mesh.userData['roomId']=room.id;mesh.receiveShadow=true;return mesh;
}
export function createFurnitureMesh(object:FurnitureObject):THREE.Group {
  const root=new THREE.Group();root.name=object.name;root.userData['objectId']=object.id;
  const mat=standard(object.material.color),dark=standard('#303a38'),light=standard('#e1dacb'),wood=standard('#8d7456');
  const add=(geometry:THREE.BufferGeometry,x:number,y:number,z:number,material:THREE.Material=mat)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;};
  const box=(w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material=mat)=>add(new THREE.BoxGeometry(w,h,d),x,y,z,m);
  const cylinder=(top:number,bottom:number,h:number,x:number,y:number,z:number,m:THREE.Material=mat)=>add(new THREE.CylinderGeometry(top,bottom,h,20),x,y,z,m);
  switch(object.type){
    case 'sofa':box(.92,.24,.92,0,.3,0);box(1,.52,.18,0,.68,-.41);for(const x of [-.44,.44])box(.12,.38,.95,x,.51,0);for(const x of [-.22,.22])box(.39,.12,.65,x,.48,.06,light);for(const x of [-.36,.36])for(const z of [-.35,.35])box(.06,.18,.06,x,.09,z,dark);break;
    case 'table':box(1,.09,1,0,.93,0);for(const x of [-.39,.39])for(const z of [-.35,.35])box(.05,.89,.07,x,.45,z,wood);break;
    case 'bed':box(1,.35,1,0,.2,0,wood);box(.97,.32,.96,0,.51,0);box(.98,.08,.61,0,.71,.15,light);for(const x of [-.23,.23])box(.4,.14,.2,x,.73,-.32,light);box(1,.9,.06,0,.5,-.47,wood);break;
    case 'plant':cylinder(.28,.2,.33,0,.17,0,standard('#a88564'));for(let i=0;i<7;i++){const a=i*2.4;const leaf=add(new THREE.SphereGeometry(.23,10,8),Math.cos(a)*.17,.56+(i%3)*.1,Math.sin(a)*.17,mat);leaf.scale.set(.55,1.2,.85);}break;
    case 'floor-lamp':cylinder(.34,.4,.035,0,.02,0,dark);cylinder(.028,.028,.72,0,.38,0,dark);cylinder(.27,.49,.23,0,.84,0);break;
    case 'bulb':cylinder(.18,.18,.3,0,.15,0,dark);add(new THREE.SphereGeometry(.44,20,16),0,.57,0);break;
    case 'ceiling-light':cylinder(.5,.5,.65,0,.35,0);break;
    case 'led-strip':box(1,1,1,0,.5,0);break;
    case 'vacuum':cylinder(.49,.49,.8,0,.4,0);cylinder(.15,.15,.25,0,.91,-.1,dark);box(.7,.1,.08,0,.7,.41,dark);break;
    case 'radiator':for(let i=0;i<8;i++)box(.095,1,1,-.44+i*.125,.5,0);break;
    case 'sensor':box(.9,.9,.8,0,.45,0);add(new THREE.SphereGeometry(.12,12,10),0,.5,.4,dark);break;
    case 'outlet':box(1,1,.7,0,.5,0);for(const x of [-.2,.2])cylinder(.07,.07,.1,x,.52,.4,dark).rotation.x=Math.PI/2;break;
    case 'switch':box(1,1,.5,0,.5,0);box(.7,.7,.2,0,.5,.32,dark);break;
  }
  if(['bulb','floor-lamp','ceiling-light','led-strip'].includes(object.type)) {
    mat.emissive=new THREE.Color('#ffe1a5');mat.emissiveIntensity=0;root.userData['lightMaterial']=mat;
    const point=new THREE.PointLight('#ffdfaa',0,5,2);point.position.set(0,.75,0);point.castShadow=false;point.userData['virtualLight']=true;root.add(point);
  }
  root.position.set(object.position.x,object.position.y,object.position.z);root.rotation.set(object.rotation.x,object.rotation.y,object.rotation.z);
  root.scale.set(object.dimensions.x*object.scale.x,object.dimensions.y*object.scale.y,object.dimensions.z*object.scale.z);
  // Materials made for another furniture type are not retained by a mesh.
  const retained=new Set<THREE.Material>();root.traverse(o=>{if(o instanceof THREE.Mesh)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>retained.add(m));});
  for(const m of [mat,dark,light,wood])if(!retained.has(m))m.dispose();
  return root;
}
export function createFloorGroup(floor:Floor,presentation:'model'|'map'='model'):THREE.Group {
  const root=new THREE.Group();root.position.y=floor.elevation;root.name=floor.id;
  for(const room of floor.rooms)root.add(createFloorMesh(floor,room));
  for(const wall of floor.walls)root.add(createWallMesh(floor,wall));
  for(const object of floor.objects)root.add(createFurnitureMesh(object));
  if(presentation==='map'){
    for(const child of root.children){
      if(child.userData['wallId']){
        const wall=floor.walls.find(w=>w.id===child.userData['wallId'])!;child.scale.y=Math.min(1,.85/wall.height);
        child.traverse(node=>{if(node instanceof THREE.Mesh){
          const materials=Array.isArray(node.material)?node.material:[node.material];
          for(const mat of materials)if(mat instanceof THREE.MeshStandardMaterial){mat.color.set('#ffffff');mat.transparent=true;mat.opacity=.48;mat.depthWrite=false;mat.toneMapped=false;}
          const outline=new THREE.LineSegments(new THREE.EdgesGeometry(node.geometry),new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,toneMapped:false}));node.add(outline);
        }});
      }else if(child.userData['roomId']){
        const mesh=child as THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>,index=floor.rooms.findIndex(r=>r.id===child.userData['roomId']);
        if(['#b5a48c','#a5b6ad','#a5b9c2','#a5a4b9','#b5a58c'].includes(floor.rooms[index].material.color))mesh.material.color.set(ROOM_PALETTE[index%ROOM_PALETTE.length]);
        const previous=mesh.material,color=previous.color.clone().lerp(new THREE.Color('#ffffff'),.12);previous.dispose();
        // Flat room colours stay legible regardless of the virtual sun or lights.
        (child as THREE.Mesh).material=new THREE.MeshBasicMaterial({color,toneMapped:false});
      }
    }
  }
  return root;
}
export function geometryFingerprint(project:HomeProject,floorId:string):string {
  const f=project.building.floors.find(f=>f.id===floorId);if(!f)return '';
  return JSON.stringify({elevation:f.elevation,vertices:f.vertices,walls:f.walls,rooms:f.rooms,objects:f.objects});
}
export function objectIdFromHit(object:THREE.Object3D):string|undefined {
  let current:THREE.Object3D|null=object;while(current){if(typeof current.userData['objectId']==='string')return current.userData['objectId'] as string;current=current.parent;}return undefined;
}
export function disposeObject(root:THREE.Object3D):void {
  const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>(),textures=new Set<THREE.Texture>();
  root.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.LineSegments){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const value of Object.values(m))if(value instanceof THREE.Texture)textures.add(value);}}});
  geometries.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());root.removeFromParent();root.clear();
}
