import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { SmartDevice, VacuumGroup, vacuumGroups } from '@sh3d/device-model';
import { ProjectStore } from '../../core/configuration/project.store';
import { DeviceStore } from '../../core/providers/device.store';
import { DeviceControlsComponent } from '../../shared/components/device-controls.component';
import { deviceIcon } from '../../shared/utilities/device-display';
import { VacuumDetailComponent } from '../vacuum-detail/vacuum-detail.component';
interface DeviceCard {device:SmartDevice;group?:VacuumGroup;matches?:string[]}
@Component({standalone:true,imports:[TranslatePipe,FormsModule,RouterLink,DeviceControlsComponent,VacuumDetailComponent],templateUrl:'./devices.component.html',styleUrl:'./devices.component.scss'})
export class DevicesComponent {
  readonly devices=inject(DeviceStore);readonly store=inject(ProjectStore);readonly query=signal('');readonly domain=signal('');readonly area=signal('');readonly view=signal<'devices'|'entities'>('devices');readonly icon=deviceIcon;
  readonly groups=computed(()=>vacuumGroups(this.devices.devices(),this.store.project().bindings.filter(b=>b.provider===this.devices.providerId())));
  readonly areas=computed(()=>[...new Set(this.devices.devices().map(d=>d.areaName).filter((a):a is string=>!!a))].sort());
  readonly filtered=computed<DeviceCard[]>(()=>{
    const content=(d:SmartDevice)=>(!this.query().trim()||`${d.name} ${d.entityId}`.toLowerCase().includes(this.query().trim().toLowerCase()))&&(!this.domain()||d.domain===this.domain());
    const area=(d:SmartDevice)=>!this.area()||d.areaName===this.area();
    if(this.view()==='entities')return this.devices.devices().filter(d=>content(d)&&area(d)).map(device=>({device}));
    const grouped=new Set(this.groups().flatMap(g=>g.members.map(d=>d.entityId)));
    const robots=this.groups().filter(g=>g.members.some(content)&&g.members.some(area)).map(group=>({device:group.robot,group,matches:content(group.robot)&&(!this.domain()||this.domain()==='vacuum')?undefined:group.members.filter(content).map(d=>d.entityId)}));
    return [...robots,...this.devices.devices().filter(d=>!grouped.has(d.entityId)&&content(d)&&area(d)).map(device=>({device}))];
  });
  mapped(d:SmartDevice){const binding=this.store.project().bindings.find(b=>b.entityId===d.entityId&&b.provider===this.devices.providerId());return this.store.project().building.floors.flatMap(f=>f.objects).find(o=>o.id===binding?.objectId);}
  selectObject(id:string):void{const floor=this.store.project().building.floors.find(f=>f.objects.some(o=>o.id===id));if(floor)this.store.activeFloorId.set(floor.id);this.store.activeRoomId.set('');this.store.selectedId.set(id);}
}
