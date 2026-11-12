import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { createEnergyConfiguration, EnergyConfiguration, EnergyContract, heatLossCoefficient, uid, validateEnergy } from '@sh3d/home-model';
import { ProjectStore } from '../../core/configuration/project.store';
import { DeviceStore } from '../../core/providers/device.store';
import { electricMeasurement, houseDevices, houseEntities } from '../../core/providers/house-devices';
import { EnergyMonth, EnergyService, EnergyTotal, EnergyYear, MonthlyEnergy } from '../../core/persistence/energy.service';

@Component({standalone:true,imports:[TranslatePipe,CommonModule,FormsModule,RouterLink],templateUrl:'./energy.component.html',styleUrl:'./energy.component.scss'})
export class EnergyComponent {
  readonly store=inject(ProjectStore);readonly devices=inject(DeviceStore);private readonly api=inject(EnergyService);
  readonly tab=signal('overview');readonly data=signal<EnergyYear|undefined>(undefined);readonly busy=signal(false);readonly error=signal('');readonly notice=signal('');
  readonly server=computed(()=>this.store.repository.mode()==='server'&&!!this.store.repository.session()?.authenticated);
  readonly year=signal(new Date().getFullYear());readonly selected=signal(new Date().getMonth());readonly metric=signal<'amount'|'cost'>('amount');
  readonly months=computed<EnergyMonth[]>(()=>this.data()?.months??Array.from({length:12},(_,i)=>({month:`${this.year()}-${String(i+1).padStart(2,'0')}`,electricity:null,gas:null,devices:[]})));
  readonly current=computed(()=>this.months()[this.selected()]);
  readonly entities=computed(()=>this.devices.devices());
  readonly linkedDevices=computed(()=>houseDevices(this.store.project(),this.entities(),this.devices.providerId()));
  readonly mainsOptions=computed(()=>houseEntities(this.store.project(),this.entities(),this.devices.providerId()));
  config:EnergyConfiguration=createEnergyConfiguration();
  contractName='La mia fornitura';contractFrom=this.today();contractMode:EnergyContract['electricityMode']='single';rates:(number|null)[]=[null];gasPrice:number|null=null;editingFrom='';
  deviceId='';deviceName='';profileMode:'nominal'|'power'|'counter'='nominal';sensorId='';watts:number|null=null;standby=0;activeStates='on,cleaning,returning,heating,cooling';include=true;
  u:number|null=null;area:number|null=null;airChanges:number|null=null;volume:number|null=null;
  manualMonth=this.today().slice(0,7);manualUtility:'electricity'|'gas'='electricity';manualAmount:number|null=null;manualCost:number|null=null;
  private generation=0;
  constructor(){
    let previous='';effect(()=>{const p=this.store.project(),key=p.id+'|'+JSON.stringify(p.energy);if(key!==previous){previous=key;this.config=structuredClone(p.energy??createEnergyConfiguration());}});
    effect(()=>{const id=this.store.project().id,server=this.server(),year=this.year();untracked(()=>{this.data.set(undefined);this.error.set('');if(server)void this.load(id,year);else this.generation++;});});
  }
  today():string{return new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date());}
  async load(id=this.store.project().id,year=this.year()):Promise<void>{const generation=++this.generation;this.busy.set(true);try{const data=await this.api.year(id,year);if(generation===this.generation)this.data.set(data);}catch(e){if(generation===this.generation)this.fail(e);}finally{if(generation===this.generation)this.busy.set(false);}}
  fail(e:unknown):void{this.error.set(e instanceof Error?e.message:'Operazione non riuscita');}
  async save():Promise<void>{this.error.set('');this.notice.set('');const errors=validateEnergy(this.config);if(errors.length){this.error.set(errors.join('; '));return;}if(this.store.change(p=>p.energy=structuredClone(this.config))&&await this.store.save()){this.notice.set('Configurazione consumi salvata');if(this.server())await this.load();}}
  contractModeChanged(mode:EnergyContract['electricityMode']):void{this.contractMode=mode;this.rates=Array(mode==='single'?1:mode==='bands'?3:24).fill(null);}
  addContract():void{
    const c:EnergyContract={from:this.contractFrom,name:this.contractName.trim(),electricityMode:this.contractMode,electricity:this.rates.map(v=>v as number),gas:this.gasPrice};
    const candidate=structuredClone(this.config);candidate.contracts=candidate.contracts.filter(v=>v.from!==this.editingFrom);candidate.contracts.push(c);
    const errors=validateEnergy(candidate);if(errors.length){this.error.set(errors.join('; '));return;}this.config=candidate;this.editingFrom='';this.error.set('');this.notice.set('Contratto aggiunto alla configurazione. Premi Salva configurazione.');
  }
  editContract(c:EnergyContract):void{this.editingFrom=c.from;this.contractFrom=c.from;this.contractName=c.name;this.contractMode=c.electricityMode;this.rates=[...c.electricity];this.gasPrice=c.gas;}
  removeContract(from:string):void{this.config.contracts=this.config.contracts.filter(c=>c.from!==from);}
  addDevice():void{
    const selected=this.linkedDevices().find(d=>d.entityId===this.deviceId);
    if(!selected){this.error.set('Seleziona un dispositivo associato alla casa nell’editor');return;}
    if(this.profileMode!=='nominal'&&!this.measurements(this.deviceId,this.profileMode).some(d=>d.entityId===this.sensorId)){this.error.set('Scegli un sensore di consumo collegato al dispositivo');return;}
    const candidate=structuredClone(this.config);candidate.devices.push({id:uid(),name:this.deviceName.trim()||selected?.name||this.deviceId,entityId:this.deviceId.trim(),mode:this.profileMode,sensorId:this.sensorId.trim(),watts:this.watts??0,standbyWatts:this.standby,activeStates:this.activeStates.split(',').map(v=>v.trim()).filter(Boolean),includeInTotal:this.include});
    if(this.profileMode==='nominal'&&this.watts===null){this.error.set('Inserisci i watt nominali del dispositivo');return;}
    const errors=validateEnergy(candidate);if(errors.length){this.error.set(errors.join('; '));return;}this.config=candidate;this.deviceId='';this.deviceName='';this.error.set('');this.notice.set('Dispositivo aggiunto. Premi Salva configurazione.');
  }
  measurements(entityId:string,mode:'power'|'counter'){return houseEntities(this.store.project(),this.entities(),this.devices.providerId(),entityId).filter(d=>electricMeasurement(d,mode));}
  generalMeasurements(){return this.mainsOptions().filter(d=>this.config.mains.mode!=='none'&&electricMeasurement(d,this.config.mains.mode));}
  hasGeneralMeasurement(id:string):boolean{return this.generalMeasurements().some(d=>d.entityId===id);}
  hasMeasurement(entityId:string,id:string,mode:'power'|'counter'):boolean{return this.measurements(entityId,mode).some(d=>d.entityId===id);}
  chooseDevice(value:string):void{this.deviceId=value;this.sensorId='';}
  removeDevice(id:string):void{this.config.devices=this.config.devices.filter(d=>d.id!==id);}
  addZone():void{this.config.gas.zones.push({id:uid(),name:`Zona ${this.config.gas.zones.length+1}`,radiators:1,climateId:'',indoorId:'',indoorTemperature:20,targetTemperature:20});}
  removeZone(id:string):void{this.config.gas.zones=this.config.gas.zones.filter(z=>z.id!==id);}
  deriveHeatLoss():void{if([this.u,this.area,this.airChanges,this.volume].some(v=>v===null||!Number.isFinite(v)||v<0)){this.error.set('Completa i quattro parametri della dispersione');return;}this.config.gas.heatLoss=Math.round(heatLossCoefficient(this.u!,this.area!,this.airChanges!,this.volume!)*100)/100;}
  async sample():Promise<void>{if(!await this.store.save())return;this.busy.set(true);this.error.set('');try{await this.api.sample(this.store.project().id);await this.load();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  async saveMonthly():Promise<void>{
    if(this.manualAmount===null||!Number.isFinite(this.manualAmount)||this.manualAmount<0){this.error.set('Inserisci un consumo mensile valido');return;}
    if(!await this.store.save())return;this.busy.set(true);this.error.set('');try{await this.api.monthly(this.store.project().id,{month:this.manualMonth,utility:this.manualUtility,amount:this.manualAmount,cost:this.manualCost});this.year.set(Number(this.manualMonth.slice(0,4)));this.selected.set(Number(this.manualMonth.slice(5))-1);await this.load();this.notice.set('Consuntivo salvato: sostituisce il totale automatico del mese');}catch(e){this.fail(e);}finally{this.busy.set(false);}
  }
  async removeMonthly(value:MonthlyEnergy):Promise<void>{this.busy.set(true);try{await this.api.remove(this.store.project().id,value);await this.load();}catch(e){this.fail(e);}finally{this.busy.set(false);}}
  value(total:EnergyTotal|null):number|null{return total?total[this.metric()]:null;}
  height(total:EnergyTotal|null,utility:'electricity'|'gas'):number{const value=this.value(total),max=Math.max(0,...this.months().map(m=>this.value(m[utility])??0));return value===null||max===0?0:Math.max(2,value/max*100);}
  monthName(index:number):string{return ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][index];}
  quality(total:EnergyTotal|null):string{if(!total)return 'Nessun dato';return total.qualities.map(q=>({sensor:'Da sensori',nominal:'Stima da watt',thermal:'Stima termica',manual:'Consuntivo manuale'}[q]??q)).join(' · ');}
  state(id:string):string{return this.entities().find(d=>d.entityId===id)?.state??'Non disponibile';}
}
