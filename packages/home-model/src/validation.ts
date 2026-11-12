import { distance, FURNITURE_CATALOG, HomeProject, Point2, SCHEMA_VERSION } from './model';
import { validRobotCalibration } from './robot-position';
import { validateEnergy } from './energy';
import { validDashboard } from './dashboard';

export function polygonArea(points: Point2[]): number {
  return points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.y - q.x * p.y; }, 0) / 2;
}
const cross = (a: Point2, b: Point2, c: Point2) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const interiorOnSegment=(p:Point2,a:Point2,b:Point2)=>Math.abs(cross(a,b,p))<1e-7&&(p.x-a.x)*(p.x-b.x)+(p.y-a.y)*(p.y-b.y)<-1e-7;
const onBoundary=(p:Point2,points:Point2[])=>points.some((a,i)=>{const b=points[(i+1)%points.length];return Math.abs(cross(a,b,p))<1e-7&&(p.x-a.x)*(p.x-b.x)+(p.y-a.y)*(p.y-b.y)<=1e-7;});
export function segmentsCross(a: Point2,b: Point2,c: Point2,d: Point2): boolean {
  return cross(a,b,c)*cross(a,b,d) < -1e-9 && cross(c,d,a)*cross(c,d,b) < -1e-9;
}
export function pointInPolygon(p: Point2, points: Point2[]): boolean {
  let inside = false;
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const a=points[i],b=points[j];
    if ((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) inside=!inside;
  }
  return inside;
}
type Rec = Record<string, unknown>;
const record = (v: unknown): Rec => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Rec : {};
const list = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const finite = (v: unknown, min=-10000, max=10000): v is number => typeof v==='number' && Number.isFinite(v) && v>=min && v<=max;
const label = (v: unknown): v is string => typeof v==='string' && v.length>0 && v.length<=200;
const vector = (v:unknown, positive=false) => ['x','y','z'].every(k=>finite(record(v)[k], positive ? .001 : -10000));
const validMaterial=(v:unknown)=> /^#[0-9a-f]{6}$/i.test(String(record(v)['color'])) && finite(record(v)['roughness'],0,1);

