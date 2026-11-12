import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from './i18n.service';
/** Reads the language signal in the view, so open forms change language without a reload. */
@Pipe({name:'t',standalone:true,pure:false})
export class TranslatePipe implements PipeTransform {
  private readonly i18n=inject(I18nService);
  transform(value:string|null|undefined):string{return this.i18n.t(value??'');}
}
