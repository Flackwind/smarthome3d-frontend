import { assertProject, createFloor, createProject, discoverRooms, distance, Floor, FloorplanReference, material, Point2, ROOM_PALETTE, uid } from '@sh3d/home-model';

import { obliqueWalls } from './oblique';
import { bridgeOpeningGaps, openingProposals } from './openings';

export interface PlanRaster { width:number; height:number; data:Uint8ClampedArray }
export interface DetectionOptions {
  threshold:number; minLength:number; minThickness:number; gap:number; mergeDistance:number;
  oblique?:boolean; openings?:boolean; openingMaxGap?:number;
}
export interface DetectedWall { id:number; start:Point2; end:Point2; thickness:number }
export interface DetectedOpening { id:number; wallId:number; offset:number; width:number; type:'door'|'window' }
export interface DetectionResult { walls:DetectedWall[]; openings:DetectedOpening[]; warnings:string[] }
export const DEFAULT_DETECTION:DetectionOptions={threshold:150,minLength:60,minThickness:2,gap:18,mergeDistance:10,oblique:true,openings:true,openingMaxGap:100};

interface Band { axis:'h'|'v'; coordinate:number; low:number; high:number; start:number; end:number }
/** Deterministic line detection, independent of DOM, rendering and device providers.
 * Options and coordinates are expressed in pixels of the supplied raster.
 */
export function detectPlanWalls(raster:PlanRaster,options:DetectionOptions=DEFAULT_DETECTION):DetectionResult {
  const {width,height,data}=raster;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<8||height<8||width*height>2_560_000||data.length!==width*height*4)throw new Error('Raster non valido o troppo grande per il riconoscimento');
  if(![options.threshold,options.minLength,options.minThickness,options.gap,options.mergeDistance,options.openingMaxGap??100].every(Number.isFinite)||options.threshold<0||options.threshold>255||options.minLength<8||options.minThickness<1||options.gap<0||options.gap>100||options.mergeDistance<0||options.mergeDistance>50||(options.openingMaxGap??100)<12||(options.openingMaxGap??100)>300)throw new Error('Parametri di riconoscimento non validi');
  const ink=new Uint8Array(width*height);
  for(let i=0;i<ink.length;i++){
    const offset=i*4,alpha=data[offset+3]/255;
    const luminance=(data[offset]*.2126+data[offset+1]*.7152+data[offset+2]*.0722)*alpha+255*(1-alpha);
    ink[i]=luminance<options.threshold?1:0;
  }
  const bands:Band[]=[];
  for(const axis of ['h','v'] as const){
    const rows=axis==='h'?height:width,columns=axis==='h'?width:height;
    let active:Band[]=[];
    for(let row=0;row<rows;row++){
      const next:Band[]=[];
      let start=-1,last=-1,count=0;
      const flush=()=>{
        if(start<0)return;
        const length=last-start+1;
        if(length>=options.minLength&&count/length>=.65){
          const previous=active.find(b=>!next.includes(b)&&Math.min(b.end,last)-Math.max(b.start,start)>=.7*Math.min(b.end-b.start,length));
          if(previous){previous.high=row;previous.coordinate=(previous.low+row)/2;previous.start=Math.min(previous.start,start);previous.end=Math.max(previous.end,last);next.push(previous);}
          else {const band:Band={axis,coordinate:row,low:row,high:row,start,end:last};bands.push(band);next.push(band);}
        }
        start=-1;last=-1;count=0;
      };
      for(let col=0;col<columns;col++){
        if(ink[axis==='h'?row*width+col:col*width+row]){if(start<0)start=col;last=col;count++;}
        else if(start>=0&&col-last>options.gap)flush();
      }
      flush();active=next;
    }
  }
  const filtered=bands.filter(b=>b.high-b.low+1>=options.minThickness&&b.high-b.low<Math.max(40,options.minLength*.65));
  // Collapse parallel outlines of the same wall, and aligned fragments separated
  // by small breaks. A minimum overlap prevents merging nearby distinct rooms.
  const merged:Band[]=[];
  for(const band of filtered.sort((a,b)=>(b.end-b.start)-(a.end-a.start))){
    const match=merged.find(b=>b.axis===band.axis&&Math.abs(b.coordinate-band.coordinate)<=options.mergeDistance&&Math.min(b.end,band.end)-Math.max(b.start,band.start)>=.65*Math.min(b.end-b.start,band.end-band.start));
    if(match){match.low=Math.min(match.low,band.low);match.high=Math.max(match.high,band.high);match.coordinate=(match.low+match.high)/2;match.start=Math.min(match.start,band.start);match.end=Math.max(match.end,band.end);}
    else merged.push({...band});
  }
  // Snap endpoints to perpendicular centre lines before splitting junctions.
  for(const band of merged){
    const tolerance=Math.max(options.mergeDistance,band.high-band.low+1)+2;
    for(const other of merged){
      if(other.axis===band.axis||band.coordinate<other.start-tolerance||band.coordinate>other.end+tolerance)continue;
      if(Math.abs(band.start-other.coordinate)<=tolerance)band.start=other.coordinate;
      if(Math.abs(band.end-other.coordinate)<=tolerance)band.end=other.coordinate;
    }
  }
  if(merged.length>300)throw new Error('Troppi tratti rilevati. Aumenta la lunghezza minima o riduci la soglia per escludere quote e arredi.');
  const walls=merged.map((b,id):DetectedWall=>({id,start:b.axis==='h'?{x:b.start,y:b.coordinate}:{x:b.coordinate,y:b.start},end:b.axis==='h'?{x:b.end,y:b.coordinate}:{x:b.coordinate,y:b.end},thickness:b.high-b.low+1}));
  if(options.oblique!==false)walls.push(...obliqueWalls(ink,width,height,options,walls));
  if(options.openings!==false)bridgeOpeningGaps(walls,options.openingMaxGap??100,options.mergeDistance);
  // Intersect supporting lines near their endpoints; arbitrary angles share a vertex.
  for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
    const a=walls[i],b=walls[j],r=sub(a.end,a.start),q=sub(b.start,a.start),v=sub(b.end,b.start),den=cross(r,v);
    if(Math.abs(den)<1e-7)continue;
    const t=cross(q,v)/den,u=cross(q,r)/den,la=distance(a.start,a.end),lb=distance(b.start,b.end),tolerance=Math.max(options.mergeDistance,a.thickness,b.thickness)+2;
    if(t*la< -tolerance||(t-1)*la>tolerance||u*lb< -tolerance||(u-1)*lb>tolerance)continue;
    const point=at(a,t);
    if(Math.abs(t*la)<=tolerance)a.start={...point};else if(Math.abs((t-1)*la)<=tolerance)a.end={...point};
    if(Math.abs(u*lb)<=tolerance)b.start={...point};else if(Math.abs((u-1)*lb)<=tolerance)b.end={...point};
  }
  walls.forEach((wall,id)=>wall.id=id);
  if(walls.length>300)throw new Error('Troppi tratti rilevati. Aumenta la lunghezza minima.');
  const openings=options.openings!==false?openingProposals(walls,ink,width,height,options):[];
  return {walls,openings,warnings:[
    'Analisi geometrica locale: verifica quote, arredi, pareti oblique e giunzioni nell’anteprima.',
    'Le aperture sono proposte da interruzioni o tratti poco pieni. Conferma ogni porta/finestra e il suo tipo: il disegno non consente sempre di distinguerli.',
    ...(!walls.length?['Nessun muro rilevato. Prova una soglia maggiore o una lunghezza minima inferiore.']:[])
  ]};
}

