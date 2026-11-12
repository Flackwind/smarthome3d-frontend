import { assertProject, HomeProject, migrateProject, serializeProject } from '@sh3d/home-model';
import { BackendClient } from './backend-client';
import { ProjectRepository, StoredAsset } from './project.repository';
interface RemoteDocument { project:HomeProject;revision:number }
interface AssetInfo {id:string;projectId:string;name:string;mediaType:string;size:number}

export class HttpProjectRepository implements ProjectRepository {
  private readonly revisions=new Map<string,string>();
  constructor(readonly client:BackendClient,private readonly preferences:ProjectRepository){}
  async list():Promise<HomeProject[]>{
    const documents=await (await this.client.request('/projects')).json() as RemoteDocument[];
    return documents.map(d=>{const project=migrateProject(d.project);if(!Number.isInteger(d.revision)||d.revision<1)throw new Error('Revisione server non valida');if(!this.revisions.has(project.id))this.revisions.set(project.id,'"'+d.revision+'"');return project;}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  }
  async get(id:string):Promise<HomeProject|undefined>{const response=await this.client.request('/projects/'+encodeURIComponent(id),{},true);if(response.status===404)return undefined;const p=migrateProject(await response.json());this.remember(id,response);return p;}
  async save(project:HomeProject):Promise<void>{
    assertProject(project);const revision=this.revisions.get(project.id),headers:Record<string,string>={'Content-Type':'application/json'};
    if(revision)headers['If-Match']=revision;else headers['If-None-Match']='*';
    const response=await this.client.request('/projects/'+encodeURIComponent(project.id),{method:'PUT',headers,body:serializeProject(project)});this.remember(project.id,response);
  }
  async delete(id:string):Promise<void>{const revision=this.revisions.get(id);if(!revision)throw new Error('Riapri il progetto prima di eliminarlo');await this.client.request('/projects/'+encodeURIComponent(id),{method:'DELETE',headers:{'If-Match':revision}});this.revisions.delete(id);}
  async saveAsset(asset:StoredAsset):Promise<void>{const data=new FormData();data.append('file',asset.blob,asset.name);await this.client.request('/projects/'+encodeURIComponent(asset.projectId)+'/assets/'+encodeURIComponent(asset.id),{method:'PUT',body:data});}
  async getAsset(id:string):Promise<StoredAsset|undefined>{const response=await this.client.request('/assets/'+encodeURIComponent(id),{},true);if(response.status===404)return undefined;return {id,projectId:response.headers.get('X-Project-Id')??'',name:decodeURIComponent(response.headers.get('X-Asset-Name')??id),blob:await response.blob()};}
  async listAssets(projectId:string):Promise<StoredAsset[]>{const infos=await (await this.client.request('/projects/'+encodeURIComponent(projectId)+'/assets')).json() as AssetInfo[],assets:StoredAsset[]=[];for(const info of infos){const asset=await this.getAsset(info.id);if(!asset)throw new Error('Un file è stato eliminato durante la lettura');assets.push(asset);}return assets;}
  async getPreference<T>(key:string):Promise<T|undefined>{
    if(key!=='activeProject')return this.preferences.getPreference<T>(key);
    const profile=await (await this.client.request('/profile')).json() as {activeProject?:unknown};
    if(typeof profile.activeProject!=='string')throw new Error('Il server non espone il profilo proprietario aggiornato');
    return (profile.activeProject||undefined) as T|undefined;
  }
  async setPreference(key:string,value:unknown):Promise<void>{
    if(key!=='activeProject')return this.preferences.setPreference(key,value);
    if(typeof value!=='string'||!value)throw new Error('Progetto attivo non valido');
    await this.client.request('/profile/active-project',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectId:value})});
  }
  async importLocal(project:HomeProject,assets:StoredAsset[]):Promise<HomeProject>{
    const data=new FormData();data.append('project',new Blob([serializeProject(project)],{type:'application/json'}));data.append('assets',new Blob([JSON.stringify(assets.map(a=>({id:a.id,name:a.name,mediaType:a.blob.type||'application/octet-stream'})))],{type:'application/json'}));for(const a of assets)data.append('files',a.blob,a.id);
    return this.imported(await (await this.client.request('/imports',{method:'POST',body:data})).json() as RemoteDocument);
  }
  /** One initial transfer per local house and server URL. Never overwrites an existing server copy. */
  async importLocalOnce(project:HomeProject,assets:StoredAsset[]):Promise<HomeProject|undefined>{
    const key='server-imports-v1:'+this.client.url;
    const saved=await this.preferences.getPreference<Record<string,string>>(key);
    const copies=saved&&typeof saved==='object'&&!Array.isArray(saved)?saved:{};
    const id=Object.hasOwn(copies,project.id)?copies[project.id]:undefined;
    if(typeof id==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(id)){
      // An existence check must not adopt an unseen ETag for an already open house.
      const response=await this.client.request('/projects/'+encodeURIComponent(id),{},true);
      if(response.status!==404){const existing=migrateProject(await response.json());if(existing.id!==id)throw new Error('Copia server non valida');return undefined;}
    }
    const imported=await this.importLocal(project,assets);
    await this.preferences.setPreference(key,{...copies,[project.id]:imported.id});return imported;
  }
  async backup(id:string):Promise<Blob>{return (await this.client.request('/projects/'+encodeURIComponent(id)+'/backup')).blob();}
  async restore(file:File):Promise<HomeProject>{const data=new FormData();data.append('file',file);return this.imported(await (await this.client.request('/backups/restore',{method:'POST',body:data})).json() as RemoteDocument);}
  private imported(data:RemoteDocument):HomeProject{const project=migrateProject(data.project);this.revisions.set(project.id,'"'+data.revision+'"');return project;}
  private remember(id:string,response:Response):void{const tag=response.headers.get('ETag');if(!tag||!/^"[1-9]\d*"$/.test(tag))throw new Error('Il server non ha restituito la revisione del progetto');this.revisions.set(id,tag);}
}
