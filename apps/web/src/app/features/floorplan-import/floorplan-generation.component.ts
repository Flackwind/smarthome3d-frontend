import { TranslatePipe } from '../../core/i18n/translate.pipe';
import { AfterViewInit, Component, computed, ElementRef, inject, input, OnDestroy, output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Floor, FloorplanReference } from '@sh3d/home-model';
import { DEFAULT_DETECTION, DetectedOpening, DetectionResult, generateFloor } from '@sh3d/floorplan-engine';
import { FloorplanGenerationService } from './floorplan-generation.service';

@Component({selector:'sh3d-plan-generation',standalone:true,imports:[TranslatePipe,FormsModule],providers:[FloorplanGenerationService],template:`
<dialog #dialog aria-labelledby="generation-title" (cancel)="cancel($event)">
  <header><div><div class="eyebrow">{{'DALLA PIANTA ALLA CASA'|t}}</div><h1 id="generation-title">{{'Genera il modello 3D'|t}}</h1><p>{{'Analisi locale · anteprima modificabile · piano originale conservato'|t}}</p></div><button [attr.aria-label]="'Chiudi generazione'|t" (click)="closed.emit()">×</button></header>
  <div class="generation-layout"><div class="preview">
    <svg [attr.viewBox]="'0 0 '+reference().width+' '+reference().height" role="img" [attr.aria-label]="'Anteprima dei muri rilevati'|t">
      <image [attr.href]="reference().dataUrl" [attr.width]="reference().width" [attr.height]="reference().height" opacity=".65"/>
      @for(wall of result()?.walls??[];track wall.id){<line class="detected-wall" [class.excluded]="excluded().has(wall.id)" [attr.x1]="wall.start.x" [attr.y1]="wall.start.y" [attr.x2]="wall.end.x" [attr.y2]="wall.end.y" [attr.stroke-width]="Math.max(wall.thickness,reference().width/160)" (click)="toggle(wall.id)"><title>{{'Tratto'|t}} {{wall.id+1}} {{'· clic per'|t}} {{excluded().has(wall.id)?'includere':'escludere'}}</title></line>}
      @for(opening of openingPreview();track opening.id){<line class="detected-opening" [class.confirmed]="accepted().has(opening.id)" [attr.x1]="opening.start.x" [attr.y1]="opening.start.y" [attr.x2]="opening.end.x" [attr.y2]="opening.end.y" [attr.stroke-width]="Math.max(opening.thickness+3,reference().width/100)"><title>{{'Apertura'|t}} {{opening.id+1}} · {{accepted().has(opening.id)?'confermata':('da verificare'|t)}}</title></line>}
    </svg>
    <div class="preview-caption"><span class="legend"></span>  {{'Muri proposti'|t}} <span class="legend off"></span>  {{'Esclusi · tocca un tratto per cambiarlo'|t}}</div>
    @if(busy()){<div class="analyzing" role="status">{{'Riconoscimento dei muri in corso…'|t}}</div>}
  </div><div class="generation-settings">
    <fieldset [disabled]="busy()"><legend>{{'1. Rileva i muri'|t}}</legend>
      <label class="field">{{'Soglia del disegno ·'|t}} {{options.threshold}}<input [attr.aria-label]="'Soglia riconoscimento'|t" type="range" min="40" max="230" step="5" [(ngModel)]="options.threshold"></label>
      <label class="field">{{'Lunghezza minima (pixel di analisi)'|t}}<input [attr.aria-label]="'Lunghezza minima riconoscimento'|t" type="number" min="12" max="800" step="5" [(ngModel)]="options.minLength"></label>
      <div class="field-row"><label class="field">{{'Spessore minimo (px)'|t}}<input [attr.aria-label]="'Spessore minimo riconoscimento'|t" type="number" min="1" max="30" [(ngModel)]="options.minThickness"></label><label class="field">{{'Chiudi vuoti (px)'|t}}<input [attr.aria-label]="'Chiusura vuoti'|t" type="number" min="0" max="100" [(ngModel)]="options.gap"></label></div>
      <label class="field">{{'Unisci linee parallele entro (px)'|t}}<input [attr.aria-label]="'Unione linee parallele'|t" type="number" min="0" max="50" [(ngModel)]="options.mergeDistance"></label>
      <label class="check"><input type="checkbox" [(ngModel)]="options.oblique">{{'Rileva pareti oblique'|t}}</label>
      <label class="check"><input type="checkbox" [(ngModel)]="options.openings">{{'Proponi porte e finestre'|t}}</label>
      <label class="field">{{'Apertura massima (px)'|t}}<input [attr.aria-label]="'Apertura massima riconoscimento'|t" type="number" min="12" max="300" [(ngModel)]="options.openingMaxGap"></label>
      <button class="button primary" (click)="analyze()">{{result()?('Ricalcola anteprima'|t):('Analizza planimetria'|t)}}</button>
    </fieldset>
    <div class="divider"></div><h2>{{'2. Verifica la scala'|t}}</h2>
    <p class="small">{{'La scala iniziale è indicativa. Per misure reali usa “Calibra con due punti” nell’editor, oppure indica qui la larghezza dell’intero foglio.'|t}}</p>
    <label class="field">{{'Larghezza totale del foglio (m)'|t}}<input [attr.aria-label]="'Larghezza foglio in metri'|t" type="number" min="0.1" max="1000" step="0.1" [ngModel]="sheetWidth()" (ngModelChange)="sheetWidth.set(+$event);scaleConfirmed.set(false)"></label>
    <label class="check"><input [attr.aria-label]="'Conferma scala verificata'|t" type="checkbox" [ngModel]="scaleConfirmed()" (ngModelChange)="scaleConfirmed.set($event)">{{'Ho verificato questa scala'|t}}</label>
    @if(result();as detected){<div class="summary" role="status"><strong>{{included().length}} {{'tratti ·'|t}} {{confirmedOpenings().length}} {{'aperture ·'|t}} {{proposal().floor?.rooms?.length??0}} {{'stanze chiuse'|t}}</strong><p>{{'Il nuovo piano sarà modificabile nell’editor. Porte, finestre, nomi e arredi vanno verificati e completati.'|t}}</p></div>
      @if(detected.openings.length){<h2 class="opening-heading">{{'Verifica le aperture'|t}}</h2><p class="small">{{'Conferma solo i vuoti reali e correggi il tipo proposto. Le aperture non confermate diventano muro pieno; misure e quota sono modificabili nell’editor.'|t}}</p><div class="opening-list">@for(opening of detected.openings;track opening.id){@if(!excluded().has(opening.wallId)){<div class="opening-row"><label class="check"><input type="checkbox" [attr.aria-label]="('Conferma apertura '|t)+(opening.id+1)" [checked]="accepted().has(opening.id)" (change)="accept(opening.id,$any($event.target).checked)">{{'Apertura'|t}} {{opening.id+1}} {{'· muro'|t}} {{opening.wallId+1}}</label><select [attr.aria-label]="('Tipo apertura '|t)+(opening.id+1)" [ngModel]="types()[opening.id]??opening.type" (ngModelChange)="setType(opening.id,$event)"><option value="door">{{'Porta'|t}}</option><option value="window">{{'Finestra'|t}}</option></select><span class="small">{{(opening.width*sheetWidth()/reference().width).toFixed(2)}} m</span></div>}}</div>}
      <details><summary>{{'Limiti e dettagli dell’analisi'|t}}</summary>@for(warning of detected.warnings;track warning){<p class="small">{{warning}}</p>}<div class="detected-list">@for(wall of detected.walls;track wall.id){<label class="check"><input type="checkbox" [checked]="!excluded().has(wall.id)" (change)="toggle(wall.id)">{{'Tratto'|t}} {{wall.id+1}}</label>}</div></details>}
    @if(error()||proposal().error){<p class="generation-error" role="alert">{{error()||proposal().error}}</p>}
  </div></div>
  <footer><p>{{'Si aggiunge un nuovo piano. Puoi annullare la generazione con Ctrl+Z.'|t}}</p><div class="actions"><button class="button quiet" (click)="closed.emit()">{{'Annulla'|t}}</button><button class="button primary" [disabled]="busy()||!scaleConfirmed()||!proposal().floor" (click)="apply()">{{'Crea piano e modello 3D'|t}}</button></div></footer>
</dialog>`,styles:[`
dialog{width:min(1120px,calc(100vw - 24px));max-height:92dvh;margin:auto;padding:0;color:var(--text);background:var(--panel);border:1px solid var(--border);border-radius:22px;box-shadow:0 24px 100px #0006}dialog::backdrop{background:#101617b8;backdrop-filter:blur(6px)}header{display:flex;justify-content:space-between;align-items:start;padding:25px 28px;border-bottom:1px solid var(--border)}header .eyebrow{margin-bottom:10px}header h1{font-size:25px}header p{font-size:11px;margin:0}header button{font-size:23px;background:transparent;border:0;padding:0 8px}.generation-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px}.preview{position:relative;min-height:440px;background:#f0f1f5;display:flex;align-items:center;justify-content:center;flex-direction:column;padding:25px}.preview svg{width:100%;height:100%;max-height:510px;min-height:350px;background:#fff;border-radius:10px}.detected-wall{stroke:#278765;stroke-linecap:round;cursor:pointer;opacity:.85}.detected-opening{stroke:#c98226;stroke-dasharray:5 3;pointer-events:none}.detected-opening.confirmed{stroke:#3989c8;stroke-dasharray:none}.opening-heading{margin-top:20px}.opening-list{display:grid;gap:12px}.opening-row{display:grid;grid-template-columns:1fr auto;gap:8px;padding:12px 0;border-bottom:1px solid var(--border)}.opening-row select{max-width:110px}.detected-wall.excluded{stroke:#d96e70;stroke-dasharray:8 5;opacity:.55}.preview-caption{display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;font-size:10px;color:#52616a;padding-top:17px;line-height:1.5}.legend{width:16px;height:4px;background:#278765;display:inline-block;margin-left:8px}.legend.off{background:#d96e70}.generation-settings{padding:24px;max-height:65dvh;overflow:auto}.generation-settings h2,legend{font-size:14px;font-weight:600;margin-bottom:16px}fieldset{border:0;padding:0;margin:0;min-width:0}fieldset>.button{width:100%}legend{padding:0}.generation-settings .field{margin-bottom:14px}.generation-settings .field-row{gap:10px}.generation-settings .check{align-items:start;line-height:1.5}.summary{background:var(--panel-raised);padding:15px;border-radius:12px;margin-top:20px}.summary strong{font-size:13px}.summary p{font-size:11px;margin:8px 0 0}details{margin-top:17px;font-size:11px;color:var(--muted)}summary{cursor:pointer;margin-bottom:10px}.detected-list{display:grid;grid-template-columns:1fr 1fr;gap:7px;max-height:140px;overflow:auto}.generation-error{font-size:12px;color:var(--danger);margin-top:15px}footer{border-top:1px solid var(--border);padding:20px 26px;display:flex;justify-content:space-between;align-items:center;gap:15px}footer p{font-size:10px;max-width:260px;margin:0}.analyzing{position:absolute;inset:0;display:grid;place-items:center;background:#f0f1f5db;color:#24664e;font-size:14px}@media(max-width:760px){header{padding:20px}.generation-layout{grid-template-columns:1fr}.preview{min-height:230px;padding:16px}.preview svg{min-height:200px;max-height:300px}.generation-settings{max-height:none;padding:20px}footer{align-items:stretch;flex-direction:column;padding:20px}footer .actions{justify-content:flex-end}footer p{max-width:none}.preview-caption{font-size:9px}}
`]})
export class FloorplanGenerationComponent implements AfterViewInit,OnDestroy {
  @ViewChild('dialog',{static:true})dialog!:ElementRef<HTMLDialogElement>;
  readonly reference=input.required<FloorplanReference>();readonly ceiling=input(2.7);readonly elevation=input(0);readonly floorName=input('Piano generato');
  readonly generated=output<Floor>();readonly closed=output<void>();readonly Math=Math;
  readonly service=inject(FloorplanGenerationService);readonly result=signal<DetectionResult|undefined>(undefined);readonly busy=signal(false);readonly error=signal('');readonly excluded=signal(new Set<number>());readonly sheetWidth=signal(10);readonly scaleConfirmed=signal(false);
  readonly accepted=signal(new Set<number>());readonly types=signal<Partial<Record<number,'door'|'window'>>>({});
  readonly confirmedOpenings=computed(()=>this.result()?.openings.filter(o=>this.accepted().has(o.id)&&!this.excluded().has(o.wallId)).map(o=>({...o,type:this.types()[o.id]??o.type}))??[]);
  readonly openingPreview=computed(()=>this.result()?.openings.filter(o=>!this.excluded().has(o.wallId)).map(o=>{const wall=this.result()!.walls.find(w=>w.id===o.wallId)!,length=Math.hypot(wall.end.x-wall.start.x,wall.end.y-wall.start.y),dx=(wall.end.x-wall.start.x)/length,dy=(wall.end.y-wall.start.y)/length;return {...o,thickness:wall.thickness,start:{x:wall.start.x+dx*o.offset,y:wall.start.y+dy*o.offset},end:{x:wall.start.x+dx*(o.offset+o.width),y:wall.start.y+dy*(o.offset+o.width)}};})??[]);
  accept(id:number,checked:boolean):void{this.accepted.update(ids=>{const next=new Set(ids);if(checked)next.add(id);else next.delete(id);return next;});}
  setType(id:number,type:DetectedOpening['type']):void{this.types.update(types=>({...types,[id]:type}));}
  options={...DEFAULT_DETECTION};private abort?:AbortController;
  readonly included=computed(()=>this.result()?.walls.filter(w=>!this.excluded().has(w.id))??[]);
  readonly proposal=computed<{floor?:Floor;error?:string}>(()=>{
    if(!this.included().length)return {};
    try{return {floor:generateFloor(this.included(),{...this.reference(),metersPerPixel:this.sheetWidth()/this.reference().width,calibrated:this.scaleConfirmed()},this.floorName(),this.ceiling(),this.elevation(),this.confirmedOpenings())};}
    catch(error){return {error:error instanceof Error?error.message:'Geometria non valida'};}
  });
  ngAfterViewInit():void{this.sheetWidth.set(Number((this.reference().width*this.reference().metersPerPixel).toPrecision(7)));this.scaleConfirmed.set(this.reference().calibrated??false);this.dialog.nativeElement.showModal();}
  async analyze():Promise<void>{
    if(this.busy())return;this.busy.set(true);this.error.set('');this.result.set(undefined);this.excluded.set(new Set());this.accepted.set(new Set());this.types.set({});this.abort=new AbortController();
    try{this.result.set(await this.service.analyze(this.reference(),{...this.options},this.abort.signal));}
    catch(error){if(!this.abort.signal.aborted)this.error.set(error instanceof Error?error.message:'Analisi non riuscita');}
    finally{this.busy.set(false);}
  }
  toggle(id:number):void{this.excluded.update(previous=>{const next=new Set(previous);if(next.has(id))next.delete(id);else next.add(id);return next;});}
  apply():void{const floor=this.proposal().floor;if(floor&&this.scaleConfirmed()&&!this.busy())this.generated.emit(floor);}
  cancel(event:Event):void{event.preventDefault();this.closed.emit();}
  ngOnDestroy():void{this.abort?.abort();this.dialog.nativeElement.close();}
}
