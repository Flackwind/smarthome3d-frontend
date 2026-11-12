import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { I18nService } from '../../core/i18n/i18n.service';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DashboardConfiguration, FURNITURE_CATALOG, polygonArea, Room } from '@sh3d/home-model';
import { ProjectStore } from '../../core/configuration/project.store';
import { DeviceStore } from '../../core/providers/device.store';
import { houseEntities } from '../../core/providers/house-devices';
import { isTemperatureSource, outdoorTemperature, temperatureCelsius } from '../../core/providers/temperature';
import { Home3dComponent } from '../home-3d/home-3d.component';
import { ObjectPanelComponent } from '../device-mapping/object-panel.component';
import { deviceIcon, stateLabel } from '../../shared/utilities/device-display';
@Component({standalone:true,imports:[TranslatePipe,RouterLink,FormsModule,Home3dComponent,ObjectPanelComponent],templateUrl:'./dashboard.component.html',styleUrl:'./dashboard.component.scss'})
export class DashboardComponent {
  readonly i18n=inject(I18nService);
  readonly store=inject(ProjectStore);readonly devices=inject(DeviceStore);readonly icon=deviceIcon;readonly label=stateLabel;
  readonly lights=computed(()=>this.devices.devices().filter(d=>d.domain==='light').length);
  readonly temperatureSettings=signal(false);
  readonly indoorOptions=computed(()=>this.devices.devices().filter(isTemperatureSource));
  readonly outdoorOptions=computed(()=>this.indoorOptions().filter(d=>d.domain==='sensor'));
  readonly weatherOptions=computed(()=>this.devices.devices().filter(d=>d.domain==='weather'));
  readonly temperatureConfig=computed<DashboardConfiguration>(()=>this.store.project().dashboard??{
    indoorTemperatureEntityId:houseEntities(this.store.project(),this.devices.devices(),this.devices.providerId()).find(d=>d.domain==='sensor'&&isTemperatureSource(d))?.entityId??'',
    outdoorTemperatureEntityId:'',outdoorWeatherEntityId:'',useWeatherFallback:true
  });
  readonly indoorDevice=computed(()=>this.devices.devices().find(d=>d.entityId===this.temperatureConfig().indoorTemperatureEntityId));
  readonly indoorTemperature=computed(()=>this.devices.status()==='connected'?temperatureCelsius(this.indoorDevice()):undefined);
  readonly outdoorReading=computed(()=>outdoorTemperature(this.temperatureConfig(),this.devices.status()==='connected'?this.devices.devices():[]));
  readonly outdoorDevice=computed(()=>this.devices.devices().find(d=>d.entityId===this.outdoorReading().entityId));
  readonly totalArea=computed(()=>this.store.floor().rooms.reduce((a,r)=>a+Number(this.area(r)),0).toFixed(1));
  readonly smartObjects=computed(()=>this.store.floor().objects.filter(o=>['bulb','floor-lamp','led-strip','ceiling-light','vacuum','radiator','sensor','outlet','switch'].includes(o.type)&&(!this.store.activeRoomId()||o.roomId===this.store.activeRoomId())).map(object=>{const binding=this.store.project().bindings.find(b=>b.objectId===object.id&&b.provider===this.devices.providerId());return {object,device:this.devices.devices().find(d=>d.entityId===binding?.entityId)};}).slice(0,6));
  area(r:Room):string{return Math.abs(polygonArea(r.vertexIds.map(id=>this.store.floor().vertices.find(v=>v.id===id)!))).toFixed(1);}
  roomDevices(id:string):number{return this.store.floor().objects.filter(o=>o.roomId===id).length;}
  roomIcon(name:string):string{const n=name.toLowerCase();return n.includes('cucin')?'▤':n.includes('camer')?'▥':n.includes('bagn')?'◌':'▰';}
  objectIcon(type:string):string{return FURNITURE_CATALOG.find(c=>c.type===type)?.icon??'◇';}
  roomName(id?:string):string{return this.store.floor().rooms.find(r=>r.id===id)?.name??'Senza stanza';}
  changeFloor(id:string):void{this.store.activeFloorId.set(id);this.store.activeRoomId.set('');this.store.selectedId.set('');}
  configureTemperature<K extends keyof DashboardConfiguration>(key:K,value:DashboardConfiguration[K]):void{this.store.change(p=>p.dashboard={...this.temperatureConfig(),[key]:value});}
  missingTemperature(id:string,kind:'indoor'|'outdoor'|'weather'):boolean{return !!id&&!(kind==='indoor'?this.indoorOptions():kind==='outdoor'?this.outdoorOptions():this.weatherOptions()).some(d=>d.entityId===id);}
  temperatureLabel(value:number|undefined):string{return value===undefined?'—':new Intl.NumberFormat(this.i18n.locale(),{maximumFractionDigits:1}).format(value);}
}
