import * as THREE from 'three';
import { Floor, HomeProject, pointInPolygon, Point2 } from '@sh3d/home-model';
import { ProviderId, SmartDevice } from '@sh3d/device-model';
import { stateLabel } from '../../shared/utilities/device-display';

const smartTypes=new Set(['bulb','floor-lamp','ceiling-light','led-strip','radiator','sensor','vacuum','outlet','switch']);
const paths:Record<string,string>={
  light:'M9 18h6m-5 3h4M8.2 13.5a6 6 0 1 1 7.6 0c-1 .8-1.8 1.5-1.8 3.5h-4c0-2-.8-2.7-1.8-3.5Z',
  vacuum:'M20 12a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-11-1h6m-6 4h6m-4-8h2',
  sensor:'M7 4h10v16H7zM10 8h4m-2 3v5m-2-2h4',
  climate:'M10 5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0V5Zm2 3v8',
  outlet:'M7 3h10v18H7zM10 9v3m4-3v3m-4 4h4',
  switch:'M8 3h8v18H8zM10 7h4v6h-4z'
};
interface Anchor { element:HTMLElement; position:THREE.Vector3; objectId?:string }
/** Screen-space labels follow the camera; state updates never rebuild geometry. */
export class MapOverlay {
  private readonly root=document.createElement('div');private anchors:Anchor[]=[];
  constructor(host:HTMLElement,private readonly select:(id:string)=>void,private readonly translate:(text:string)=>string=text=>text){this.root.className='map-overlay';host.append(this.root);}
  setFloor(floor:Floor):void{
    this.root.replaceChildren();this.anchors=[];
    for(const room of floor.rooms){
      const points=room.vertexIds.map(id=>floor.vertices.find(v=>v.id===id)!),center=this.interior(points),label=document.createElement('span');
      label.className='map-room-label';label.textContent=room.name;this.root.append(label);this.anchors.push({element:label,position:new THREE.Vector3(center.x,floor.elevation+.02,center.y)});
    }
    for(const object of floor.objects.filter(o=>smartTypes.has(o.type))){
      const button=document.createElement('button');button.type='button';button.className='map-device-pin';button.dataset['objectId']=object.id;
      const kind=['bulb','floor-lamp','ceiling-light','led-strip'].includes(object.type)?'light':object.type==='radiator'?'climate':object.type;
      // The SVG paths are static application assets, not device-supplied markup.
      button.innerHTML=`<span class="pin-shape"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[kind]??paths['sensor']}"/></svg></span>`;
      button.addEventListener('click',event=>{event.stopPropagation();this.select(object.id);});
      this.root.append(button);this.anchors.push({element:button,position:new THREE.Vector3(object.position.x,floor.elevation+Math.max(.65,Math.min(1,object.position.y+.3)),object.position.z),objectId:object.id});
    }
  }
  updateStates(project:HomeProject,floor:Floor,devices:SmartDevice[],provider:ProviderId,selectedId:string,placements:Record<string,Point2>={}):void{
    for(const anchor of this.anchors){
      if(!anchor.objectId)continue;const object=floor.objects.find(o=>o.id===anchor.objectId)!,binding=project.bindings.find(b=>b.objectId===anchor.objectId&&b.provider===provider),device=devices.find(d=>d.entityId===binding?.entityId);
      const point=placements[object.id];anchor.position.x=point?.x??object.position.x;anchor.position.z=point?.y??object.position.z;
      const status=this.translate(device?stateLabel(device.state):'Non associato'),active=device&&(device.state==='on'||device.state==='cleaning'||device.state==='heat');
      anchor.element.classList.toggle('is-on',!!active);anchor.element.classList.toggle('is-unavailable',!device||['unavailable','unknown'].includes(device.state));anchor.element.classList.toggle('is-selected',anchor.objectId===selectedId);
      anchor.element.setAttribute('aria-label',`${this.translate('Seleziona')} ${object.name}: ${status}`);anchor.element.setAttribute('aria-pressed',String(anchor.objectId===selectedId));anchor.element.title=`${object.name} · ${status}`;
    }
  }
  visible(value:boolean):void{this.root.hidden=!value;}
  project(camera:THREE.Camera,width:number,height:number):void{
    for(const anchor of this.anchors){
      const point=anchor.position.clone().project(camera),visible=point.z>=-1&&point.z<=1&&Math.abs(point.x)<1.15&&Math.abs(point.y)<1.15;
      anchor.element.hidden=!visible;if(!visible)continue;
      anchor.element.style.left=`${(point.x*.5+.5)*width}px`;anchor.element.style.top=`${(-point.y*.5+.5)*height}px`;
      anchor.element.style.zIndex=anchor.objectId?String(10+Math.round((1-point.z)*1000)):'1';
    }
  }
  selectObject(id:string):void{for(const a of this.anchors)if(a.objectId){a.element.classList.toggle('is-selected',a.objectId===id);a.element.setAttribute('aria-pressed',String(a.objectId===id));}}
  private interior(points:Point2[]):Point2{
    let area=0,cx=0,cy=0;for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],cross=a.x*b.y-b.x*a.y;area+=cross;cx+=(a.x+b.x)*cross;cy+=(a.y+b.y)*cross;}
    const center=Math.abs(area)>1e-9?{x:cx/(3*area),y:cy/(3*area)}:points[0];if(pointInPolygon(center,points))return center;
    // Concave room centroids can fall outside. Choose the nearest interior sample.
    const xs=points.map(p=>p.x),ys=points.map(p=>p.y),lowX=Math.min(...xs),lowY=Math.min(...ys),w=Math.max(...xs)-lowX,h=Math.max(...ys)-lowY;
    const candidates:Point2[]=[];for(let x=1;x<10;x++)for(let y=1;y<10;y++){const p={x:lowX+w*x/10,y:lowY+h*y/10};if(pointInPolygon(p,points))candidates.push(p);}
    return candidates.sort((a,b)=>Math.hypot(a.x-center.x,a.y-center.y)-Math.hypot(b.x-center.x,b.y-center.y))[0]??points[0];
  }
  dispose():void{this.root.remove();this.anchors=[];}
}
