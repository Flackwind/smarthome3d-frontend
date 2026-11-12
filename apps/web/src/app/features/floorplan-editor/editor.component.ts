import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Component, computed, HostListener, inject, signal, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { createFurniture, discoverRooms, distance, Floor, FURNITURE_CATALOG, FurnitureType, removeWall, uid } from '@sh3d/home-model';
import { ProjectStore } from '../../core/configuration/project.store';
import { ObjectPanelComponent } from '../device-mapping/object-panel.component';
import { FloorplanImportService } from '../floorplan-import/floorplan-import.service';
import { EditorCanvasComponent, EditorTool } from './editor-canvas.component';
import { FloorplanGenerationComponent } from '../floorplan-import/floorplan-generation.component';
@Component({standalone:true,imports:[TranslatePipe,RouterLink,FormsModule,EditorCanvasComponent,ObjectPanelComponent,FloorplanGenerationComponent],templateUrl:'./editor.component.html',styleUrl:'./editor.component.scss'})
export class EditorComponent {
  @ViewChild(EditorCanvasComponent)canvas!:EditorCanvasComponent;
  readonly store=inject(ProjectStore);readonly importer=inject(FloorplanImportService);readonly tool=signal<EditorTool>('select');readonly importing=signal(false);readonly measured=signal(0);grid=true;snap=true;knownLength=1;readonly catalog=FURNITURE_CATALOG;
  readonly tools:{id:EditorTool;label:string;icon:string}[]=[{id:'select',label:'Seleziona',icon:'↖'},{id:'wall',label:'Muro',icon:'╱'},{id:'door',label:'Porta',icon:'⌑'},{id:'window',label:'Finestra',icon:'⊞'},{id:'pan',label:'Pan',icon:'✥'}];
  readonly generation=signal<{projectId:string;floorId:string}|undefined>(undefined);
  readonly openingProps=[{key:'width',label:'Larghezza'},{key:'height',label:'Altezza'},{key:'offset',label:'Distanza da inizio muro'},{key:'sill',label:'Quota davanzale'}] as const;
  readonly selectedOpening=computed(()=>{for(const wall of this.store.floor().walls){const opening=wall.openings.find(o=>o.id===this.store.selectedId());if(opening)return {wall,opening};}return undefined;});
  readonly wallLength=computed(()=>{const w=this.store.selectedWall(),f=this.store.floor();return w?Number(distance(f.vertices.find(v=>v.id===w.startId)!,f.vertices.find(v=>v.id===w.endId)!).toFixed(3)):0;});
  setTool(tool:EditorTool):void{this.canvas?.cancel();this.tool.set(tool);}
  undo():void{this.canvas.cancel();this.store.undo();}redo():void{this.canvas.cancel();this.store.redo();}
  floor(id:string):void{this.store.activeFloorId.set(id);this.store.activeRoomId.set('');this.store.selectedId.set('');this.canvas.cancel();this.canvas.fit();}
  renameFloor(name:string):void{this.store.change((_p,f)=>f.name=name.trim());}
  ceiling(height:number):void{this.store.change((_p,f)=>{f.ceilingHeight=height;f.walls.forEach(w=>w.height=height);});}
  elevation(height:number):void{this.store.change((_p,f)=>f.elevation=height);}
  wallProperty(key:'height'|'thickness',value:number):void{this.store.change((_p,f)=>{f.walls.find(w=>w.id===this.store.selectedId())![key]=value;});}
  setLength(value:number):void{this.store.change((_p,f)=>{const w=f.walls.find(w=>w.id===this.store.selectedId())!,a=f.vertices.find(v=>v.id===w.startId)!,b=f.vertices.find(v=>v.id===w.endId)!,len=distance(a,b);b.x=a.x+(b.x-a.x)*value/len;b.y=a.y+(b.y-a.y)*value/len;discoverRooms(f);});}
  openingProperty(key:'width'|'height'|'offset'|'sill',value:number):void{this.store.change((_p,f)=>{for(const w of f.walls){const o=w.openings.find(o=>o.id===this.store.selectedId());if(o)o[key]=value;}});}
  addObject(type:FurnitureType):void{const r=this.store.room()??this.store.floor().rooms[0],points=r?.vertexIds.map(id=>this.store.floor().vertices.find(v=>v.id===id)!)??[],x=points.length?points.reduce((s,p)=>s+p.x,0)/points.length:2,z=points.length?points.reduce((s,p)=>s+p.y,0)/points.length:2,o=createFurniture(type,x,z,r?.id);this.store.change((_p,f)=>f.objects.push(o));this.store.selectedId.set(o.id);this.setTool('select');}
  renameRoom(id:string,name:string):void{this.store.change((_p,f)=>f.rooms.find(r=>r.id===id)!.name=name.trim());}
  roomColor(id:string,color:string):void{this.store.change((_p,f)=>f.rooms.find(r=>r.id===id)!.material.color=color);}
  deleteSelection():void{const id=this.store.selectedId();this.store.change((p,f)=>{if(f.walls.some(w=>w.id===id))removeWall(f,id);else if(f.objects.some(o=>o.id===id)){f.objects=f.objects.filter(o=>o.id!==id);p.bindings=p.bindings.filter(b=>b.objectId!==id);}else for(const w of f.walls)w.openings=w.openings.filter(o=>o.id!==id);});this.store.selectedId.set('');}
  async importPlan(e:Event):Promise<void>{const input=e.target as HTMLInputElement,file=input.files?.[0];if(!file)return;this.importing.set(true);const projectId=this.store.project().id,floorId=this.store.floor().id;try{const plan=await this.importer.read(file);if(this.store.project().id!==projectId||this.store.floor().id!==floorId)throw new Error('Il piano attivo è cambiato: ripeti l’importazione');const id=uid();await this.store.repository.saveAsset({id,projectId,name:file.name,blob:file});this.store.change((_p,f)=>f.floorplan={id:uid(),name:file.name,dataUrl:plan.dataUrl,originalAssetId:id,width:plan.width,height:plan.height,metersPerPixel:10/plan.width,rotation:0,origin:{x:0,y:0},opacity:.45});this.canvas.fit();this.store.notify('Planimetria importata. Calibra la scala prima di tracciare.');}catch(error){this.store.notify(error instanceof Error?error.message:'Importazione non riuscita');}finally{this.importing.set(false);input.value='';}}
  planProperty(key:'rotation'|'metersPerPixel'|'opacity',value:number):void{this.store.change((_p,f)=>{f.floorplan![key]=value;if(key==='metersPerPixel')f.floorplan!.calibrated=true;});}
  planOrigin(key:'x'|'y',value:number):void{this.store.change((_p,f)=>f.floorplan!.origin[key]=value);}
  calibrate():void{if(this.knownLength<=0||!this.measured())return;this.store.change((_p,f)=>{f.floorplan!.metersPerPixel=Number((f.floorplan!.metersPerPixel*this.knownLength/this.measured()).toPrecision(7));f.floorplan!.calibrated=true;});this.measured.set(0);this.setTool('select');this.canvas.fit();}
  openGeneration():void{this.generation.set({projectId:this.store.project().id,floorId:this.store.floor().id});}
  applyGeneration(floor:Floor):void{
    const target=this.generation();if(!target||target.projectId!==this.store.project().id||target.floorId!==this.store.floor().id){this.store.notify('Il progetto attivo è cambiato: ripeti la generazione');this.generation.set(undefined);return;}
    if(this.store.project().building.floors.length>=20){this.store.notify('Limite di 20 piani raggiunto');return;}
    if(this.store.change(p=>{p.building.floors.push(floor);p.scene.presentation='map';const xs=floor.vertices.map(v=>v.x),ys=floor.vertices.map(v=>v.y),x=(Math.min(...xs)+Math.max(...xs))/2,z=(Math.min(...ys)+Math.max(...ys))/2,span=Math.max(Math.max(...xs)-Math.min(...xs),Math.max(...ys)-Math.min(...ys),4);p.scene.camera={position:{x,y:floor.elevation+span*1.5,z:z+span*1.2},target:{x,y:floor.elevation,z}};})){this.generation.set(undefined);this.store.activeFloorId.set(floor.id);this.store.activeRoomId.set('');this.store.selectedId.set('');this.setTool('select');this.canvas.fit();this.store.notify(`Modello generato: ${floor.walls.length} muri e ${floor.rooms.length} stanze. Verifica aperture e dettagli.`);}
  }
  removePlan():void{this.store.change((_p,f)=>delete f.floorplan);}
  async downloadSource():Promise<void>{const id=this.store.floor().floorplan?.originalAssetId;if(!id)return;const source=await this.store.repository.getAsset(id);if(!source){this.store.notify('Originale non presente in questo browser. Il JSON conserva l’anteprima.');return;}const url=URL.createObjectURL(source.blob),a=document.createElement('a');a.href=url;a.download=source.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  @HostListener('document:keydown',['$event'])key(e:KeyboardEvent):void{if((e.target as HTMLElement).matches('input,select,textarea'))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?this.redo():this.undo();}if(e.key==='Delete'&&this.store.selectedId()){e.preventDefault();this.deleteSelection();}}
}
