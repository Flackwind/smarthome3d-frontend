import { Injectable } from '@angular/core';
import { FloorplanReference } from '@sh3d/home-model';
import { detectPlanWalls, DetectionOptions, DetectionResult, PlanRaster } from '@sh3d/floorplan-engine';

@Injectable()
export class FloorplanGenerationService {
  async analyze(reference:FloorplanReference,options:DetectionOptions,signal:AbortSignal):Promise<DetectionResult>{
    const image=new Image();image.src=reference.dataUrl;await image.decode();
    if(signal.aborted)throw new DOMException('Analisi annullata','AbortError');
    const ratio=Math.min(1,1600/Math.max(reference.width,reference.height)),canvas=document.createElement('canvas');
    canvas.width=Math.max(8,Math.round(reference.width*ratio));canvas.height=Math.max(8,Math.round(reference.height*ratio));
    const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('Canvas non disponibile');
    context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);
    const raster:PlanRaster={width:canvas.width,height:canvas.height,data:context.getImageData(0,0,canvas.width,canvas.height).data};
    let result:DetectionResult;
    if(typeof Worker==='undefined'){
      await new Promise<void>(resolve=>setTimeout(resolve,0));
      if(signal.aborted)throw new DOMException('Analisi annullata','AbortError');
      result=detectPlanWalls(raster,options);
    }else{
      result=await new Promise<DetectionResult>((resolve,reject)=>{
        const worker=new Worker(new URL('./floorplan.worker',import.meta.url),{type:'module'});
        const finish=(error?:Error,value?:DetectionResult)=>{clearTimeout(timeout);signal.removeEventListener('abort',abort);worker.terminate();if(error)reject(error);else resolve(value!);};
        const abort=()=>finish(new DOMException('Analisi annullata','AbortError'));
        const timeout=setTimeout(()=>finish(new Error('Analisi troppo lunga. Prova un ritaglio più semplice della pianta.')),20000);
        signal.addEventListener('abort',abort,{once:true});
        worker.onmessage=({data}:MessageEvent<{result?:DetectionResult;error?:string}>)=>finish(data.error?new Error(data.error):undefined,data.result);
        worker.onerror=()=>finish(new Error('Impossibile avviare il riconoscimento locale. Riprova dopo aver aggiornato la pagina.'));
        worker.postMessage({raster,options},[raster.data.buffer]);
      });
    }
    const scaleX=reference.width/canvas.width,scaleY=reference.height/canvas.height;
    const walls=result.walls.map(w=>{const dx=w.end.x-w.start.x,dy=w.end.y-w.start.y,length=Math.hypot(dx,dy),scaledLength=Math.hypot(dx*scaleX,dy*scaleY);return {...w,start:{x:w.start.x*scaleX,y:w.start.y*scaleY},end:{x:w.end.x*scaleX,y:w.end.y*scaleY},thickness:w.thickness*scaleX*scaleY*length/scaledLength};});
    return {...result,walls,openings:result.openings.map(opening=>{const original=result.walls.find(w=>w.id===opening.wallId)!,scaled=walls.find(w=>w.id===opening.wallId)!,factor=Math.hypot(scaled.end.x-scaled.start.x,scaled.end.y-scaled.start.y)/Math.hypot(original.end.x-original.start.x,original.end.y-original.start.y);return {...opening,offset:opening.offset*factor,width:opening.width*factor};})};
  }
}
