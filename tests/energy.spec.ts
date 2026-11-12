import { describe, expect, it } from 'vitest';
import { createEnergyConfiguration, createProject, heatLossCoefficient, parseProject, serializeProject, validateEnergy } from '@sh3d/home-model';

describe('portable energy configuration',()=>{
  it('opens older houses and preserves contracts, units and profiles through a JSON backup',()=>{
    const p=createProject('Casa energia');expect(parseProject(serializeProject(p)).energy).toBeUndefined();
    const c=createEnergyConfiguration();c.contracts=[{from:'2026-11-01',name:'Bioraria',electricityMode:'bands',electricity:[.3,.2,.2],gas:.8}];
    c.devices.push({id:'lamp',name:'Lampada',entityId:'light.casa',mode:'nominal',sensorId:'',watts:12,standbyWatts:.5,activeStates:['on'],includeInTotal:true});p.energy=c;
    expect(parseProject(serializeProject(p)).energy).toEqual(c);
  });
  it('rejects incomplete prices, duplicate sources, impossible dates and physical parameters',()=>{
    const c=createEnergyConfiguration();c.contracts=[{from:'2026-02-30',name:'Fornitura',electricityMode:'hourly',electricity:[.2],gas:null}];expect(validateEnergy(c).join(' ')).toMatch(/Decorrenza.*Tariffe/);
    c.contracts=[];c.devices=Array.from({length:2},(_,i)=>({id:'profile'+i,name:'Presa',entityId:'switch.presa',sensorId:'sensor.potenza',mode:'power' as const,watts:0,standbyWatts:0,activeStates:[],includeInTotal:true}));expect(validateEnergy(c)).toContain('La stessa sorgente è inclusa due volte nel totale');
    c.devices=[];c.gas.mode='thermal';c.gas.efficiency=1.1;expect(validateEnergy(c).length).toBeGreaterThan(0);c.gas.efficiency=.9;c.gas.heatLoss=200;c.gas.zones=[{id:'zone',name:'Zona',radiators:3,climateId:'',indoorId:'',indoorTemperature:20,targetTemperature:20}];expect(validateEnergy(c)).toEqual([]);
  });
  it('derives a heat loss coefficient in W/K, independently of radiator count',()=>{expect(heatLossCoefficient(.8,200,.5,270)).toBeCloseTo(204.55);});
});
