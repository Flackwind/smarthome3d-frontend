import { describe,expect,it } from 'vitest';
import { createDemoProject, createProject, FloorplanReference, validateProject } from '@sh3d/home-model';
import { DEFAULT_DETECTION, detectPlanWalls, DetectedWall, generateFloor, PlanRaster } from '@sh3d/floorplan-engine';

const reference:FloorplanReference={id:'reference',originalAssetId:'asset',name:'Pianta.png',dataUrl:'data:image/png;base64,AAAA',width:400,height:300,metersPerPixel:.025,rotation:0,origin:{x:0,y:0},opacity:.45};
function raster():PlanRaster{return {width:400,height:300,data:new Uint8ClampedArray(400*300*4).fill(255)};}
function rectangle(image:PlanRaster,x:number,y:number,w:number,h:number):void{for(let row=y;row<y+h;row++)for(let column=x;column<x+w;column++){const index=(row*image.width+column)*4;image.data[index]=image.data[index+1]=image.data[index+2]=0;}}
function twoRooms():PlanRaster{const image=raster();rectangle(image,30,30,340,6);rectangle(image,30,264,340,6);rectangle(image,30,30,6,240);rectangle(image,364,30,6,240);rectangle(image,197,30,6,240);return image;}

describe('Floorplan generation',()=>{
  it('detects shared walls and builds two valid metric rooms without duplicated edges',()=>{
    const result=detectPlanWalls(twoRooms(),DEFAULT_DETECTION);expect(result.walls).toHaveLength(5);
    const floor=generateFloor(result.walls,reference),project=createProject();project.building.floors=[floor];
    expect(floor.rooms).toHaveLength(2);expect(floor.walls).toHaveLength(7);expect(validateProject(project)).toEqual([]);
    expect(Math.max(...floor.vertices.map(v=>v.x))-Math.min(...floor.vertices.map(v=>v.x))).toBeCloseTo(8.35);
    expect(floor.rooms[0].material.color).not.toBe(floor.rooms[1].material.color);
  });
  it('filters text-sized strokes, transparent pixels and isolated noise',()=>{
    const image=twoRooms();rectangle(image,80,90,15,3);rectangle(image,110,90,13,3);
    for(let x=60;x<180;x++){const offset=(120*image.width+x)*4;image.data[offset]=0;image.data[offset+1]=0;image.data[offset+2]=0;image.data[offset+3]=0;}
    expect(detectPlanWalls(image).walls).toHaveLength(5);
  });
  it('closes only configured gaps and leaves room boundaries open when closure is disabled',()=>{
    const image=twoRooms();for(let row=140;row<150;row++)for(let x=197;x<203;x++){const i=(row*image.width+x)*4;image.data[i]=image.data[i+1]=image.data[i+2]=255;}
    expect(generateFloor(detectPlanWalls(image,{...DEFAULT_DETECTION,gap:12}).walls,reference).rooms).toHaveLength(2);
    expect(generateFloor(detectPlanWalls(image,{...DEFAULT_DETECTION,gap:0,openings:false}).walls,reference).rooms).toHaveLength(1);
  });
  it('merges parallel outlines into one centre line',()=>{
    const image=raster();rectangle(image,30,50,300,2);rectangle(image,30,59,300,2);
    const result=detectPlanWalls(image);expect(result.walls).toHaveLength(1);expect(result.walls[0].start.y).toBe(55);
  });
  it('splits a true cross junction before constructing rooms, including rotation and origin',()=>{
    const walls:DetectedWall[]=[{id:0,start:{x:10,y:100},end:{x:390,y:100},thickness:6},{id:1,start:{x:200,y:10},end:{x:200,y:290},thickness:6}];
    const floor=generateFloor(walls,{...reference,rotation:90,origin:{x:12,y:-2}},'Primo piano',3,4);
    const project=createProject();project.building.floors=[floor];expect(floor.walls).toHaveLength(4);expect(floor.vertices).toHaveLength(5);expect(floor.elevation).toBe(4);expect(floor.vertices.some(v=>v.x===9.5&&v.y===3)).toBe(true);expect(validateProject(project)).toEqual([]);
  });
  it('allows exclusions, preserves source projects and rejects incorrect geometry or scale',()=>{
    const original=createDemoProject(),copy=JSON.stringify(original),result=detectPlanWalls(twoRooms());
    const floor=generateFloor(result.walls.filter(w=>w.start.x!==199.5),reference);expect(floor.rooms).toHaveLength(1);expect(JSON.stringify(original)).toBe(copy);expect(floor.floorplan?.id).not.toBe(reference.id);
    expect(()=>generateFloor(result.walls,{...reference,metersPerPixel:NaN})).toThrow('Scala');
    expect(()=>generateFloor([{id:1,start:{x:0,y:0},end:{x:0,y:0},thickness:4}],reference)).toThrow('Tratto');
    expect(()=>detectPlanWalls({...raster(),width:1})).toThrow('Raster');
  });
  it('reports an empty image without inventing a house',()=>{const result=detectPlanWalls(raster());expect(result.walls).toEqual([]);expect(result.warnings.join(' ')).toContain('Nessun muro');});
});

