/// <reference lib="webworker" />
import { detectPlanWalls, DetectionOptions, PlanRaster } from '@sh3d/floorplan-engine';

addEventListener('message',({data}:MessageEvent<{raster:PlanRaster;options:DetectionOptions}>)=>{
  try { postMessage({result:detectPlanWalls(data.raster,data.options)}); }
  catch(error){postMessage({error:error instanceof Error?error.message:'Riconoscimento non riuscito'});}
});
