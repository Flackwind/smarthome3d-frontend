import { I18nService } from '../../core/i18n/i18n.service';
import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AfterViewInit, Component, computed, effect, ElementRef, HostListener, inject, OnDestroy, signal, untracked, ViewChild } from '@angular/core';
import { ProjectStore } from '../../core/configuration/project.store';
import { DeviceStore } from '../../core/providers/device.store';
import { DeviceControlsComponent } from '../../shared/components/device-controls.component';
import { robotPlacements } from '../../core/providers/robot-placements';
import { VacuumDetailComponent } from '../vacuum-detail/vacuum-detail.component';
import { SceneController } from './scene.controller';
@Component({selector:'sh3d-scene',standalone:true,imports:[TranslatePipe,DeviceControlsComponent,VacuumDetailComponent],host:{'[class.map-view]':'map()','[class.expanded]':'expanded()'},template:`
<div class="scene-host" #host></div>
@if(error()){<div class="scene-error" role="status">{{(error()|t)}}</div>}
<div class="virtual-home-heading">
  @if(expanded()){<div class="home-name">⌂ <span>{{store.project().name}}<small>{{store.floor().name}}</small></span></div>}
  <button class="virtual-home-toggle" (click)="expand()">{{expanded()?('Esci da Casa virtuale'|t):('Casa virtuale ↗'|t)}}</button>
</div>
@if(expanded()){<div class="virtual-status"><span>☀ {{devices.lightsOn()}} {{'luci accese'|t}}</span><span>{{devices.devices().length}} {{'entità ·'|t}} {{devices.status()==='connected'?('connesse'|t):'offline'}}</span></div>}
<div class="presentation-switch" role="group" [attr.aria-label]="'Stile della casa'|t"><button [class.active]="map()" [attr.aria-pressed]="map()" (click)="presentation('map')">{{'Mappa'|t}}</button><button [class.active]="!map()" [attr.aria-pressed]="!map()" (click)="presentation('model')">{{'Modello'|t}}</button></div>
<div class="scene-tools"><button [title]="'Vista isometrica'|t" [attr.aria-label]="'Vista isometrica'|t" (click)="scene?.view('iso')">3D</button><button [title]="'Vista dall’alto'|t" [attr.aria-label]="'Vista dall’alto'|t" (click)="scene?.view('top')">2D</button><button [title]="'Inquadra casa'|t" [attr.aria-label]="'Inquadra casa'|t" (click)="scene?.view('fit')">⌖</button><button [title]="'Mostra o nascondi muri'|t" [attr.aria-label]="'Mostra o nascondi muri'|t" [class.on]="store.project().scene.showWalls" [attr.aria-pressed]="store.project().scene.showWalls" (click)="walls()">▥</button></div>
@if(expanded()&&store.selectedObject();as object){<section class="virtual-device-panel"><div><strong>{{object.name}}</strong><button [attr.aria-label]="'Chiudi dispositivo'|t" (click)="store.selectedId.set('')">×</button></div>@if(selectedDevice();as device){@if(device.domain==='vacuum'){<sh3d-vacuum-detail [robot]="device" [objectId]="object.id"/>}@else{<sh3d-device-controls [device]="device"/>}}@else{<p>{{'Associa questo oggetto a un’entità dall’editor.'|t}}</p>}</section>}
<div class="scene-hint"><span class="status-dot"></span>{{map()?('CASA VIRTUALE'|t):('VISTA LIVE'|t)}} <span>{{'Trascina per ruotare · Due dita per zoom e pan'|t}}</span></div>
`,styleUrl:'./home-3d.component.scss'})
export class Home3dComponent implements AfterViewInit,OnDestroy {
  @ViewChild('host',{static:true})host!:ElementRef<HTMLElement>;
  readonly i18n=inject(I18nService);readonly store=inject(ProjectStore);readonly devices=inject(DeviceStore);readonly error=signal('');readonly expanded=signal(false);
  readonly map=computed(()=>(this.store.project().scene.presentation??'map')==='map');
  readonly selectedDevice=computed(()=>{const binding=this.store.project().bindings.find(b=>b.objectId===this.store.selectedId()&&b.provider===this.devices.providerId());return this.devices.devices().find(d=>d.entityId===binding?.entityId);});
  scene?:SceneController;private loadedProject='';private loadedFloor='';private assets=new Set<string>();private previousOverflow='';private expandFrame=0;
  constructor(){
    effect(()=>{const p=this.store.project(),f=this.store.floor(),d=this.devices.devices(),provider=this.devices.providerId();this.devices.positions();this.i18n.language();if(this.scene){this.scene.update(p,f,d,provider,robotPlacements(p,f,provider,d,this.devices.positions()));if(this.loadedProject!==p.id||this.loadedFloor!==f.id){this.scene.restoreCamera(p.scene.camera.position,p.scene.camera.target);this.loadedProject=p.id;this.loadedFloor=f.id;}void this.loadAssets();}});
    effect(()=>{const id=this.store.selectedId();this.scene?.highlight(id);});
    effect(()=>{const id=this.store.activeRoomId();untracked(()=>{const room=this.store.floor().rooms.find(r=>r.id===id);if(room)this.scene?.focusRoom(room);else this.scene?.view('fit');});});
  }
  ngAfterViewInit():void{
    try{this.scene=new SceneController(this.host.nativeElement,id=>this.store.selectedId.set(id),(position,target)=>this.store.updateCamera(position,target),message=>this.error.set(message),text=>this.i18n.t(text));this.scene.update(this.store.project(),this.store.floor(),this.devices.devices(),this.devices.providerId(),robotPlacements(this.store.project(),this.store.floor(),this.devices.providerId(),this.devices.devices(),this.devices.positions()));this.scene.restoreCamera(this.store.project().scene.camera.position,this.store.project().scene.camera.target);this.loadedProject=this.store.project().id;this.loadedFloor=this.store.floor().id;this.scene.highlight(this.store.selectedId());void this.loadAssets();}
    catch{this.scene?.dispose();this.scene=undefined;this.error.set('WebGL non disponibile. Prova un browser con accelerazione grafica. Editor 2D e dispositivi restano utilizzabili.');}
  }
  private async loadAssets():Promise<void>{for(const o of this.store.floor().objects){if(!o.assetId||this.assets.has(o.assetId))continue;this.assets.add(o.assetId);try{const asset=await this.store.repository.getAsset(o.assetId);if(asset){await this.scene?.registerGlb(o.assetId,await asset.blob.arrayBuffer());}}catch{this.assets.delete(o.assetId);this.store.notify('Impossibile caricare il modello GLB: verifica il collegamento all’archivio.');}}}
  presentation(value:'map'|'model'):void{this.store.change(p=>p.scene.presentation=value);}
  expand():void{if(this.expanded()){document.body.style.overflow=this.previousOverflow;this.expanded.set(false);}else{this.previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';this.expanded.set(true);}cancelAnimationFrame(this.expandFrame);this.expandFrame=requestAnimationFrame(()=>this.scene?.view('fit'));}
  @HostListener('document:keydown.escape')escape():void{if(this.expanded())this.expand();}
  walls():void{this.store.change(p=>p.scene.showWalls=!p.scene.showWalls);}
  ngOnDestroy():void{cancelAnimationFrame(this.expandFrame);if(this.expanded())document.body.style.overflow=this.previousOverflow;this.scene?.dispose();this.scene=undefined;}
}
