/** Portable configuration only. Time series live in the server, never in scene geometry. */
export interface EnergyContract {
  from:string; name:string; electricityMode:'single'|'bands'|'hourly';
  electricity:number[]; gas:number|null;
}
export interface ElectricProfile {
  id:string; name:string; entityId:string; mode:'nominal'|'power'|'counter';
  sensorId:string; watts:number; standbyWatts:number; activeStates:string[]; includeInTotal:boolean;
}
export interface HeatingZone {
  id:string; name:string; radiators:number; climateId:string; indoorId:string;
  indoorTemperature:number; targetTemperature:number;
}
export interface EnergyConfiguration {
  version:1; enabled:boolean; contracts:EnergyContract[]; devices:ElectricProfile[];
  mains:{mode:'none'|'power'|'counter';sensorId:string};
  gas:{mode:'off'|'counter'|'thermal';sensorId:string; volumeCorrection:number;
    heatLoss:number; efficiency:number; calorificValue:number; outdoorId:string;
    outdoorTemperature:number; heatingEnabled:boolean; baseSmcPerDay:number; zones:HeatingZone[]};
}
export function createEnergyConfiguration():EnergyConfiguration {
  return {version:1,enabled:false,contracts:[],devices:[],mains:{mode:'none',sensorId:''},
    gas:{mode:'off',sensorId:'',volumeCorrection:1,heatLoss:0,efficiency:.9,calorificValue:10.7,
      outdoorId:'',outdoorTemperature:10,heatingEnabled:false,baseSmcPerDay:0,zones:[]}};
}
export function heatLossCoefficient(u:number,area:number,airChanges:number,volume:number):number {
  return u*area+.33*airChanges*volume;
}
export function validateEnergy(value:unknown):string[] {
  const errors:string[]=[];
  const obj=(v:unknown):Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{};
  const e=obj(value),m=obj(e['mains']),g=obj(e['gas']);
  const check=(ok:unknown,msg:string)=>{if(!ok)errors.push(msg);};
  const num=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
  const entity=(v:unknown)=>typeof v==='string'&&(v===''||/^[a-z_]+\.[a-z0-9_]+$/.test(v));
  const label=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=200;
  const list=(v:unknown,max:number):unknown[]=>{check(Array.isArray(v)&&v.length<=max,'Lista consumi non valida');return Array.isArray(v)?v.slice(0,max):[];};
  check(e['version']===1&&typeof e['enabled']==='boolean','Configurazione consumi non valida');
  const dates=new Set<string>();
  for(const v of list(e['contracts'],100)){
    const c=obj(v),date=c['from'];
    check(typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&Number.isFinite(Date.parse(date))&&new Date(date).toISOString().slice(0,10)===date&&!dates.has(date),'Decorrenza contratto non valida o duplicata');dates.add(String(date));
    check(label(c['name'])&&['single','bands','hourly'].includes(String(c['electricityMode'])),'Contratto non valido');
    const rates=list(c['electricity'],24);check(rates.length===(c['electricityMode']==='single'?1:c['electricityMode']==='bands'?3:24)&&rates.every(v=>num(v,0,100)),'Tariffe luce non valide (€/kWh)');
    check(c['gas']===null||num(c['gas'],0,100),'Tariffa gas non valida (€/Smc)');
  }
  check(['none','power','counter'].includes(String(m['mode']))&&entity(m['sensorId'])&&(m['mode']==='none'||!!m['sensorId']),'Contatore generale non valido');
  const ids=new Set<string>(),sources=new Set<string>();
  for(const v of list(e['devices'],500)){
    const d=obj(v);check(label(d['id'])&&!ids.has(String(d['id']))&&/^[a-zA-Z0-9_-]+$/.test(String(d['id'])),'Profilo dispositivo duplicato o non valido');ids.add(String(d['id']));
    check(label(d['name'])&&entity(d['entityId'])&&!!d['entityId']&&['nominal','power','counter'].includes(String(d['mode']))&&entity(d['sensorId'])&&(d['mode']==='nominal'||!!d['sensorId']),'Sorgente consumo dispositivo non valida');
    check(num(d['watts'],0,1000000)&&num(d['standbyWatts'],0,1000000)&&typeof d['includeInTotal']==='boolean','Potenza dispositivo non valida');
    check(list(d['activeStates'],30).every(v=>typeof v==='string'&&v.length>0&&v.length<=80),'Stati attivi non validi');
    if(d['includeInTotal']){const source=String(d['mode']==='nominal'?d['entityId']:d['sensorId']);check(!sources.has(source),'La stessa sorgente è inclusa due volte nel totale');sources.add(source);}
  }
  check(['off','counter','thermal'].includes(String(g['mode']))&&entity(g['sensorId'])&&(g['mode']!=='counter'||!!g['sensorId']),'Contatore gas non valido');
  for(const [key,min,max] of [['volumeCorrection',.1,10],['heatLoss',0,100000],['efficiency',.01,1],['calorificValue',1,30],['outdoorTemperature',-80,60],['baseSmcPerDay',0,1000]] as const)check(num(g[key],min,max),'Parametro riscaldamento non valido: '+key);
  check(entity(g['outdoorId'])&&typeof g['heatingEnabled']==='boolean','Temperatura esterna o riscaldamento non valido');
  const zoneIds=new Set<string>();
  for(const v of list(g['zones'],100)){
    const z=obj(v);check(label(z['id'])&&!zoneIds.has(String(z['id']))&&label(z['name']),'Zona termica non valida o duplicata');zoneIds.add(String(z['id']));
    check(Number.isInteger(z['radiators'])&&num(z['radiators'],1,100)&&entity(z['climateId'])&&entity(z['indoorId'])&&num(z['indoorTemperature'],-20,60)&&num(z['targetTemperature'],5,35),'Parametri zona termica non validi');
  }
  if(g['mode']==='thermal')check(num(g['heatLoss'],.01,100000)&&Array.isArray(g['zones'])&&g['zones'].length>0,'Per stimare il gas servono dispersione H e almeno una zona');
  return [...new Set(errors)];
}
