import { Injectable, signal } from '@angular/core';
import { HomeProject } from '@sh3d/home-model';
import { BackendClient, BackendSession } from './backend-client';
import { HttpProjectRepository } from './http-project.repository';
import { IndexedDbProjectRepository, ProjectRepository, StoredAsset } from './project.repository';

@Injectable({providedIn:'root'})
export class StorageService implements ProjectRepository {
  readonly local=new IndexedDbProjectRepository();readonly mode=signal<'local'|'server'>('local');readonly session=signal<BackendSession|undefined>(undefined);readonly endpoint=signal('');readonly notice=signal('');readonly serverPending=signal(false);
  private active:ProjectRepository=this.local;private client?:BackendClient;private remote?:HttpProjectRepository;
  async initialize():Promise<void>{
    this.endpoint.set(await this.local.getPreference<string>('backend-url')??'');
    if(await this.local.getPreference<string>('storage-mode')!=='server'||!this.endpoint())return;
    this.serverPending.set(true);
    try{await this.inspect(this.endpoint());if(this.session()?.authenticated)this.activateRemote();else this.notice.set('Accedi al server per ritrovare la tua casa e il collegamento Home Assistant.');}
    catch(error){this.notice.set(error instanceof Error?error.message:'Server non disponibile. La tua casa rimane salvata sul server.');}
  }
  async inspect(url:string):Promise<BackendSession>{
    const normalized=new BackendClient(url).url;
    if(this.client?.url===normalized){const session=await this.client.session();this.session.set(session);return session;}
    if(this.mode()==='server')throw new Error('Apri prima l’archivio locale per cambiare server');
    const client=new BackendClient(url);client.onSession=session=>{if(this.client===client)this.session.set(session);};
    const session=await client.session();this.client=client;this.remote=new HttpProjectRepository(client,this.local);this.endpoint.set(client.url);this.session.set(session);await this.local.setPreference('backend-url',client.url);return session;
  }
  async authenticate(username:string,password:string):Promise<void>{if(!this.client)throw new Error('Verifica prima il server');this.session.set(await this.client.authenticate(username,password,this.session()?.setupRequired??false));}
  private activateRemote():void{if(!this.remote||!this.session()?.authenticated)throw new Error('Accedi al server');this.active=this.remote;this.mode.set('server');this.serverPending.set(false);this.notice.set('');}
  async useServer():Promise<void>{this.server();await this.local.setPreference('storage-mode','server');this.activateRemote();}
  async useLocal():Promise<void>{await this.local.setPreference('storage-mode','local');this.active=this.local;this.mode.set('local');this.serverPending.set(false);this.notice.set('');}
  capture():ProjectRepository{return this.active;}
  async logout():Promise<void>{if(this.client)await this.client.logout();this.session.set(undefined);}
  server():HttpProjectRepository{if(!this.remote||!this.session()?.authenticated)throw new Error('Accedi al server');return this.remote;}
  connection():BackendClient{if(!this.client||!this.session()?.authenticated)throw new Error('Accedi al server');return this.client;}
  async refreshSession():Promise<void>{if(this.client)this.session.set(await this.client.session());}
  list():Promise<HomeProject[]>{return this.active.list();}get(id:string):Promise<HomeProject|undefined>{return this.active.get(id);}save(p:HomeProject):Promise<void>{return this.active.save(p);}delete(id:string):Promise<void>{return this.active.delete(id);}
  saveAsset(asset:StoredAsset):Promise<void>{return this.active.saveAsset(asset);}getAsset(id:string):Promise<StoredAsset|undefined>{return this.active.getAsset(id);}listAssets(projectId:string):Promise<StoredAsset[]>{return this.active.listAssets(projectId);}
  getPreference<T>(key:string):Promise<T|undefined>{return this.active.getPreference<T>(key);}setPreference(key:string,value:unknown):Promise<void>{return this.active.setPreference(key,value);}
}
