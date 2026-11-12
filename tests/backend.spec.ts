import { afterEach,describe,expect,it,vi } from 'vitest';
import { createDemoProject } from '@sh3d/home-model';
import { BackendClient,BackendError,backendUrl,suggestedBackendUrl } from '../apps/web/src/app/core/persistence/backend-client';
import { HttpProjectRepository } from '../apps/web/src/app/core/persistence/http-project.repository';
import { ProjectRepository } from '../apps/web/src/app/core/persistence/project.repository';
const session={authenticated:true,setupRequired:false,username:'test-owner',csrfToken:'test-csrf',homeAssistant:{configured:false,url:'',connected:false}};
const preferences={getPreference:async()=>undefined,setPreference:async()=>{}} as unknown as ProjectRepository;
const response=(body:unknown,status=200,headers:Record<string,string>={})=>new Response(body===undefined?null:JSON.stringify(body),{status,headers:{'Content-Type':'application/json',...headers}});
afterEach(()=>vi.unstubAllGlobals());
describe('Independent backend adapter',()=>{
  it('suggests the HTTPS page origin for a LAN proxy and the separate API port for local HTTP',()=>{
    expect(suggestedBackendUrl('https://192.168.1.30:4200/settings')).toBe('https://192.168.1.30:4200');
    expect(suggestedBackendUrl('https://casa.example/settings')).toBe('https://casa.example');
    expect(suggestedBackendUrl('http://127.0.0.1:4200/settings')).toBe('http://127.0.0.1:8090');
    expect(suggestedBackendUrl('http://[::1]:4200')).toBe('http://[::1]:8090');
    expect(suggestedBackendUrl()).toBe('http://localhost:8090');
  });
  it('distinguishes a CORS rejection from CSRF or session errors without clearing a valid login',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response('Invalid CORS request',{status:403})).mockResolvedValueOnce(response({message:'Sessione o verifica CSRF non valida.'},403)).mockResolvedValueOnce(new Response('<html>private upstream response</html>',{status:502})));
    const client=new BackendClient('https://192.168.1.30:4200'),changed=vi.fn();client.onSession=changed;
    await expect(client.request('/session')).rejects.toMatchObject({status:403,message:expect.stringContaining('SH3D_ORIGINS')});
    await expect(client.request('/session')).rejects.toMatchObject({status:403,message:'Sessione o verifica CSRF non valida.'});
    await expect(client.request('/session')).rejects.toMatchObject({status:502,message:'Richiesta al server non riuscita'});
    expect(changed).not.toHaveBeenCalled();
  });
  it('uses credentialed requests and memory-only CSRF, validates the endpoint and clears expired sessions',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(response(session)).mockResolvedValueOnce(response(undefined,200)).mockResolvedValueOnce(response({...session,csrfToken:'rotated'})).mockResolvedValueOnce(response({message:'Accedi al server'},401));vi.stubGlobal('fetch',fetcher);
    const client=new BackendClient('http://localhost:8090'),changed=vi.fn();client.onSession=changed;
    await client.authenticate('test-owner','test-only-password',false);expect(fetcher.mock.calls[1][0]).toBe('http://localhost:8090/api/v1/auth/login');expect(new Headers(fetcher.mock.calls[1][1].headers).get('X-SH3D-CSRF')).toBe('test-csrf');expect(fetcher.mock.calls[1][1]).toMatchObject({credentials:'include',cache:'no-store',redirect:'error'});
    await expect(client.request('/projects')).rejects.toMatchObject({status:401});expect(changed).toHaveBeenLastCalledWith(undefined);
    expect(()=>backendUrl('https://name:secret@example.com')).toThrow();expect(()=>backendUrl('http://example.com/?token=unsafe')).toThrow();expect(client.socketUrl()).toBe('ws://localhost:8090/api/v1/ha/ws');
  });
  it('uses create/update preconditions and never adopts an unseen revision from a later list',async()=>{
    const project=createDemoProject();let revision=1;const requests:{method:string;headers:Headers;body:unknown}[]=[];
    vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{
      if(url.endsWith('/session'))return response(session);
      if(url.endsWith('/projects'))return response([{project,revision}]);
      requests.push({method:options.method??'GET',headers:new Headers(options.headers),body:options.body});
      if(options.method==='PUT'){if(new Headers(options.headers).get('If-Match')==='"2"'&&revision===3)return response({message:'Conflitto'},412);return response(undefined,200,{ETag:'"2"'});}
      return response(project,200,{ETag:'"1"'});
    }));
    const repo=new HttpProjectRepository(new BackendClient('http://localhost:8090'),preferences);await repo.list();await repo.save(project);expect(requests[0].headers.get('If-Match')).toBe('"1"');revision=3;await repo.list();await expect(repo.save(project)).rejects.toMatchObject({status:412});expect(requests[1].headers.get('If-Match')).toBe('"2"');
  });
  it('creates new IDs only through the import endpoint and preserves local source data',async()=>{
    const original=createDemoProject(),copy=structuredClone(original);copy.id='server-copy';let form:FormData|undefined;
    vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{if(url.endsWith('/session'))return response(session);form=options.body as FormData;return response({project:copy,revision:1});}));
    const repo=new HttpProjectRepository(new BackendClient('http://localhost:8090'),preferences),before=JSON.stringify(original),blob=new Blob(['fake-binary'],{type:'application/pdf'});
    expect((await repo.importLocal(original,[{id:'source',projectId:original.id,name:'Pianta.pdf',blob}])).id).toBe('server-copy');expect(JSON.stringify(original)).toBe(before);expect(form?.getAll('files')).toHaveLength(1);expect(await (form?.get('assets') as Blob).text()).toContain('Pianta.pdf');expect(await (form?.get('project') as Blob).text()).not.toMatch(/password|access_token|refresh_token/);
  });
  it('remembers completed local transfers across reloads without creating copies or adopting an unseen revision',async()=>{
    const original=createDemoProject(),copy={...structuredClone(original),id:'server-copy'};
    const values=new Map<string,unknown>(),local={getPreference:async(key:string)=>values.get(key),setPreference:async(key:string,value:unknown)=>{values.set(key,value);}} as unknown as ProjectRepository;
    let imports=0,exists=true;const writes:Headers[]=[];
    vi.stubGlobal('fetch',vi.fn(async(url:string,options:RequestInit)=>{
      if(url.endsWith('/session'))return response(session);
      if(url.endsWith('/imports')){imports++;return response({project:copy,revision:1});}
      if(options.method==='PUT'){writes.push(new Headers(options.headers));return response(undefined,200,{ETag:'"2"'});}
      return exists?response(copy,200,{ETag:'"99"'}):response({message:'Non trovato'},404);
    }));
    const repo=new HttpProjectRepository(new BackendClient('http://localhost:8090'),local);
    expect((await repo.importLocalOnce(original,[]))?.id).toBe(copy.id);
    expect(await repo.importLocalOnce(original,[])).toBeUndefined();await repo.save(copy);expect(writes[0].get('If-Match')).toBe('"1"');
    const reopened=new HttpProjectRepository(new BackendClient('http://localhost:8090'),local);expect(await reopened.importLocalOnce(original,[])).toBeUndefined();expect(imports).toBe(1);
    exists=false;expect((await reopened.importLocalOnce(original,[]))?.id).toBe(copy.id);expect(imports).toBe(2);
  });
  it('does not repeat a recorded transfer when its server existence check fails',async()=>{
    const original=createDemoProject();let imports=0;
    const local={getPreference:async()=>({[original.id]:'server-copy'}),setPreference:async()=>{}} as unknown as ProjectRepository;
    vi.stubGlobal('fetch',vi.fn(async(url:string)=>{if(url.endsWith('/imports'))imports++;throw new Error('network');}));
    const repo=new HttpProjectRepository(new BackendClient('http://localhost:8090'),local);await expect(repo.importLocalOnce(original,[])).rejects.toBeInstanceOf(BackendError);expect(imports).toBe(0);
  });
  it('distinguishes missing files from connection errors instead of silently switching storage',async()=>{
    const fetcher=vi.fn().mockResolvedValueOnce(response({message:'Non trovato'},404)).mockRejectedValueOnce(new Error('network'));vi.stubGlobal('fetch',fetcher);const repo=new HttpProjectRepository(new BackendClient('http://localhost:8090'),preferences);expect(await repo.getAsset('missing')).toBeUndefined();await expect(repo.getAsset('missing')).rejects.toBeInstanceOf(BackendError);
  });
  it('restores the last house from the owner profile and keeps local preferences separate',async()=>{
    const localRead=vi.fn().mockResolvedValue('local-value'),localWrite=vi.fn(),requests:{path:string;options:RequestInit}[]=[];
    vi.stubGlobal('fetch',vi.fn(async(path:string,options:RequestInit)=>{requests.push({path,options});if(path.endsWith('/session'))return response(session);if(path.endsWith('/profile'))return response({activeProject:'my-server-house'});return response(undefined);}));
    const repo=new HttpProjectRepository(new BackendClient('http://localhost:8090'),{getPreference:localRead,setPreference:localWrite} as unknown as ProjectRepository);
    expect(await repo.getPreference('activeProject')).toBe('my-server-house');expect(localRead).not.toHaveBeenCalled();
    await repo.setPreference('activeProject','another-server-house');const save=requests.find(r=>r.path.endsWith('/profile/active-project'))!;expect(save.options.method).toBe('PUT');expect(JSON.parse(save.options.body as string)).toEqual({projectId:'another-server-house'});expect(new Headers(save.options.headers).get('X-SH3D-CSRF')).toBe('test-csrf');expect(localWrite).not.toHaveBeenCalled();
    expect(await repo.getPreference('ha-url')).toBe('local-value');await repo.setPreference('ha-url','http://ha.test');expect(localWrite).toHaveBeenCalledWith('ha-url','http://ha.test');
    await expect(repo.setPreference('activeProject',{token:'not-accepted'})).rejects.toThrow('Progetto attivo non valido');
  });
});
