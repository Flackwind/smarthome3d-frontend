import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { assertProject, cloneProject, createDemoProject, createFloor, createProject, Floor, HomeProject, parseProject, serializeProject } from '@sh3d/home-model';
import { StorageService } from '../persistence/storage.service';

@Injectable({providedIn:'root'})
export class ProjectStore {
  readonly repository=inject(StorageService);
  /** Renderable placeholder until a house is opened or explicitly created. Never persisted. */
  readonly project=signal<HomeProject>(createProject());readonly hasProject=signal(false);
  readonly projects=signal<HomeProject[]>([]);
  readonly ready=signal(false);readonly setupOpen=signal(false);readonly message=signal('');readonly saving=signal(false);readonly saved=signal(false);
  readonly activeFloorId=signal('');readonly activeRoomId=signal('');readonly selectedId=signal('');
  readonly floor=computed(()=>this.project().building.floors.find(f=>f.id===this.activeFloorId())??this.project().building.floors[0]);
  readonly selectedObject=computed(()=>this.floor().objects.find(o=>o.id===this.selectedId()));
  readonly selectedWall=computed(()=>this.floor().walls.find(w=>w.id===this.selectedId()));
  readonly room=computed(()=>this.floor().rooms.find(r=>r.id===this.activeRoomId()));
  readonly canUndo=signal(false);readonly canRedo=signal(false);
  private past:HomeProject[]=[];private future:HomeProject[]=[];
  private noticeTimer?:ReturnType<typeof setTimeout>;
  private saveQueue:Promise<void>=Promise.resolve();
  private deleted=new Set<string>();
  private creating=false;
  constructor(){
    void this.initialize();
    effect(cleanup=>{const project=this.project();if(!this.ready()||!this.hasProject()||this.repository.serverPending())return;this.saved.set(false);const timeout=setTimeout(()=>void this.save(project),500);cleanup(()=>clearTimeout(timeout));});
    effect(()=>{if(typeof document!=='undefined')document.documentElement.dataset['theme']=this.project().scene.theme;});
  }
  private async initialize():Promise<void>{
    try{
      await this.repository.initialize();
      if(!this.repository.serverPending()){
        const projects=await this.repository.list();this.projects.set(projects);
        const active=await this.repository.getPreference<string>('activeProject');
        if(projects.length)this.replace(projects.find(p=>p.id===active)??projects[0]);else this.setupOpen.set(this.repository.mode()==='local');
      }
    }catch{this.notify('Archivio non disponibile: esporta il progetto JSON prima di chiudere.');}
    if(this.repository.notice())this.notify(this.repository.notice());
    this.ready.set(true);
  }
  change(mutator:(p:HomeProject,f:Floor)=>void):boolean {
    if(!this.ready()||!this.hasProject()||this.repository.serverPending())return false;
    try{
      const previous=this.project(),next=cloneProject(previous),f=next.building.floors.find(f=>f.id===this.floor().id)!;
      mutator(next,f);next.updatedAt=new Date().toISOString();assertProject(next);
      this.past.push(previous);if(this.past.length>30)this.past.shift();this.future=[];this.project.set(next);this.historyState();return true;
    }catch(e){this.notify(e instanceof Error?e.message:'Modifica non valida');return false;}
  }
  undo():void{if(!this.ready())return;const p=this.past.pop();if(p){this.future.push(this.project());this.project.set(p);this.historyState();}}
  redo():void{if(!this.ready())return;const p=this.future.pop();if(p){this.past.push(this.project());this.project.set(p);this.historyState();}}
  updateCamera(position:HomeProject['scene']['camera']['position'],target:HomeProject['scene']['camera']['target']):void{if(!this.ready()||!this.hasProject()||this.repository.serverPending())return;this.project.update(p=>({...p,updatedAt:new Date().toISOString(),scene:{...p.scene,camera:{position,target}}}));}
  private historyState():void{this.canUndo.set(!!this.past.length);this.canRedo.set(!!this.future.length);}
  async save(project=this.project()):Promise<boolean>{
    if(!this.ready())return false;if(!this.hasProject())return true;if(this.repository.serverPending())return false;const repository=this.repository.capture(),copy=cloneProject(project);this.saving.set(true);
    this.saveQueue=this.saveQueue.catch(()=>{}).then(async()=>{if(this.deleted.has(copy.id))return;await repository.save(copy);await repository.setPreference('activeProject',copy.id);if(this.repository.capture()===repository)this.projects.set(await repository.list());if(this.project()===project)this.saved.set(true);});
    try{await this.saveQueue;return true;}catch(error){this.notify(error instanceof Error?error.message:'Salvataggio non riuscito. Esporta il progetto prima di chiudere.');return false;}finally{this.saving.set(false);}
  }
  async open(id:string):Promise<void>{if(!await this.save())return;try{const p=await this.repository.get(id);if(p)this.replace(p);}catch(error){this.notify(error instanceof Error?error.message:'Progetto non disponibile');}}
  async newProject(name:string,demo=false):Promise<boolean>{
    if(this.creating)return false;this.creating=true;
    try{if(this.repository.serverPending()){this.notify('Accedi al server o apri esplicitamente l’archivio locale prima di creare una casa.');return false;}if(!await this.save())return false;this.replace(demo?createDemoProject():createProject(name.trim()||'La mia casa'));return await this.save();}
    finally{this.creating=false;}
  }
  private replace(p?:HomeProject):void{if(p)this.deleted.delete(p.id);this.hasProject.set(!!p);this.project.set(p??createProject());this.saved.set(false);this.activeFloorId.set('');this.activeRoomId.set('');this.selectedId.set('');this.past=[];this.future=[];this.historyState();}
  async deleteProject(id:string):Promise<void>{this.deleted.add(id);try{await this.saveQueue.catch(()=>{});await this.repository.delete(id);const projects=await this.repository.list();this.projects.set(projects);if(id===this.project().id)this.replace(projects[0]);}catch(error){this.deleted.delete(id);this.notify(error instanceof Error?error.message:'Eliminazione non riuscita');}}

