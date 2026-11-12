import { assertProject, HomeProject, migrateProject, serializeProject } from '@sh3d/home-model';
export interface StoredAsset { id:string; projectId:string; name:string; blob:Blob }
export interface ProjectRepository {
  list():Promise<HomeProject[]>;get(id:string):Promise<HomeProject|undefined>;save(p:HomeProject):Promise<void>;delete(id:string):Promise<void>;
  saveAsset(asset:StoredAsset):Promise<void>;getAsset(id:string):Promise<StoredAsset|undefined>;listAssets(projectId:string):Promise<StoredAsset[]>;
  getPreference<T>(key:string):Promise<T|undefined>;setPreference(key:string,value:unknown):Promise<void>;
}
export class IndexedDbProjectRepository implements ProjectRepository {
  private database?:Promise<IDBDatabase>;
  constructor(private readonly name='smart-home-3d'){}
  private db():Promise<IDBDatabase>{return this.database??=new Promise((resolve,reject)=>{
    const request=indexedDB.open(this.name,1);
    request.onupgradeneeded=()=>{for(const store of ['projects','assets','preferences'])request.result.createObjectStore(store,{keyPath:'id'});};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.database=undefined;};resolve(db);};
    request.onerror=()=>{this.database=undefined;reject(request.error);};request.onblocked=()=>reject(new Error('Chiudi le altre schede per aggiornare il database'));
  });}
  private async read<T>(store:string,key?:string):Promise<T> {
    const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readonly'),request=key?tx.objectStore(store).get(key):tx.objectStore(store).getAll();request.onsuccess=()=>resolve(request.result as T);request.onerror=()=>reject(request.error);});
  }
  private async write(store:string,value:unknown,key?:string):Promise<void>{
    const db=await this.db();return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');if(key)tx.objectStore(store).delete(key);else tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error??new Error('Salvataggio non riuscito'));tx.onabort=()=>reject(tx.error??new Error('Salvataggio annullato'));});
  }
  async list():Promise<HomeProject[]>{return (await this.read<unknown[]>('projects')).map(migrateProject).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
  async get(id:string):Promise<HomeProject|undefined>{const p=await this.read<unknown>('projects',id);return p?migrateProject(p):undefined;}
  async save(p:HomeProject):Promise<void>{assertProject(p);await this.write('projects',JSON.parse(serializeProject(p)));}
  async delete(id:string):Promise<void>{
    const db=await this.db();await new Promise<void>((resolve,reject)=>{const tx=db.transaction(['projects','assets'],'readwrite');tx.objectStore('projects').delete(id);const cursor=tx.objectStore('assets').openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){if((c.value as StoredAsset).projectId===id)c.delete();c.continue();}};tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);});
  }
  saveAsset(asset:StoredAsset):Promise<void>{return this.write('assets',asset);}
  getAsset(id:string):Promise<StoredAsset|undefined>{return this.read('assets',id);}
  async listAssets(projectId:string):Promise<StoredAsset[]>{return (await this.read<StoredAsset[]>('assets')).filter(a=>a.projectId===projectId);}
  async getPreference<T>(key:string):Promise<T|undefined>{return (await this.read<{value:T}|undefined>('preferences',key))?.value;}
  setPreference(key:string,value:unknown):Promise<void>{return this.write('preferences',{id:key,value});}
}