/** Convert a proposal into a shared, split planar graph in metric coordinates.
 * Existing floors, furniture and bindings are never mutated.
 */
export function generateFloor(walls:DetectedWall[],reference:FloorplanReference,name='Piano generato',ceilingHeight=2.7,elevation=0,openings:DetectedOpening[]=[]):Floor {
  if(!walls.length||walls.length>300)throw new Error('Seleziona da 1 a 300 tratti per generare il piano');
  if(!Number.isFinite(reference.metersPerPixel)||reference.metersPerPixel<.00001||reference.metersPerPixel>1||!Number.isFinite(reference.rotation)||![reference.origin.x,reference.origin.y,ceilingHeight,elevation].every(Number.isFinite))throw new Error('Scala o posizione non valida');
  for(const wall of walls){
    if(![wall.start.x,wall.start.y,wall.end.x,wall.end.y,wall.thickness].every(Number.isFinite)||wall.thickness<=0||distance(wall.start,wall.end)<=0)throw new Error('Tratto rilevato non valido');
  }
  const floor=createFloor(name.slice(0,200)),angle=reference.rotation*Math.PI/180,scale=reference.metersPerPixel;
  floor.ceilingHeight=ceilingHeight;floor.elevation=elevation;
  floor.floorplan={...structuredClone(reference),id:uid()};
  const position=(point:Point2):Point2=>({x:Number((reference.origin.x+(point.x*Math.cos(angle)-point.y*Math.sin(angle))*scale).toFixed(6)),y:Number((reference.origin.y+(point.x*Math.sin(angle)+point.y*Math.cos(angle))*scale).toFixed(6))});
  const vertices=new Map<string,string>(),pairs=new Set<string>();
  const vertex=(point:Point2)=>{const transformed=position(point),key=`${transformed.x}/${transformed.y}`;let id=vertices.get(key);if(!id){id=floor.vertices.find(v=>distance(v,transformed)<1e-5)?.id;if(!id){id=uid();floor.vertices.push({id,...transformed});}vertices.set(key,id);}return id;};
  if(openings.length>1000||new Set(walls.map(w=>w.id)).size!==walls.length)throw new Error('Proposte duplicate o troppe aperture');
  for(const opening of openings){const wall=walls.find(w=>w.id===opening.wallId);if(!wall||!['door','window'].includes(opening.type)||![opening.offset,opening.width].every(Number.isFinite)||opening.offset<0||opening.width*scale<.1||opening.offset+opening.width>distance(wall.start,wall.end)+1e-6)throw new Error('Apertura proposta non valida o fuori dal muro');}
  for(const wall of walls){
    const length=distance(wall.start,wall.end),r=sub(wall.end,wall.start),cuts=new Set([0,1]);
    for(const other of walls){
      if(other===wall)continue;const v=sub(other.end,other.start),q=sub(other.start,wall.start),den=cross(r,v);
      if(Math.abs(den)>1e-7){const t=cross(q,v)/den,u=cross(q,r)/den;if(t>1e-7&&t<1-1e-7&&u>=-1e-7&&u<=1+1e-7)cuts.add(t);}
      else if(Math.abs(cross(q,r))<1e-5){for(const point of [other.start,other.end]){const t=((point.x-wall.start.x)*r.x+(point.y-wall.start.y)*r.y)/(length*length);if(t>1e-7&&t<1-1e-7)cuts.add(t);}}
    }
    const ordered=[...cuts].sort((a,b)=>a-b).filter((value,i,all)=>i===0||value-all[i-1]>1e-8),local=openings.filter(o=>o.wallId===wall.id).sort((a,b)=>a.offset-b.offset);
    for(let i=0;i<local.length;i++){
      const opening=local[i];if(i&&local[i-1].offset+local[i-1].width>opening.offset+1e-6)throw new Error('Aperture proposte sovrapposte');
      if(ordered.some(t=>t*length>opening.offset+1e-5&&t*length<opening.offset+opening.width-1e-5))throw new Error('Un’apertura attraversa una giunzione: escludila o correggi i muri prima di generare.');
    }
    for(let i=0;i<ordered.length-1;i++){
      const low=ordered[i]*length,high=ordered[i+1]*length;
      if((high-low)*scale<.05)throw new Error('Alcuni segmenti misurano meno di 5 cm. Verifica la scala o escludi i dettagli nell’anteprima.');
      const a=vertex(at(wall,ordered[i])),b=vertex(at(wall,ordered[i+1])),key=[a,b].sort().join('/');
      if(pairs.has(key)){if(local.some(o=>o.offset>=low-1e-5&&o.offset+o.width<=high+1e-5))throw new Error('Apertura su muri duplicati: escludi il tratto sovrapposto.');continue;}pairs.add(key);
      floor.walls.push({id:uid(),startId:a,endId:b,height:ceilingHeight,thickness:Math.max(.06,Math.min(.5,wall.thickness*scale)),material:material('#f8f8fc'),openings:local.filter(o=>o.offset>=low-1e-5&&o.offset+o.width<=high+1e-5).map(o=>({id:uid(),type:o.type,offset:Math.max(0,(o.offset-low)*scale),width:o.width*scale,height:Math.min(o.type==='door'?2.1:1.2,ceilingHeight-(o.type==='window'?Math.min(.9,ceilingHeight/3):0)),sill:o.type==='window'?Math.min(.9,ceilingHeight/3):0}))});
    }
  }
  if(floor.vertices.length>2000||floor.walls.length>2000)throw new Error('Piano troppo complesso. Escludi i dettagli o aumenta la lunghezza minima.');
  discoverRooms(floor);
  floor.rooms.forEach((room,i)=>room.material=material(ROOM_PALETTE[i%ROOM_PALETTE.length]));
  const check=createProject('Verifica generazione');check.building.floors=[floor];assertProject(check);
  return floor;
}

const sub=(a:Point2,b:Point2):Point2=>({x:a.x-b.x,y:a.y-b.y});
const cross=(a:Point2,b:Point2):number=>a.x*b.y-a.y*b.x;
const at=(wall:DetectedWall,t:number):Point2=>({x:wall.start.x+(wall.end.x-wall.start.x)*t,y:wall.start.y+(wall.end.y-wall.start.y)*t});
