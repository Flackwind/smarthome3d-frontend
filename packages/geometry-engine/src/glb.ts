/** Accept self-contained GLB 2.0 files; imported assets must not fetch remote resources. */
export function validateEmbeddedGlb(data:ArrayBuffer):void {
  if(data.byteLength>15*1024*1024)throw new Error('GLB troppo grande: massimo 15 MB');
  if(data.byteLength<20)throw new Error('File GLB incompleto');
  const view=new DataView(data);
  if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||view.getUint32(8,true)!==data.byteLength)throw new Error('Usa un file GLB 2.0 valido');
  const length=view.getUint32(12,true);
  if(view.getUint32(16,true)!==0x4e4f534a||length+20>data.byteLength)throw new Error('Metadati GLB non validi');
  const json:unknown=JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,length)).trim());
  const visit=(value:unknown):void=>{
    if(Array.isArray(value)){value.forEach(visit);return;}
    if(!value||typeof value!=='object')return;
    for(const [key,v] of Object.entries(value)){
      if(key==='uri'&&typeof v==='string'&&!/^data:(image\/(png|jpeg)|application\/octet-stream);base64,/.test(v))throw new Error('Il GLB deve contenere tutte le risorse, senza URL esterni');
      if(key==='extensionsRequired'&&Array.isArray(v)&&v.some(e=>['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu'].includes(String(e))))throw new Error('Esporta il GLB senza compressione Draco, Meshopt o KTX2');
      visit(v);
    }
  };visit(json);
}
