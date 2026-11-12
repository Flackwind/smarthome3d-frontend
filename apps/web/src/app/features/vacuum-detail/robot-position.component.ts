import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SmartDevice } from '@sh3d/device-model';
import { Point2, pointInPolygon, RobotMapCalibration, validRobotCalibration } from '@sh3d/home-model';
import { ProjectStore } from '../../core/configuration/project.store';
import { DeviceStore } from '../../core/providers/device.store';
import { robotPlacements } from '../../core/providers/robot-placements';

@Component({selector:'sh3d-robot-position',standalone:true,imports:[TranslatePipe,FormsModule],template:`
<section class="robot-position"><div class="position-heading"><h3>{{'Posizione nella casa'|t}}</h3>@if(devices.tracking().includes(robot().entityId)){<span class="pill">{{'Aggiornamento periodico'|t}}</span>}</div>
@if(robot().capabilities.includes('read-position')){
  <p class="small">{{'Leggi la posizione rilevata dal robot. Per visualizzarla nella casa, allinea due punti noti delle due mappe.'|t}}</p>
  <button class="button quiet" [disabled]="devices.status()!=='connected'||robot().state==='unavailable'||devices.positionBusy().includes(robot().entityId)" (click)="devices.readPosition(robot().entityId)">{{devices.positionBusy().includes(robot().entityId)?('Lettura in corso…'|t):('Leggi posizione'|t)}}</button>
  @if(position();as p){<div class="position-value"><strong>X {{p.x}} · Y {{p.y}}</strong><span>{{'Ultima lettura:'|t}} {{time(p.updatedAt)}} {{'· coordinate native'|t}}</span></div>}
  <label class="check tracking"><input [attr.aria-label]="'Aggiorna posizione automaticamente'|t" type="checkbox" [ngModel]="devices.tracking().includes(robot().entityId)" (ngModelChange)="devices.trackPosition(robot().entityId,$event)">{{'Aggiorna ogni 60 secondi durante il movimento'|t}}</label>
  <p class="small muted">{{'Le letture si sospendono quando la scheda è nascosta. Non rappresentano un tracciamento continuo come nell’app nativa.'|t}}</p>
  @if(devices.positionErrors()[robot().entityId]){<p class="position-error" role="alert">{{devices.positionErrors()[robot().entityId]}}</p>}
}@else{<p class="small">{{'L’integrazione non espone una lettura della posizione per questa entità, oppure Home Assistant non ha ancora fornito i metadati necessari.'|t}}</p>}
@if(binding();as binding){
  @if(binding.positionCalibration){<p class="small alignment-state">{{placed()?('Ultima posizione riportata sulla casa.'|t):('Allineamento salvato. In attesa di una lettura valida sulla mappa associata.'|t)}}</p>}
  <details class="alignment"><summary>{{'Allinea posizione e planimetria'|t}}</summary><p class="small">{{'Indica due punti distinti dove si trova il robot, nelle coordinate native e nelle coordinate X/Y in metri dell’editor. Usa punti distanti e verifica il risultato su un terzo punto. L’allineamento vale per questa mappa e questo piano.'|t}}</p>
  @for(key of pointKeys;track key){<div class="anchor-point"><strong>{{'Punto'|t}} {{key==='A'?'A':'B'}}</strong><button class="text-action" [disabled]="!position()" (click)="capture(key)">{{'Usa ultima lettura per'|t}} {{key}}</button><div class="field-row">@for(axis of axes;track axis){<label class="field">Robot {{axis.toUpperCase()}}<input type="number" step="any" [attr.aria-label]="'Robot '+key+' '+axis.toUpperCase()" [ngModel]="source(key)[axis]" (ngModelChange)="editPoint('source',key,axis,+$event)"></label>}</div><div class="field-row">@for(axis of axes;track axis){<label class="field">{{'Casa'|t}} {{axis.toUpperCase()}} (m)<input type="number" step="0.1" [attr.aria-label]="('Casa '|t)+key+' '+axis.toUpperCase()" [ngModel]="home(key)[axis]" (ngModelChange)="editPoint('home',key,axis,+$event)"></label>}</div></div>}
  <label class="check"><input [attr.aria-label]="'Inverti asse Y del robot'|t" type="checkbox" [ngModel]="draft.flipY" (ngModelChange)="draft.flipY=$event;verified.set(false)">{{'Inverti l’asse Y nativo'|t}}</label>
  <label class="field guard-field">{{'Selettore mappa Home Assistant (facoltativo)'|t}}<select [attr.aria-label]="'Selettore mappa per allineamento'|t" [ngModel]="guard" (ngModelChange)="guard=$event;verified.set(false)"><option value="">{{'Nessuno · verifica manualmente la mappa attiva'|t}}</option>@for(entity of mapSelectors();track entity.entityId){<option [value]="entity.entityId">{{entity.name}}</option>}</select></label>
  <p class="small">{{'Se scegli il selettore della mappa, la posizione viene nascosta quando Home Assistant passa a un’altra mappa.'|t}}</p>
  <label class="check"><input [attr.aria-label]="'Conferma punti allineamento'|t" type="checkbox" [ngModel]="verified()" (ngModelChange)="verified.set($event)">{{'Ho verificato i due punti sulla stessa mappa'|t}}</label>
  <div class="actions alignment-actions"><button class="button" [disabled]="!verified()" (click)="save()">{{'Salva allineamento'|t}}</button>@if(binding.positionCalibration){<button class="button quiet" (click)="remove()">{{'Rimuovi allineamento'|t}}</button>}</div>
  @if(error()){<p class="position-error" role="alert">{{(error()|t)}}</p>}
  </details>
}@else{<p class="small">{{'Associa il robot a un oggetto aspirapolvere nell’editor per poter allineare la posizione alla casa.'|t}}</p>}
</section>`,styles:[`:host{display:block}.robot-position{border-top:1px solid var(--border);padding-top:18px;margin-top:20px}.position-heading{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:10px}.position-heading h3{margin:0}.position-value{display:grid;gap:6px;margin:14px 0}.position-value strong{font-size:13px;font-weight:500}.position-value span{font-size:10px;color:var(--muted)}.tracking{margin:17px 0 10px;align-items:start;line-height:1.5}.position-error{color:var(--danger);font-size:11px;overflow-wrap:anywhere}.alignment{margin-top:17px}.alignment summary{font-size:12px;cursor:pointer;color:var(--accent);margin-bottom:13px}.anchor-point{border:1px solid var(--border);border-radius:10px;padding:13px;margin-bottom:12px}.anchor-point>strong{font-size:12px}.anchor-point .field-row{margin-top:13px;gap:8px}.anchor-point .field{font-size:10px;margin-bottom:0}.anchor-point input{padding:8px;font-size:11px}.text-action{border:0;background:none;color:var(--accent);font-size:10px;padding:0;float:right}.alignment .check{font-size:11px;line-height:1.5;align-items:start}.alignment-actions,.guard-field{margin-top:15px}.alignment-state{color:var(--accent)}`]})
export class RobotPositionComponent {
  readonly robot=input.required<SmartDevice>();readonly objectId=input<string|undefined>();readonly devices=inject(DeviceStore);readonly store=inject(ProjectStore);readonly error=signal('');readonly verified=signal(false);
  readonly pointKeys=['A','B'] as const;readonly axes=['x','y'] as const;
  draft:RobotMapCalibration={sourceA:{x:0,y:0},sourceB:{x:1000,y:0},homeA:{x:0,y:0},homeB:{x:1,y:0},flipY:false};guard='';
  readonly binding=computed(()=>this.store.project().bindings.find(b=>b.provider===this.devices.providerId()&&b.entityId===this.robot().entityId&&(!this.objectId()||b.objectId===this.objectId())));
  readonly floor=computed(()=>this.store.project().building.floors.find(f=>f.objects.some(o=>o.id===this.binding()?.objectId)));
  readonly position=computed(()=>this.devices.positions()[this.robot().entityId]);
  readonly placed=computed(()=>{const floor=this.floor();return !!floor&&!!robotPlacements(this.store.project(),floor,this.devices.providerId(),this.devices.devices(),this.devices.positions())[this.binding()!.objectId];});
  readonly mapSelectors=computed(()=>this.devices.devices().filter(d=>d.domain==='select'&&this.robot().deviceId&&d.deviceId===this.robot().deviceId));
  constructor(){effect(()=>{const binding=this.binding(),floor=this.floor(),object=floor?.objects.find(o=>o.id===binding?.objectId);this.error.set('');this.verified.set(!!binding?.positionCalibration);if(binding?.positionCalibration){this.draft=structuredClone(binding.positionCalibration);this.guard=this.draft.mapEntityId??'';}else{this.draft={sourceA:{x:0,y:0},sourceB:{x:1000,y:0},homeA:{x:object?.position.x??0,y:object?.position.z??0},homeB:{x:(object?.position.x??0)+1,y:object?.position.z??0},flipY:false};this.guard='';}});}
  source(key:'A'|'B'):Point2{return key==='A'?this.draft.sourceA:this.draft.sourceB;}home(key:'A'|'B'):Point2{return key==='A'?this.draft.homeA:this.draft.homeB;}
  editPoint(kind:'source'|'home',key:'A'|'B',axis:'x'|'y',value:number):void{(kind==='source'?this.source(key):this.home(key))[axis]=value;this.verified.set(false);}
  capture(key:'A'|'B'):void{const p=this.position();if(p){Object.assign(this.source(key),{x:p.x,y:p.y});this.verified.set(false);}}
  time(date:string):string{return new Intl.DateTimeFormat('it-IT',{timeStyle:'medium'}).format(new Date(date));}
  save():void{
    const binding=this.binding(),floor=this.floor();if(!binding||!floor||!this.verified())return;const calibration=structuredClone(this.draft);delete calibration.mapEntityId;delete calibration.mapState;
    if(this.guard){const entity=this.mapSelectors().find(d=>d.entityId===this.guard);if(!entity||['unknown','unavailable'].includes(entity.state)){this.error.set('Il selettore della mappa non è disponibile.');return;}calibration.mapEntityId=entity.entityId;calibration.mapState=entity.state;}
    if(!validRobotCalibration(calibration)){this.error.set('Servono due coppie di punti valide e distinte; nella casa devono distare almeno 5 cm.');return;}
    if(floor.rooms.length&&[calibration.homeA,calibration.homeB].some(point=>!floor.rooms.some(room=>pointInPolygon(point,room.vertexIds.map(id=>floor.vertices.find(v=>v.id===id)!))))){this.error.set('I punti della casa devono essere all’interno delle stanze di questo piano.');return;}
    if(this.store.change(p=>p.bindings.find(b=>b.id===binding.id)!.positionCalibration=calibration)){this.error.set('');this.store.notify('Allineamento del robot salvato');}
  }
  remove():void{const binding=this.binding();if(binding)this.store.change(p=>delete p.bindings.find(b=>b.id===binding.id)!.positionCalibration);}
}
