import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createFloorGroup, disposeObject, geometryFingerprint, objectIdFromHit } from '@sh3d/geometry-engine';
import { Floor, HomeProject, Point2, Room, Vector3 } from '@sh3d/home-model';
import { ProviderId, SmartDevice } from '@sh3d/device-model';
import { MapOverlay } from './map-overlay';

/** Owns renderer resources; inputs are plain models, never IoT implementations. */
export class SceneController {
  private readonly renderer:THREE.WebGLRenderer;private readonly scene=new THREE.Scene();private readonly camera=new THREE.PerspectiveCamera(42,1,.1,300);
  private readonly controls:OrbitControls;private readonly observer:ResizeObserver;private home?:THREE.Group;private fingerprint='';private frame=0;private disposed=false;
  private selection?:THREE.BoxHelper;private selectedId='';private pointerDown={x:0,y:0};private quality='medium';private contextLost=false;
  private project?:HomeProject;private floor?:Floor;private resources=new Map<string,THREE.Group>();private assetGeneration=0;
  private readonly overlay:MapOverlay;private readonly grid:THREE.GridHelper;private presentation:'model'|'map'='map';
  private readonly sky=new THREE.HemisphereLight('#e3eddf','#576259',2.6);private readonly sun=new THREE.DirectionalLight('#ffe9ca',3.2);
  constructor(private readonly host:HTMLElement,private readonly select:(id:string)=>void,private readonly cameraChanged:(position:Vector3,target:Vector3)=>void,private readonly onError:(message:string)=>void,private readonly translate:(text:string)=>string=text=>text) {
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.setClearColor(0x000000,0);
    this.renderer.domElement.setAttribute('role','img');
    host.appendChild(this.renderer.domElement);this.overlay=new MapOverlay(host,select,translate);this.camera.position.set(12,13,15);
    this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.target.set(4,0,3);this.controls.enableDamping=false;this.controls.minDistance=1.5;this.controls.maxDistance=45;this.controls.maxPolarAngle=Math.PI/2.1;this.controls.minPolarAngle=.08;this.controls.maxTargetRadius=25;this.controls.screenSpacePanning=false;
    this.controls.addEventListener('change',this.invalidate);this.controls.addEventListener('end',this.persistCamera);
    this.scene.add(this.sky);this.sun.position.set(2,12,5);this.scene.add(this.sun);
    this.grid=new THREE.GridHelper(40,80,'#42544e','#273932');this.grid.material.transparent=true;this.grid.material.opacity=.32;this.grid.position.set(4,-.13,4);this.scene.add(this.grid);
    this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);
    this.renderer.domElement.addEventListener('pointerdown',this.pointerStart);this.renderer.domElement.addEventListener('pointerup',this.pointerEnd);
    this.renderer.domElement.addEventListener('dblclick',this.doubleClick);this.renderer.domElement.addEventListener('webglcontextlost',this.contextLoss);this.renderer.domElement.addEventListener('webglcontextrestored',this.contextRestore);
    document.addEventListener('visibilitychange',this.visibility);this.resize();
  }
  update(project:HomeProject,floor:Floor,devices:SmartDevice[],provider:ProviderId,placements:Record<string,Point2>={}):void {
    this.project=project;this.floor=floor;this.renderer.domElement.setAttribute('aria-label',this.translate('Modello tridimensionale della casa. Trascina per ruotare; usa due dita per zoom e pan.'));
    this.presentation=project.scene.presentation??'map';this.grid.visible=this.presentation==='model';this.overlay.visible(this.presentation==='map');
    this.renderer.setClearColor(this.presentation==='map'?'#f0f0f3':0x000000,this.presentation==='map'?1:0);
    this.renderer.toneMapping=this.presentation==='map'?THREE.ACESFilmicToneMapping:THREE.NoToneMapping;this.renderer.toneMappingExposure=1;
    this.sky.color.set(this.presentation==='map'?'#ffffff':'#e3eddf');this.sky.groundColor.set(this.presentation==='map'?'#bdc6d4':'#576259');this.sky.intensity=this.presentation==='map'?2:2.6;
    this.sun.color.set(this.presentation==='map'?'#ffffff':'#ffe9ca');this.sun.intensity=this.presentation==='map'?1.8:3.2;
    const fingerprint=project.id+floor.id+geometryFingerprint(project,floor.id)+this.presentation;
    if(this.fingerprint!==fingerprint){this.fingerprint=fingerprint;this.clearSelection();if(this.home)disposeObject(this.home);this.home=createFloorGroup(floor,this.presentation);this.scene.add(this.home);this.overlay.setFloor(floor);this.assetGeneration++;void this.loadAssets(floor,this.assetGeneration);}
    this.quality=project.scene.quality;const ratio={low:1,medium:1.5,high:2}[project.scene.quality];this.renderer.setPixelRatio(Math.min(devicePixelRatio,ratio));
    if(this.home)for(const child of this.home.children)if(child.userData['wallId'])child.visible=project.scene.showWalls;
    const maximumLights={low:0,medium:4,high:8}[project.scene.quality];let lights=0;
    this.home?.traverse(node=>{
      const id=node.userData['objectId'] as string|undefined;if(!id)return;
      const binding=project.bindings.find(b=>b.objectId===id&&b.provider===provider),device=devices.find(d=>d.entityId===binding?.entityId);
      const on=device?.domain==='light'&&device.state==='on',brightness=Number(device?.attributes['brightness']??255)/255;
      const rgb=device?.attributes['rgb_color'] as number[]|undefined;const color=Array.isArray(rgb)&&rgb.length>=3?new THREE.Color().setRGB(rgb[0]/255,rgb[1]/255,rgb[2]/255,THREE.SRGBColorSpace):new THREE.Color('#ffe0aa');
      const mat=node.userData['lightMaterial'] as THREE.MeshStandardMaterial|undefined;if(mat){mat.emissive.copy(color);mat.emissiveIntensity=on?1.1*brightness:0;}
      node.traverse(o=>{if(o instanceof THREE.PointLight){o.color.copy(color);o.intensity=on&&lights++<maximumLights?2*brightness:0;}});
    });
    for(const object of floor.objects){const mesh=this.findObject(object.id);if(mesh){const point=placements[object.id];mesh.position.x=point?.x??object.position.x;mesh.position.z=point?.y??object.position.z;}}
    this.overlay.updateStates(project,floor,devices,provider,this.selectedId,placements);this.highlight(this.selectedId);this.resize();
  }
  restoreCamera(position:Vector3,target:Vector3):void{this.camera.position.copy(position);this.controls.target.copy(target);this.controls.update();this.invalidate();}
  focusRoom(room:Room):void{if(!this.floor)return;const points=room.vertexIds.map(id=>this.floor!.vertices.find(v=>v.id===id)!);const box=new THREE.Box3().setFromPoints(points.map(p=>new THREE.Vector3(p.x,this.floor!.elevation,p.y)));this.focusBox(box);}
  focusObject(id:string):void{const object=this.findObject(id);if(object)this.focusBox(new THREE.Box3().setFromObject(object));}
  view(mode:'top'|'iso'|'fit'):void {
    if(mode==='fit'&&this.home){this.focusBox(new THREE.Box3().setFromObject(this.home));return;}
    const target=this.controls.target;const distance=Math.max(8,this.camera.position.distanceTo(target));
    this.camera.position.copy(target).add(mode==='top'?new THREE.Vector3(.01,distance,.01):this.presentation==='map'?new THREE.Vector3(distance*.04,distance*.95,distance*.8):new THREE.Vector3(distance*.65,distance*.8,distance*.8));this.controls.update();this.persistCamera();this.invalidate();
  }
  highlight(id:string):void{this.selectedId=id;this.overlay.selectObject(id);this.clearSelection();const o=this.findObject(id);if(o){this.selection=new THREE.BoxHelper(o,this.presentation==='map'?'#438e78':'#b8e8bf');this.scene.add(this.selection);}this.invalidate();}
  private findObject(id:string):THREE.Object3D|undefined{return this.home?.children.find(c=>c.userData['objectId']===id);}
  private focusBox(box:THREE.Box3):void{
    if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),direction=this.camera.position.clone().sub(this.controls.target).normalize();
    const right=new THREE.Vector3().crossVectors(this.camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize(),tanY=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2)),tanX=tanY*this.camera.aspect;
    let distance=4;
    for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){const relative=new THREE.Vector3(x,y,z).sub(center);distance=Math.max(distance,relative.dot(direction)+Math.max(Math.abs(relative.dot(right))/tanX,Math.abs(relative.dot(up))/tanY)*1.15);}
    this.controls.maxDistance=Math.max(45,distance*2);this.controls.maxTargetRadius=Math.max(25,box.getSize(new THREE.Vector3()).length()*2);this.controls.cursor.copy(center);
    this.camera.far=Math.max(300,distance*4);this.camera.updateProjectionMatrix();this.controls.target.copy(center);this.camera.position.copy(center).addScaledVector(direction,distance);this.controls.update();this.persistCamera();this.invalidate();
  }
  private async loadAssets(floor:Floor,generation:number):Promise<void>{
    for(const object of floor.objects.filter(o=>o.assetId)) {
      const asset=this.resources.get(object.assetId!);if(!asset)continue;
      if(generation!==this.assetGeneration||this.disposed)return;const target=this.findObject(object.id);if(!target||target.userData['loadedAssetId']===object.assetId)continue;
      // The local GLB keeps a procedural fallback and is normalized into its bounds.
      const model=asset.clone(true);model.traverse(node=>{if(node instanceof THREE.Mesh){node.geometry=node.geometry.clone();const cloneMaterial=(m:THREE.Material)=>{const clone=m.clone();for(const [key,value] of Object.entries(clone))if(value instanceof THREE.Texture)(clone as unknown as Record<string,unknown>)[key]=value.clone();return clone;};node.material=Array.isArray(node.material)?node.material.map(cloneMaterial):cloneMaterial(node.material);}});
      const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
      model.position.sub(center);model.position.y+=size.y/2;const normalization=new THREE.Group();normalization.add(model);normalization.scale.set(1/Math.max(size.x,.001),1/Math.max(size.y,.001),1/Math.max(size.z,.001));
      for(const child of [...target.children]){if(child instanceof THREE.PointLight)continue;child.visible=false;}target.add(normalization);target.userData['loadedAssetId']=object.assetId;this.invalidate();
    }
  }
  /** Only embedded GLB is accepted; external network resources are blocked by the caller. */
  async registerGlb(id:string,data:ArrayBuffer):Promise<void>{
    const gltf=await new GLTFLoader().parseAsync(data,'');if(this.disposed){disposeObject(gltf.scene);return;}const old=this.resources.get(id);if(old)disposeObject(old);this.resources.set(id,gltf.scene);if(this.floor)void this.loadAssets(this.floor,this.assetGeneration);
  }
  private clearSelection():void{if(this.selection){this.selection.removeFromParent();this.selection.geometry.dispose();(this.selection.material as THREE.Material).dispose();this.selection=undefined;}}
  private resize():void{if(this.disposed)return;const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.invalidate();}
  private pointerStart=(e:PointerEvent):void=>{this.pointerDown={x:e.clientX,y:e.clientY};};
  private pointerEnd=(e:PointerEvent):void=>{if(Math.hypot(e.clientX-this.pointerDown.x,e.clientY-this.pointerDown.y)>5||e.button!==0)return;const rect=this.renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);const hits=ray.intersectObjects(this.home?.children??[],true).filter(h=>{let node:THREE.Object3D|null=h.object;while(node){if(!node.visible)return false;node=node.parent;}return true;});const id=hits.map(h=>objectIdFromHit(h.object)).find(Boolean);this.select(id??'');};
  private doubleClick=():void=>{if(this.selectedId)this.focusObject(this.selectedId);};
  private persistCamera=():void=>{this.cameraChanged({...this.camera.position},{...this.controls.target});};
  private visibility=():void=>{if(document.hidden){cancelAnimationFrame(this.frame);this.frame=0;}else this.invalidate();};
  private contextLoss=(e:Event):void=>{e.preventDefault();this.contextLost=true;cancelAnimationFrame(this.frame);this.frame=0;this.onError('Contesto grafico sospeso. In attesa del ripristino WebGL.');};
  private contextRestore=():void=>{this.contextLost=false;this.onError('');this.invalidate();};
  private invalidate=():void=>{if(this.frame||this.disposed||this.contextLost||document.hidden)return;this.frame=requestAnimationFrame(()=>{this.frame=0;this.selection?.update();this.renderer.render(this.scene,this.camera);if(this.presentation==='map')this.overlay.project(this.camera,this.host.clientWidth,this.host.clientHeight);});};
  dispose():void{this.disposed=true;cancelAnimationFrame(this.frame);this.observer.disconnect();document.removeEventListener('visibilitychange',this.visibility);this.controls.removeEventListener('change',this.invalidate);this.controls.removeEventListener('end',this.persistCamera);this.controls.dispose();const c=this.renderer.domElement;c.removeEventListener('pointerdown',this.pointerStart);c.removeEventListener('pointerup',this.pointerEnd);c.removeEventListener('dblclick',this.doubleClick);c.removeEventListener('webglcontextlost',this.contextLoss);c.removeEventListener('webglcontextrestored',this.contextRestore);this.clearSelection();this.overlay.dispose();disposeObject(this.scene);this.resources.forEach(disposeObject);this.resources.clear();this.renderer.dispose();c.remove();}
}
