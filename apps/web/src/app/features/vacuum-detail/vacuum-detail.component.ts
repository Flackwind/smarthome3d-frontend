import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Component, computed, inject, input } from '@angular/core';
import { SmartDevice, vacuumBattery, vacuumGroups, vacuumSections } from '@sh3d/device-model';
import { DeviceStore } from '../../core/providers/device.store';
import { ProjectStore } from '../../core/configuration/project.store';
import { DeviceControlsComponent } from '../../shared/components/device-controls.component';
import { RobotRoomsComponent } from './robot-rooms.component';
import { RobotPositionComponent } from './robot-position.component';

@Component({selector:'sh3d-vacuum-detail',standalone:true,imports:[TranslatePipe,DeviceControlsComponent,RobotPositionComponent,RobotRoomsComponent],template:`
<div class="robot-overview"><div class="robot-primary"><sh3d-device-controls [device]="robot()" [showBattery]="false"/></div><div class="robot-facts">
  <div><span>{{'Batteria'|t}}</span><strong>{{battery()===undefined?'—':battery()+'%'}}</strong></div><div><span>{{'Entità collegate'|t}}</span><strong>{{group().members.length}}</strong></div>@if(robot().model){<div><span>{{'Modello'|t}}</span><strong class="model-value">{{robot().model}}</strong></div>}
</div></div>
<div class="robot-sections">@for(section of sections();track section.id){<details [open]="matches()!==undefined"><summary><span>{{section.title|t}}</span><span class="section-count">{{section.entities.length}}</span></summary><div class="robot-entities">@for(entity of section.entities;track entity.entityId){<div class="robot-entity"><div class="entity-heading"><strong>{{shortName(entity)}}</strong><code>{{entity.entityId}}</code></div><sh3d-device-controls [device]="entity" [compact]="true"/></div>}</div></details>}</div>
<sh3d-robot-rooms [robot]="robot()"/>
<sh3d-robot-position [robot]="robot()" [objectId]="objectId()"/>
`,styles:[`:host{display:block;min-width:0}.robot-overview{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,230px),1fr));gap:20px}.robot-primary{min-width:0}.robot-facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:10px;align-content:start}.robot-facts>div{border:1px solid var(--border);border-radius:11px;padding:14px;background:var(--panel-raised)}.robot-facts span{display:block;font-size:10px;color:var(--muted);margin-bottom:8px}.robot-facts strong{font-size:23px;font-weight:500}.robot-facts strong.model-value{font-size:12px;overflow-wrap:anywhere}.robot-sections{display:grid;gap:9px;margin-top:10px}.robot-sections details{border:1px solid var(--border);border-radius:11px;overflow:hidden}.robot-sections summary{display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;padding:14px 16px;font-size:12px;list-style:none}.robot-sections summary::before{content:'›';color:var(--muted);font-size:18px}.robot-sections details[open]>summary::before{content:'⌄'}.robot-sections summary>span:first-of-type{margin-right:auto}.section-count{font-size:10px;color:var(--muted);background:var(--panel-raised);padding:3px 7px;border-radius:20px}.robot-entities{padding:0 16px}.robot-entity{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:15px 0;border-top:1px solid var(--border);flex-wrap:wrap}.entity-heading{min-width:0;flex:1 1 150px}.entity-heading strong{font-size:11px;font-weight:500;display:block}.entity-heading code{display:block;font-size:8px;color:var(--muted);overflow-wrap:anywhere;margin-top:6px}.robot-entity sh3d-device-controls{flex:1 1 160px}.robot-entity:has(.power-control) .entity-heading{flex-basis:140px}`]})
export class VacuumDetailComponent {
  readonly robot=input.required<SmartDevice>();readonly objectId=input<string|undefined>();readonly matches=input<string[]|undefined>();readonly devices=inject(DeviceStore);readonly store=inject(ProjectStore);
  readonly group=computed(()=>vacuumGroups(this.devices.devices(),this.store.project().bindings.filter(b=>b.provider===this.devices.providerId())).find(g=>g.members.some(d=>d.entityId===this.robot().entityId))??{robot:this.robot(),members:[this.robot()]});
  readonly battery=computed(()=>vacuumBattery(this.group()));
  readonly sections=computed(()=>vacuumSections(this.group()).map(s=>({...s,entities:this.matches()?s.entities.filter(d=>this.matches()!.includes(d.entityId)):s.entities})).filter(s=>s.entities.length));
  shortName(entity:SmartDevice):string{for(const prefix of [entity.deviceName,this.robot().deviceName,this.robot().name])if(prefix&&entity.name.startsWith(prefix+' '))return entity.name.slice(prefix.length).trim();return entity.name;}
}
