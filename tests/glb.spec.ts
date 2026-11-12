import { describe,it,expect } from 'vitest';
import { validateEmbeddedGlb } from '@sh3d/geometry-engine';
function glb(json:unknown):ArrayBuffer{const encoded=new TextEncoder().encode(JSON.stringify(json)),length=Math.ceil(encoded.length/4)*4,data=new ArrayBuffer(20+length),v=new DataView(data);v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,data.byteLength,true);v.setUint32(12,length,true);v.setUint32(16,0x4e4f534a,true);new Uint8Array(data,20).fill(32);new Uint8Array(data,20).set(encoded);return data;}
describe('Local GLB validation',()=>{
  it('accepts self-contained glb metadata',()=>expect(()=>validateEmbeddedGlb(glb({asset:{version:'2.0'},scenes:[{}]}))).not.toThrow());
  it('rejects external resources and unavailable compression decoders',()=>{expect(()=>validateEmbeddedGlb(glb({images:[{uri:'https://example.com/private.png'}]}))).toThrow('URL esterni');expect(()=>validateEmbeddedGlb(glb({extensionsRequired:['KHR_draco_mesh_compression']}))).toThrow('compressione');});
  it('rejects truncated or wrong-format assets',()=>{expect(()=>validateEmbeddedGlb(new ArrayBuffer(16))).toThrow('incompleto');expect(()=>validateEmbeddedGlb(new ArrayBuffer(40))).toThrow('valido');});
});
