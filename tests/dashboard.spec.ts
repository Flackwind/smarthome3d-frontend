import { describe, expect, it } from 'vitest';
import { fromHassState } from '@sh3d/device-model';
import { createDemoProject, parseProject, serializeProject, validateProject } from '@sh3d/home-model';
import { houseDevices, houseEntities, electricMeasurement } from '../apps/web/src/app/core/providers/house-devices';
import { outdoorTemperature, temperatureCelsius } from '../apps/web/src/app/core/providers/temperature';
import { savedLanguage, translate } from '../apps/web/src/app/core/i18n/translation';

const device=(id:string,state:string,attributes:Record<string,unknown>={})=>fromHassState({entity_id:id,state,attributes});
const configuration={indoorTemperatureEntityId:'sensor.indoor',outdoorTemperatureEntityId:'sensor.outdoor',outdoorWeatherEntityId:'weather.home',useWeatherFallback:true};

describe('house device ownership',()=>{
  it('limits choices to real object bindings, deduplicates them and keeps offline choices',()=>{
    const p=createDemoProject(),b=p.bindings[0];p.bindings=[b,{...b,id:'second'},{...b,id:'orphan',objectId:'missing',entityId:'light.orphan'},{...b,id:'ha',provider:'home-assistant',entityId:'light.other_provider'}];
    expect(houseDevices(p,[],'mock').map(d=>d.entityId)).toEqual([b.entityId]);
    expect(houseDevices(p,[],'mock')[0].name).toBe(p.building.floors[0].objects.find(o=>o.id===b.objectId)!.name);
    expect(houseDevices(p,[],'home-assistant').map(d=>d.entityId)).toEqual(['light.other_provider']);
  });
  it('offers only explicit related entities or measurements of the same physical device/group',()=>{
    const p=createDemoProject(),b=p.bindings[0];p.bindings=[{...b,relatedEntityIds:['sensor.explicit']}];
    const primary={...device(b.entityId,'on'),deviceId:'plug',deviceGroupId:'robot'};
    const states=[primary,{...device('sensor.power','10',{unit_of_measurement:'W'}),deviceId:'plug'},
      {...device('sensor.dock','2',{unit_of_measurement:'kWh'}),deviceId:'dock',deviceGroupId:'robot'},device('sensor.explicit','1',{unit_of_measurement:'kW'}),
      {...device('sensor.unrelated','7',{unit_of_measurement:'W'}),areaName:primary.areaName,name:primary.name}];
    expect(houseEntities(p,states,'mock',b.entityId).map(d=>d.entityId)).toEqual([b.entityId,'sensor.power','sensor.dock','sensor.explicit']);
    expect(houseEntities(p,states,'mock','')).toEqual([]);
    expect(houseEntities(p,states,'mock','light.unbound')).toEqual([]);
    expect(houseEntities(p,states,'mock').filter(d=>electricMeasurement(d,'power')).map(d=>d.entityId)).toEqual(['sensor.power','sensor.explicit']);
  });
});

describe('dashboard temperature sources',()=>{
  it('reads zero and converts explicit HA units without treating weather conditions or missing values as degrees',()=>{
    expect(temperatureCelsius(device('sensor.zero','0',{unit_of_measurement:'°C'}))).toBe(0);
    expect(temperatureCelsius(device('climate.room','heat',{current_temperature:68,temperature_unit:'°F'}))).toBeCloseTo(20);
    expect(temperatureCelsius(device('weather.home','cloudy',{temperature:273.15,temperature_unit:'K'}))).toBeCloseTo(0);
    for(const d of [device('sensor.missing','unknown',{unit_of_measurement:'°C'}),device('sensor.no_unit','22'),device('sensor.bad','',{unit_of_measurement:'°C'}),device('weather.home','cloudy',{temperature_unit:'°C'}),device('sensor.hot','900',{unit_of_measurement:'°C'})])expect(temperatureCelsius(d)).toBeUndefined();
  });
  it('prefers the physical outdoor thermometer, with explicit optional HA weather fallback',()=>{
    const sensor=device('sensor.outdoor','0',{unit_of_measurement:'°C'}),weather=device('weather.home','sunny',{temperature:13,temperature_unit:'°C'});
    expect(outdoorTemperature(configuration,[sensor,weather])).toEqual({value:0,entityId:'sensor.outdoor',weather:false});
    sensor.state='unavailable';expect(outdoorTemperature(configuration,[sensor,weather])).toEqual({value:13,entityId:'weather.home',weather:true});
    expect(outdoorTemperature({...configuration,useWeatherFallback:false},[sensor,weather]).value).toBeUndefined();
    expect(outdoorTemperature({...configuration,outdoorTemperatureEntityId:''},[weather]).value).toBe(13);
    expect(outdoorTemperature(configuration,[]).value).toBeUndefined();
  });
  it('preserves sources in project backups and rejects wrong entity domains while opening legacy houses',()=>{
    const p=createDemoProject();expect(parseProject(serializeProject(p)).dashboard).toBeUndefined();p.dashboard={...configuration};
    expect(parseProject(serializeProject(p)).dashboard).toEqual(configuration);
    for(const patch of [{indoorTemperatureEntityId:'weather.home'},{outdoorTemperatureEntityId:'climate.room'},{outdoorWeatherEntityId:'sensor.outdoor'},{useWeatherFallback:'yes'}])expect(validateProject({...p,dashboard:{...configuration,...patch}})).toContain('Configurazione temperature dashboard non valida');
  });
});

describe('language selection',()=>{
  it('translates application labels and preserves unknown personal names, spacing and Italian',()=>{
    expect(translate('Temperatura esterna','en')).toBe('Outdoor temperature');
    expect(translate('  Dispositivi ','en')).toBe('  Devices ');
    expect(translate('Da sensori · Stima da watt','en')).toBe('From sensors · Estimate from watts');
    expect(translate('Casa di Teo','en')).toBe('Casa di Teo');expect(translate('Temperatura esterna','it')).toBe('Temperatura esterna');
    expect(savedLanguage('en')).toBe('en');for(const value of ['de','EN',null,{}])expect(savedLanguage(value)).toBe('it');
  });
});
