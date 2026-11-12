import { Injectable, inject } from '@angular/core';
import { StorageService } from './storage.service';

export interface EnergyTotal {amount:number;cost:number|null;knownCost:number;unpriced:number;observedHours:number;qualities:string[]}
export interface EnergyMonth {month:string;electricity:EnergyTotal|null;gas:EnergyTotal|null;devices:{id:string;name:string;total:EnergyTotal}[]}
export interface MonthlyEnergy {month:string;utility:'electricity'|'gas';amount:number;cost:number|null}
export interface EnergyYear {months:EnergyMonth[];monthly:MonthlyEnergy[];status:{lastSample:string;message:string;issues:string[]}}
@Injectable({providedIn:'root'})
export class EnergyService {
  private readonly storage=inject(StorageService);
  async year(id:string,year:number):Promise<EnergyYear>{return (await this.storage.connection().request(`/projects/${encodeURIComponent(id)}/energy?year=${year}`)).json() as Promise<EnergyYear>;}
  async sample(id:string):Promise<void>{await this.storage.connection().json(`/projects/${encodeURIComponent(id)}/energy/sample`,{});}
  async monthly(id:string,value:MonthlyEnergy):Promise<void>{await this.storage.connection().request(`/projects/${encodeURIComponent(id)}/energy/monthly`,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(value)});}
  async remove(id:string,value:MonthlyEnergy):Promise<void>{await this.storage.connection().request(`/projects/${encodeURIComponent(id)}/energy/monthly/${value.month}/${value.utility}`,{method:'DELETE'});}
}
