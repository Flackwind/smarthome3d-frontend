import 'fake-indexeddb/auto';
import { describe,it,expect } from 'vitest';
import { createDemoProject } from '@sh3d/home-model';
import { IndexedDbProjectRepository } from '../apps/web/src/app/core/persistence/project.repository';
describe('IndexedDB',()=>{
  it('saves, reopens, updates and deletes projects and source assets',async()=>{const name=crypto.randomUUID(),repo=new IndexedDbProjectRepository(name),p=createDemoProject();await repo.save(p);await repo.saveAsset({id:'source',projectId:p.id,name:'plan.png',blob:new Blob(['image'])});await repo.setPreference('activeProject',p.id);const reopened=new IndexedDbProjectRepository(name);expect(await reopened.get(p.id)).toEqual(p);expect(await reopened.getPreference('activeProject')).toBe(p.id);p.name='Casa aggiornata';await reopened.save(p);expect((await repo.list())[0].name).toBe('Casa aggiornata');expect((await repo.getAsset('source'))?.name).toBe('plan.png');await repo.delete(p.id);expect(await repo.list()).toEqual([]);expect(await repo.getAsset('source')).toBeUndefined();});
});