/** Validate untrusted JSON before passing it to geometry, UI or persistence. */
export function validateProject(value: unknown): string[] {
  const errors: string[]=[];
  const p=record(value), building=record(p['building']), scene=record(p['scene']);
  const check=(condition:unknown,message:string)=>{if(!condition) errors.push(message);};
  if(p['energy']!==undefined)errors.push(...validateEnergy(p['energy']));
  if(p['dashboard']!==undefined)check(validDashboard(p['dashboard']),'Configurazione temperature dashboard non valida');
  const ids=new Set<string>();
  const id=(v:unknown)=>{check(label(v)&&!ids.has(String(v)),`ID mancante o duplicato: ${String(v)}`);ids.add(String(v));};
  check(p['schemaVersion']===SCHEMA_VERSION,'Versione schema non supportata'); id(p['id']);id(building['id']);
  check(label(p['name'])&&label(building['name']),'Nome abitazione non valido');
  check(['createdAt','updatedAt'].every(k=>typeof p[k]==='string'&&Number.isFinite(Date.parse(String(p[k])))),'Date progetto non valide');
  check(Array.isArray(building['floors'])&&list(building['floors']).length>0&&list(building['floors']).length<=20,'Piani non validi (1–20)');
  check(Array.isArray(p['bindings']),'Associazioni non valide');
  check(['low','medium','high'].includes(String(scene['quality']))&&['dark','light'].includes(String(scene['theme']))&&typeof scene['showWalls']==='boolean','Preferenze scena non valide');
  check(vector(record(scene['camera'])['position'])&&vector(record(scene['camera'])['target']),'Telecamera non valida');
  check(scene['presentation']===undefined||['model','map'].includes(String(scene['presentation'])),'Stile scena non valido');
  const objectIds=new Set<string>();
  for(const raw of list(building['floors'])) {
    const f=record(raw);id(f['id']); check(label(f['name']),'Nome piano non valido');
    check(finite(f['elevation'],-100,100)&&finite(f['ceilingHeight'],.5,10),'Altezza piano non valida');
    for(const key of ['vertices','walls','rooms','objects']) check(Array.isArray(f[key])&&list(f[key]).length<=2000,`Lista ${key} non valida o troppo grande`);
    const vertices=new Map<string,Point2>(),positions=new Set<string>();
    for(const rawV of list(f['vertices'])) {const v=record(rawV);id(v['id']);check(finite(v['x'])&&finite(v['y']),'Coordinate vertice non valide');const key=`${Number(v['x']).toFixed(6)},${Number(v['y']).toFixed(6)}`;check(!positions.has(key),'Vertici sovrapposti: riutilizzare lo stesso vertice');positions.add(key);vertices.set(String(v['id']),{x:Number(v['x']),y:Number(v['y'])});}
    const walls=new Map<string,Rec>(), pairs=new Set<string>();
    for(const rawW of list(f['walls'])) {
      const w=record(rawW);id(w['id']);walls.set(String(w['id']),w);
      const a=vertices.get(String(w['startId'])), b=vertices.get(String(w['endId']));
      check(a&&b&&distance(a,b)>=.05,'Muro degenere o riferimenti mancanti');
      const pair=[w['startId'],w['endId']].sort().join(':');check(!pairs.has(pair),'Muri condivisi duplicati');pairs.add(pair);
      check(finite(w['height'],.5,10)&&finite(w['thickness'],.03,1)&&validMaterial(w['material']),'Dimensioni o materiale muro non validi');
      check(Array.isArray(w['openings'])&&list(w['openings']).length<=50,'Aperture non valide');
      const openings=list(w['openings']).map(record).sort((x,y)=>Number(x['offset'])-Number(y['offset']));
      for(const [i,o] of openings.entries()) {
        id(o['id']);check(['door','window'].includes(String(o['type'])),'Tipo apertura non valido');
        check(finite(o['offset'],0)&&finite(o['width'],.1)&&finite(o['height'],.1)&&finite(o['sill'],0),'Misure apertura non valide');
        check(Number(o['offset'])+Number(o['width'])<=(a&&b?distance(a,b):0)+1e-6 && Number(o['height'])+Number(o['sill'])<=Number(w['height'])+1e-6,'Apertura fuori dal muro');
        if(i>0)check(Number(openings[i-1]['offset'])+Number(openings[i-1]['width'])<=Number(o['offset'])+1e-6,'Aperture sovrapposte');
      }
    }
    const wallList=[...walls.values()];
    for(let i=0;i<wallList.length;i++)for(let j=i+1;j<wallList.length;j++) {
      const a=vertices.get(String(wallList[i]['startId'])),b=vertices.get(String(wallList[i]['endId'])),c=vertices.get(String(wallList[j]['startId'])),d=vertices.get(String(wallList[j]['endId']));
      if(a&&b&&c&&d){check(!segmentsCross(a,b,c,d),'Muri intersecati: dividere il muro nel punto di incrocio');check(!interiorOnSegment(a,c,d)&&!interiorOnSegment(b,c,d)&&!interiorOnSegment(c,a,b)&&!interiorOnSegment(d,a,b),'Muri sovrapposti o giunzione non divisa');}
    }
    const roomIds=new Set<string>();
    for(const rawR of list(f['rooms'])) {
      const r=record(rawR);id(r['id']);roomIds.add(String(r['id']));check(label(r['name'])&&validMaterial(r['material']),'Nome o materiale stanza non valido');
      const refs=list(r['vertexIds']).map(String), wallRefs=list(r['wallIds']).map(String);
      const points=refs.map(ref=>vertices.get(ref));
      check(refs.length>=3&&new Set(refs).size===refs.length&&points.every(Boolean)&&Math.abs(polygonArea(points.filter((v):v is Point2=>!!v)))>=.01,'Poligono stanza non valido');
      check(wallRefs.length===refs.length&&wallRefs.every(ref=>walls.has(ref)),'Muri della stanza mancanti');
      refs.forEach((ref,i)=>check(wallRefs.some(wid=>{const w=walls.get(wid);return w && [w['startId'],w['endId']].includes(ref)&&[w['startId'],w['endId']].includes(refs[(i+1)%refs.length]);}),'Contorno stanza incoerente'));
      for(let i=0;i<points.length;i++)for(let j=i+2;j<points.length;j++){const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];if(a&&b&&c&&d)check(!segmentsCross(a,b,c,d),'Stanza auto-intersecata');}
    }
    const polygons=list(f['rooms']).map(record).map(r=>list(r['vertexIds']).map(id=>vertices.get(String(id)))).filter((points):points is Point2[]=>points.length>=3&&points.every(Boolean));
    for(let i=0;i<polygons.length;i++)for(let j=i+1;j<polygons.length;j++){const a=polygons[i],b=polygons[j];check(!a.some(p=>!onBoundary(p,b)&&pointInPolygon(p,b))&&!b.some(p=>!onBoundary(p,a)&&pointInPolygon(p,a)),'Stanze sovrapposte o contorno con fori non supportato');}
    for(const rawO of list(f['objects'])) {
      const o=record(rawO);id(o['id']);objectIds.add(String(o['id']));
      check(label(o['name'])&&FURNITURE_CATALOG.some(t=>t.type===o['type']),'Oggetto non valido');
      check(vector(o['position'])&&vector(o['rotation'])&&vector(o['scale'],true)&&vector(o['dimensions'],true)&&validMaterial(o['material']),'Trasformazione o materiale oggetto non valido');
      check(!o['roomId']||roomIds.has(String(o['roomId'])),'Stanza oggetto mancante');
      check(!o['assetId']||label(o['assetId']),'Asset non valido');
    }
    if(f['floorplan']) {
      const fp=record(f['floorplan']);id(fp['id']);
      check(fp['calibrated']===undefined||typeof fp['calibrated']==='boolean','Calibrazione planimetria non valida');
      check(label(fp['name'])&&label(fp['originalAssetId'])&&typeof fp['dataUrl']==='string'&&/^data:image\/(png|jpeg);base64,/.test(fp['dataUrl'])&&fp['dataUrl'].length<=30_000_000,'Immagine planimetria non valida');
      check(finite(fp['width'],1,10000)&&finite(fp['height'],1,10000)&&finite(fp['metersPerPixel'],.00001,1)&&finite(fp['rotation'],-360,360)&&finite(fp['opacity'],0,1)&&finite(record(fp['origin'])['x'])&&finite(record(fp['origin'])['y']),'Scala o posizione planimetria non valida');
    }
  }
  const bound=new Set<string>();
  for(const rawB of list(p['bindings'])) {
    const b=record(rawB);id(b['id']);check(objectIds.has(String(b['objectId']))&&!bound.has(String(b['objectId'])),'Oggetto associazione mancante o duplicato');bound.add(String(b['objectId']));
    check(['mock','home-assistant'].includes(String(b['provider']))&&typeof b['entityId']==='string'&&/^[a-z_]+\.[a-z0-9_]+$/.test(b['entityId']),'Entità o provider non valido');
    check(Array.isArray(b['relatedEntityIds'])&&list(b['relatedEntityIds']).every(x=>typeof x==='string'&&/^[a-z_]+\.[a-z0-9_]+$/.test(x)),'Entità collegate non valide');
    check(b['positionCalibration']===undefined||validRobotCalibration(b['positionCalibration']),'Allineamento posizione robot non valido');
  }
  return [...new Set(errors)];
}
export function assertProject(value: unknown): asserts value is HomeProject {
  const errors=validateProject(value);if(errors.length)throw new Error(errors.slice(0,8).join('; '));
}
const redact=(key:string,value:unknown):unknown=> /token|password|secret|credential|authorization/i.test(key)?undefined:value;
export function serializeProject(project: HomeProject): string { assertProject(project); return JSON.stringify(project,redact,2); }
/** v0 was the unversioned prototype, with the same structure but no schemaVersion. */
export function migrateProject(value: unknown): HomeProject {
  const p=record(value);if(!('schemaVersion' in p)||p['schemaVersion']===0) p['schemaVersion']=1;
  assertProject(p);return JSON.parse(JSON.stringify(p,redact)) as HomeProject;
}
export function parseProject(json: string): HomeProject {
  if(json.length>35_000_000)throw new Error('Progetto troppo grande (massimo 35 MB)');
  return migrateProject(JSON.parse(json,redact));
}
