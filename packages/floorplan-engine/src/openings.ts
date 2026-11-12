import type { DetectedOpening, DetectedWall, DetectionOptions } from './index';

export function openingProposals(walls:DetectedWall[],ink:Uint8Array,width:number,height:number,options:DetectionOptions):DetectedOpening[]{
  const proposals:DetectedOpening[]=[];
  for(const wall of walls){const length=Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y),dx=(wall.end.x-wall.start.x)/length,dy=(wall.end.y-wall.start.y)/length;
    const samples=Math.max(2,Math.ceil(wall.thickness)),density:number[]=[];
    for(let t=0;t<=Math.floor(length);t++){let count=0;for(let k=0;k<samples;k++){const normal=(k/(samples-1)-.5)*Math.max(1,wall.thickness-1),x=Math.round(wall.start.x+dx*t-dy*normal),y=Math.round(wall.start.y+dy*t+dx*normal);if(x>=0&&x<width&&y>=0&&y<height)count+=ink[y*width+x];}density.push(count/samples);}
    let start=-1;
    for(let t=0;t<density.length;t++){
      if(density[t]<.6){if(start<0)start=t;continue;}
      if(start>=0){const size=t-start;
        if(start>=8&&t<=length-8&&size>=12&&size<=(options.openingMaxGap??100)){
          const average=density.slice(start,t).reduce((a,b)=>a+b,0)/size;
          proposals.push({id:proposals.length,wallId:wall.id,offset:start,width:size,type:average>.12?'window':'door'});
        }start=-1;
      }
    }
  }
  return proposals;
}

/** Rejoin collinear fragments only when opening recognition is requested. */
export function bridgeOpeningGaps(walls:DetectedWall[],maximum:number,tolerance:number):void {
  let changed=true;
  while(changed){changed=false;
    outer:for(let i=0;i<walls.length;i++)for(let j=i+1;j<walls.length;j++){
      const a=walls[i],b=walls[j],length=Math.hypot(a.end.x-a.start.x,a.end.y-a.start.y),dx=(a.end.x-a.start.x)/length,dy=(a.end.y-a.start.y)/length,otherLength=Math.hypot(b.end.x-b.start.x,b.end.y-b.start.y);
      if(Math.abs(dx*(b.end.y-b.start.y)-dy*(b.end.x-b.start.x))/otherLength>.025||Math.abs(a.thickness-b.thickness)>Math.max(3,a.thickness*.5))continue;
      const offset=(p:{x:number;y:number})=>(p.x-a.start.x)*dx+(p.y-a.start.y)*dy;
      if([b.start,b.end].some(p=>Math.abs((p.x-a.start.x)*dy-(p.y-a.start.y)*dx)>Math.min(tolerance,Math.max(2,a.thickness/2))))continue;
      const low=Math.min(offset(b.start),offset(b.end)),high=Math.max(offset(b.start),offset(b.end)),gap=low>length?low-length:high<0?-high:0;
      if(gap<1||gap>maximum)continue;
      const start={x:a.start.x+Math.min(0,low)*dx,y:a.start.y+Math.min(0,low)*dy};
      a.end={x:a.start.x+Math.max(length,high)*dx,y:a.start.y+Math.max(length,high)*dy};a.start=start;walls.splice(j,1);changed=true;break outer;
    }
  }
}
