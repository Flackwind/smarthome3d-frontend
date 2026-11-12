import { Injectable } from '@angular/core';
export interface ImportedPlan { dataUrl:string;width:number;height:number;source:File }
@Injectable({providedIn:'root'})
export class FloorplanImportService {
  async read(file:File):Promise<ImportedPlan>{
    if(file.size>20*1024*1024)throw new Error('File troppo grande: massimo 20 MB');
    if(!file.size)throw new Error('Il file è vuoto');
    const bytes=new Uint8Array(await file.slice(0,8).arrayBuffer());
    const pdf=String.fromCharCode(...bytes.slice(0,5))==='%PDF-',png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71,jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
    if(!pdf&&!png&&!jpeg)throw new Error('Formato non supportato o file non valido. Usa PNG, JPEG o PDF.');
    try{
      if(pdf)return await this.pdf(file);
      const url=URL.createObjectURL(file);
      try{const image=new Image();image.src=url;await image.decode();if(image.naturalWidth*image.naturalHeight>40_000_000)throw new Error('Immagine troppo grande (40 megapixel massimo)');const ratio=Math.min(1,4096/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.round(image.naturalWidth*ratio);canvas.height=Math.round(image.naturalHeight*ratio);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas non disponibile');ctx.drawImage(image,0,0,canvas.width,canvas.height);return {dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,source:file};}finally{URL.revokeObjectURL(url);}
    }catch(e){throw new Error(e instanceof Error?`Importazione non riuscita: ${e.message}`:'Documento non valido');}
  }
  private async pdf(file:File):Promise<ImportedPlan>{
    const pdfjs=await import('pdfjs-dist');pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',document.baseURI).href;
    const task=pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),maxImageSize:16_000_000,useSystemFonts:true,enableXfa:false,wasmUrl:new URL('pdf-wasm/',document.baseURI).href});
    try{const document=await task.promise,page=await document.getPage(1),natural=page.getViewport({scale:1}),scale=Math.min(2,4096/Math.max(natural.width,natural.height)),viewport=page.getViewport({scale}),canvas=window.document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);const ctx=canvas.getContext('2d');if(!ctx)throw new Error('Canvas non disponibile');await page.render({canvas,canvasContext:ctx,viewport}).promise;return {dataUrl:canvas.toDataURL('image/png'),width:canvas.width,height:canvas.height,source:file};}finally{await task.destroy();}
  }
}
