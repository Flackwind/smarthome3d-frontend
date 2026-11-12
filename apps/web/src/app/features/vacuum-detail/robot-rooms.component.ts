import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Component, computed, DestroyRef, effect, inject, input, signal } from '@angular/core';
import { canCommand, CleaningArea, SmartDevice } from '@sh3d/device-model';
import { DeviceStore } from '../../core/providers/device.store';

@Component({selector:'sh3d-robot-rooms',standalone:true,imports:[TranslatePipe],template:`
<details class="room-cleaning"><summary>{{'Pulizia per stanza'|t}}</summary>
@if(supported()){
  <p class="small muted">{{'Seleziona le aree associate alla mappa del robot in Home Assistant. Usa la mappa attiva corretta prima di avviare.'|t}}</p>
  <button class="button quiet" (click)="load()" [disabled]="loading()||!available()">{{loading()?('Lettura…'|t):('Aggiorna stanze'|t)}}</button>
  @if(loaded()&&!areas().length){<p class="small">{{'Nessuna stanza associata. In Home Assistant apri le impostazioni dell’entità robot e associa i segmenti della mappa alle aree, poi aggiorna.'|t}}</p>}
  <div class="room-options">@for(area of areas();track area.id){<label><input type="checkbox" [checked]="selected().includes(area.id)" [disabled]="!available()||loading()||devices.busy().includes(robot().entityId)" (change)="select(area.id,$any($event.target).checked)"><span>{{area.name}}@if(area.floorName){<small> · {{area.floorName}}</small>}</span></label>}</div>
  @if(areas().length){<button class="button primary" (click)="clean()" [disabled]="!selected().length||!available()||loading()||devices.busy().includes(robot().entityId)">{{'Pulisci stanze selezionate ('|t}}{{selected().length}})</button>}
  @if(error()){<p class="small" role="alert">{{(error()|t)}}</p>}
} @else {<p class="small muted">{{'Questo robot o la versione di Home Assistant non espone la pulizia per area. I comandi generali restano nel dettaglio robot.'|t}}</p>}
</details>`,styles:[`.room-cleaning{border:1px solid var(--border);border-radius:11px;padding:14px 16px;margin-top:10px}summary{font-size:12px;cursor:pointer}.room-options{display:flex;flex-wrap:wrap;gap:12px;margin:16px 0}.room-options label{display:flex;align-items:center;gap:8px;min-height:44px;font-size:12px}.room-options input{width:18px;height:18px}small{color:var(--muted)}`]})
export class RobotRoomsComponent {
  readonly robot=input.required<SmartDevice>();readonly devices=inject(DeviceStore);
  readonly robotId=computed(()=>this.robot().entityId);
  readonly supported=computed(()=>this.robot().capabilities.includes('clean-areas'));
  readonly available=computed(()=>this.devices.status()==='connected'&&canCommand(this.robot()));
  readonly areas=signal<CleaningArea[]>([]);readonly selected=signal<string[]>([]);readonly loading=signal(false);readonly loaded=signal(false);readonly error=signal('');private request=0;
  constructor(){inject(DestroyRef).onDestroy(()=>this.request++);effect(()=>{this.robotId();this.devices.providerId();this.devices.status();this.request++;this.areas.set([]);this.selected.set([]);this.loaded.set(false);this.loading.set(false);this.error.set('');});}
  select(id:string,checked:boolean):void{this.selected.update(ids=>checked?[...new Set([...ids,id])]:ids.filter(value=>value!==id));}
  async load():Promise<void>{const request=++this.request;this.loading.set(true);this.error.set('');this.selected.set([]);try{const areas=await this.devices.getCleaningAreas(this.robot().entityId);if(request===this.request){this.areas.set(areas);this.loaded.set(true);}}catch(error){if(request===this.request){this.areas.set([]);this.loaded.set(false);this.error.set(error instanceof Error?error.message:'Stanze non disponibili');}}finally{if(request===this.request)this.loading.set(false);}}
  async clean():Promise<void>{if(!this.available()||!this.selected().length||this.loading())return;await this.devices.command(this.robot().entityId,{type:'clean-areas',areaIds:[...this.selected()]});}
}
