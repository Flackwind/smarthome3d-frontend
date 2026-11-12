import { SmartDevice } from '@sh3d/device-model';
export const stateLabel=(state:string):string=>({on:'Acceso',off:'Spento',unavailable:'Non disponibile',unknown:'Sconosciuto',docked:'Alla base',cleaning:'In pulizia',paused:'In pausa',returning:'Ritorno alla base',idle:'In attesa',heat:'Riscaldamento',auto:'Automatico'}[state]??state);
export function deviceIcon(d:SmartDevice):string{return ({light:'☼',vacuum:'◉',sensor:'◌',binary_sensor:'◌',climate:'≋',switch:'⊙',input_boolean:'⊙'} as Record<string,string>)[d.domain]??'◇';}
export function deviceStateLabel(device:SmartDevice):string{
  if(device.state==='unknown'&&device.domain==='button')return 'Mai eseguito';
  if(['button','image','camera'].includes(device.domain)&&/^\d{4}-\d\d-\d\dT/.test(device.state)){const date=new Date(device.state);if(Number.isFinite(date.getTime()))return new Intl.DateTimeFormat('it-IT',{dateStyle:'short',timeStyle:'short'}).format(date);}
  return stateLabel(device.state);
}
