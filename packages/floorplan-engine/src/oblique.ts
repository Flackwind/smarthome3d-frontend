import { Point2 } from '@sh3d/home-model';
import type { DetectedWall, DetectionOptions } from './index';

/** Bounded Hough voting on ink outside the already detected orthogonal bands.
 * Coordinates are centred to keep angle/rho suppression stable on large sheets.
 */
export function obliqueWalls(ink:Uint8Array,width:number,height:number,options:DetectionOptions,orthogonal:DetectedWall[]):DetectedWall[]{
  const remaining=ink.slice();
  for(const wall of orthogonal){const pad=wall.thickness/2+2;
    const lowX=Math.max(0,Math.floor(Math.min(wall.start.x,wall.end.x)-pad)),highX=Math.min(width-1,Math.ceil(Math.max(wall.start.x,wall.end.x)+pad));
    const lowY=Math.max(0,Math.floor(Math.min(wall.start.y,wall.end.y)-pad)),highY=Math.min(height-1,Math.ceil(Math.max(wall.start.y,wall.end.y)+pad));
    for(let y=lowY;y<=highY;y++)remaining.fill(0,y*width+lowX,y*width+highX+1);
  }
  const pixels:number[]=[];for(let i=0;i<remaining.length;i++)if(remaining[i])pixels.push(i);
  if(pixels.length<options.minLength*options.minThickness)return [];
  const stride=Math.max(1,Math.ceil(pixels.length/50000)),radius=Math.ceil(Math.hypot(width,height)/2),bins=radius+2;
  const peaks:{angle:number;rho:number;votes:number}[]=[];
  for(let degrees=3;degrees<178;degrees++){
    if(Math.abs(degrees-90)<3)continue;
    const angle=degrees*Math.PI/180,nx=-Math.sin(angle),ny=Math.cos(angle),votes=new Uint32Array(bins);
    for(let j=0;j<pixels.length;j+=stride){const i=pixels[j],x=i%width-width/2,y=Math.floor(i/width)-height/2,index=Math.round((x*nx+y*ny+radius)/2);votes[index]++;}
    for(let i=1;i<bins-1;i++)if(votes[i]>=options.minLength*.8/stride&&votes[i]>=votes[i-1]&&votes[i]>votes[i+1])peaks.push({angle,rho:i*2-radius,votes:votes[i]});
  }
  peaks.sort((a,b)=>b.votes-a.votes);
  const selected:typeof peaks=[];
  for(const peak of peaks){if(selected.some(p=>Math.abs(p.angle-peak.angle)<.0524&&Math.abs(p.rho-peak.rho)<Math.max(6,options.mergeDistance)))continue;selected.push(peak);if(selected.length===120)break;}
  const candidates:DetectedWall[]=[];
  const read=(t:number,rho:number,dx:number,dy:number)=>{const x=Math.round(width/2+dx*t-dy*rho),y=Math.round(height/2+dy*t+dx*rho);return x>=0&&x<width&&y>=0&&y<height?ink[y*width+x]:0;};
  for(const peak of selected){const dx=Math.cos(peak.angle),dy=Math.sin(peak.angle);let start=-Infinity,last=0,count=0;
    const flush=()=>{
      const length=last-start+1;
      if(Number.isFinite(start)&&length>=options.minLength&&count/length>=.75){
        // Median cross section rejects isolated dimension lines and text strokes.
        const widths:number[]=[];
        for(const fraction of [.25,.5,.75]){const t=start+(last-start)*fraction;let low=0,high=0;while(low>-40&&read(t,peak.rho+low-1,dx,dy))low--;while(high<40&&read(t,peak.rho+high+1,dx,dy))high++;widths.push(high-low+1);}
        widths.sort((a,b)=>a-b);const thickness=widths[1];
        if(thickness>=options.minThickness&&thickness<40)candidates.push({id:0,start:{x:width/2+dx*start-dy*peak.rho,y:height/2+dy*start+dx*peak.rho},end:{x:width/2+dx*last-dy*peak.rho,y:height/2+dy*last+dx*peak.rho},thickness});
      }
      start=-Infinity;count=0;
    };
    for(let t=-radius;t<=radius;t++){if(read(t,peak.rho,dx,dy)){if(!Number.isFinite(start))start=t;last=t;count++;}else if(Number.isFinite(start)&&t-last>options.gap)flush();}flush();
  }
  const result:DetectedWall[]=[];
  for(const candidate of candidates.sort((a,b)=>length(b)-length(a))){
    // Refine the discrete Hough angle with principal components of wall ink.
    const originalLength=length(candidate),ux=(candidate.end.x-candidate.start.x)/originalLength,uy=(candidate.end.y-candidate.start.y)/originalLength,points:Point2[]=[];
    for(let j=0;j<pixels.length;j+=stride){const index=pixels[j],x=index%width,y=Math.floor(index/width),along=(x-candidate.start.x)*ux+(y-candidate.start.y)*uy,normal=(x-candidate.start.x)*uy-(y-candidate.start.y)*ux;if(along>=0&&along<=originalLength&&Math.abs(normal)<=Math.max(options.mergeDistance,candidate.thickness))points.push({x,y});}
    if(points.length>=options.minLength/stride){const cx=points.reduce((sum,p)=>sum+p.x,0)/points.length,cy=points.reduce((sum,p)=>sum+p.y,0)/points.length;let xx=0,xy=0,yy=0;
      for(const p of points){xx+=(p.x-cx)**2;xy+=(p.x-cx)*(p.y-cy);yy+=(p.y-cy)**2;}
      const angle=.5*Math.atan2(2*xy,xx-yy),sign=Math.cos(angle)*ux+Math.sin(angle)*uy<0?-1:1,fx=Math.cos(angle)*sign,fy=Math.sin(angle)*sign;
      let low=Infinity,high=-Infinity;for(const p of points){const t=(p.x-cx)*fx+(p.y-cy)*fy;low=Math.min(low,t);high=Math.max(high,t);}
      candidate.start={x:cx+fx*low,y:cy+fy*low};candidate.end={x:cx+fx*high,y:cy+fy*high};
      const normals=points.map(p=>(p.x-cx)*fy-(p.y-cy)*fx).sort((a,b)=>a-b);
      candidate.thickness=Math.max(candidate.thickness,normals[Math.floor((normals.length-1)*.975)]-normals[Math.floor((normals.length-1)*.025)]+1);
    }
    const size=length(candidate),dx=(candidate.end.x-candidate.start.x)/size,dy=(candidate.end.y-candidate.start.y)/size;
    if(result.some(wall=>{const size2=length(wall),wx=(wall.end.x-wall.start.x)/size2,wy=(wall.end.y-wall.start.y)/size2;
      if(Math.abs(dx*wy-dy*wx)>.25)return false;
      const offset=(p:Point2)=>(p.x-candidate.start.x)*dx+(p.y-candidate.start.y)*dy;
      const lo=Math.min(offset(wall.start),offset(wall.end)),hi=Math.max(offset(wall.start),offset(wall.end));
      const tolerance=Math.max(options.mergeDistance,wall.thickness,candidate.thickness)+2;
      return [candidate.start,candidate.end].every(p=>Math.abs((p.x-wall.start.x)*wy-(p.y-wall.start.y)*wx)<=tolerance)&&Math.min(hi,size)-Math.max(lo,0)>.6*Math.min(size,size2);
    }))continue;
    result.push(candidate);
  }
  return result;
}
const length=(wall:DetectedWall)=>Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y);
