export interface DashboardConfiguration {
  indoorTemperatureEntityId:string;
  outdoorTemperatureEntityId:string;
  outdoorWeatherEntityId:string;
  useWeatherFallback:boolean;
}
export function validDashboard(value:unknown):value is DashboardConfiguration {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const d=value as Record<string,unknown>;
  const entity=(key:string,domains:string)=>typeof d[key]==='string'&&(d[key]===''||new RegExp(`^(${domains})\\.[a-z0-9_]+$`).test(d[key] as string));
  return entity('indoorTemperatureEntityId','sensor|climate')&&entity('outdoorTemperatureEntityId','sensor')&&entity('outdoorWeatherEntityId','weather')&&typeof d['useWeatherFallback']==='boolean';
}
