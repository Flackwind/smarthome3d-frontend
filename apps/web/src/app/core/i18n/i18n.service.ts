import { Injectable, effect, signal } from '@angular/core';
import { Language, savedLanguage, translate } from './translation';
@Injectable({providedIn:'root'})
export class I18nService {
  readonly language=signal<Language>(this.read());
  constructor(){effect(()=>{if(typeof document!=='undefined')document.documentElement.lang=this.language();});}
  private read():Language{try{return savedLanguage(localStorage.getItem('sh3d-language'));}catch{return 'it';}}
  choose(value:string):void{const language=savedLanguage(value);this.language.set(language);try{localStorage.setItem('sh3d-language',language);}catch{/* Language still works for this tab. */}}
  t(text:string):string{return translate(text,this.language());}
  locale():string{return this.language()==='it'?'it-IT':'en-GB';}
}