function stroke(image:PlanRaster,a:{x:number;y:number},b:{x:number;y:number},thickness=6):void {const dx=b.x-a.x,dy=b.y-a.y,l2=dx*dx+dy*dy;for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++){const t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/l2));if(Math.hypot(x-a.x-t*dx,y-a.y-t*dy)<=thickness/2)rectangle(image,x,y,1,1);}}
describe('Oblique walls and reviewed openings',()=>{
  it('recognizes non-45-degree walls and closes a valid skew room',()=>{
    const image=raster(),points=[{x:70,y:35},{x:320,y:110},{x:320,y:260},{x:70,y:185}];for(let i=0;i<4;i++)stroke(image,points[i],points[(i+1)%4],8);
    const result=detectPlanWalls(image,{...DEFAULT_DETECTION,openings:false});
    expect(result.walls).toHaveLength(4);expect(result.walls.filter(w=>Math.abs(w.end.x-w.start.x)>50&&Math.abs(w.end.y-w.start.y)>30)).toHaveLength(2);
    const floor=generateFloor(result.walls,reference),project=createProject();project.building.floors=[floor];expect(floor.rooms).toHaveLength(1);expect(validateProject(project)).toEqual([]);
  });
  it.each([
    [{x:130,y:30},{x:340,y:150},{x:260,y:285},{x:50,y:165}],
    [{x:70,y:110},{x:320,y:35},{x:320,y:185},{x:70,y:260}]
  ])('closes a rotated or reflected quadrilateral (%j)',(...points)=>{const image=raster();for(let i=0;i<4;i++)stroke(image,points[i],points[(i+1)%4],8);const result=detectPlanWalls(image,{...DEFAULT_DETECTION,openings:false});expect(result.walls).toHaveLength(4);const floor=generateFloor(result.walls,reference);expect(floor.rooms).toHaveLength(1);});
  it('finds the centre and thickness of an oblique outlined wall',()=>{const image=raster();stroke(image,{x:40,y:50},{x:340,y:140},2);stroke(image,{x:37,y:60},{x:337,y:150},2);const result=detectPlanWalls(image,{...DEFAULT_DETECTION,openings:false});expect(result.walls).toHaveLength(1);expect(result.walls[0].thickness).toBeGreaterThan(9);expect(result.walls[0].thickness).toBeLessThan(16);});
  it('proposes a door gap and an outlined window, without silently creating openings',()=>{
    const image=raster();rectangle(image,25,60,120,8);rectangle(image,180,60,190,8);rectangle(image,25,190,120,8);rectangle(image,180,190,190,8);rectangle(image,145,190,35,1);rectangle(image,145,197,35,1);
    const result=detectPlanWalls(image,{...DEFAULT_DETECTION,oblique:false,gap:0});expect(result.walls).toHaveLength(2);expect(result.openings.map(o=>o.type).sort()).toEqual(['door','window']);
    expect(generateFloor(result.walls,reference).walls.flatMap(w=>w.openings)).toEqual([]);
    const floor=generateFloor(result.walls,reference,'Aperture',2.7,0,result.openings);expect(floor.walls.flatMap(w=>w.openings).map(o=>o.type).sort()).toEqual(['door','window']);const project=createProject();project.building.floors=[floor];expect(validateProject(project)).toEqual([]);
  });
  it('splits arbitrary crossings and overlaps and places metric openings after a cut',()=>{
    const walls:DetectedWall[]=[{id:0,start:{x:20,y:20},end:{x:320,y:220},thickness:8},{id:1,start:{x:170,y:0},end:{x:170,y:290},thickness:8}];
    const opening={id:0,wallId:0,offset:230,width:35,type:'door' as const};const floor=generateFloor(walls,{...reference,rotation:31,origin:{x:2,y:-3}},'Obliqua',2.7,0,[opening]);expect(floor.walls).toHaveLength(4);expect(floor.vertices).toHaveLength(5);const made=floor.walls.flatMap(w=>w.openings);expect(made).toHaveLength(1);expect(made[0].width).toBeCloseTo(.875);expect(made[0].offset).toBeCloseTo((230-Math.hypot(150,100))*.025);
    expect(()=>generateFloor(walls,reference,'Incrocio',2.7,0,[{...opening,offset:170}])).toThrow('giunzione');
    expect(()=>generateFloor(walls,reference,'Sovrapposte',2.7,0,[opening,{...opening,id:1,offset:240}])).toThrow('sovrapposte');
    const overlap=generateFloor([walls[0],{...walls[0],id:2,start:{x:80,y:60},end:{x:260,y:180}}],reference);expect(overlap.walls).toHaveLength(3);
  });
  it('keeps open ends and full wall outlines free of invented openings',()=>{const image=raster();rectangle(image,25,60,300,2);rectangle(image,25,69,300,2);const result=detectPlanWalls(image,{...DEFAULT_DETECTION,oblique:false});expect(result.openings).toEqual([]);});
});
