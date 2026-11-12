import { SmartDevice } from '@sh3d/device-model';
import { DashboardConfiguration } from '@sh3d/home-model';

export function isTemperatureSource(d:SmartDevice):boolean {
  return d.domain==='climate'||d.domain==='sensor'&&(d.attributes['device_class']==='temperature'||['°C','°F','K','C','F'].includes(String(d.attributes['unit_of_measurement'])));
}
/** Read standard HA attributes, with explicit units and unavailable states. Never guess zero. */
export function temperatureCelsius(d:SmartDevice|undefined):number|undefined {
  if(!d||['unavailable','unknown','none',''].includes(d.state))return undefined;
  const raw=d.domain==='weather'?d.attributes['temperature']:d.domain==='climate'?d.attributes['current_temperature']:d.state;
  if(typeof raw!=='number'&&(typeof raw!=='string'||!raw.trim()))return undefined;
  let value=Number(raw);if(!Number.isFinite(value))return undefined;
  const unit=d.attributes['temperature_unit']??d.attributes['unit_of_measurement'];
  if(unit==='°F'||unit==='F')value=(value-32)*5/9;else if(unit==='K')value-=273.15;else if(unit!=='°C'&&unit!=='C')return undefined;
  return value>=-100&&value<=100?value:undefined;
}
export function outdoorTemperature(config:DashboardConfiguration,devices:SmartDevice[]):{value:number|undefined;entityId:string;weather:boolean}{
  const sensor=devices.find(d=>d.entityId===config.outdoorTemperatureEntityId),value=temperatureCelsius(sensor);
  if(value!==undefined)return {value,entityId:config.outdoorTemperatureEntityId,weather:false};
  if(config.useWeatherFallback){
    const weather=devices.find(d=>d.entityId===config.outdoorWeatherEntityId),fallback=temperatureCelsius(weather);
    if(fallback!==undefined||!config.outdoorTemperatureEntityId)return {value:fallback,entityId:config.outdoorWeatherEntityId,weather:!!config.outdoorWeatherEntityId};
  }
  return {value:undefined,entityId:config.outdoorTemperatureEntityId,weather:false};
}