  async selectStorage(mode:'local'|'server'):Promise<void>{
    if(!await this.save())throw new Error('Esporta le modifiche o ripristina il progetto prima di cambiare archivio');
    this.ready.set(false);await this.saveQueue.catch(()=>{});
    try{const target=mode==='server'?this.repository.server():this.repository.local,projects=await target.list(),active=await target.getPreference<string>('activeProject');if(mode==='server')await this.repository.useServer();else await this.repository.useLocal();this.projects.set(projects);this.replace(projects.find(p=>p.id===active)??projects[0]);this.setupOpen.set(false);}finally{this.ready.set(true);}
  }
  async reloadServer():Promise<void>{this.ready.set(false);try{await this.saveQueue.catch(()=>{});const project=await this.repository.get(this.project().id);if(project){this.replace(project);this.notify('Progetto aggiornato dal server');}}finally{this.ready.set(true);}}
  async showImported(project:HomeProject):Promise<void>{this.ready.set(false);await this.saveQueue.catch(()=>{});try{this.replace(project);this.projects.set(await this.repository.list());this.setupOpen.set(false);}finally{this.ready.set(true);}}
  addFloor():void{const floor=createFloor(`Piano ${this.project().building.floors.length+1}`);floor.elevation=this.project().building.floors.length*3;this.change(p=>p.building.floors.push(floor));this.activeFloorId.set(floor.id);this.activeRoomId.set('');this.selectedId.set('');}
  export():void{const blob=new Blob([serializeProject(this.project())],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${this.project().name.replace(/[^a-z0-9]/gi,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async import(file:File):Promise<void>{try{if(file.size>35_000_000)throw new Error('JSON troppo grande (35 MB massimo)');const project=parseProject(await file.text());if(!await this.save())return;this.replace(project);if(await this.save())this.notify('Progetto importato');}catch(e){this.notify(e instanceof Error?e.message:'JSON non valido');}}
  notify(text:string):void{this.message.set(text);clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>this.message.set(''),7000);}
}
