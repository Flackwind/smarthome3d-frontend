import { ENGLISH } from './catalog';
export type Language='it'|'en';
export function translate(text:string,language:Language):string {
  if(language==='it')return text;
  const leading=text.match(/^\s*/)?.[0]??'',trailing=text.match(/\s*$/)?.[0]??'',key=text.trim();
  if(ENGLISH[text]!==undefined)return ENGLISH[text];
  if(ENGLISH[key]!==undefined)return leading+ENGLISH[key]+trailing;
  if(key.includes(' · ')){
    const parts=key.split(' · ');
    if(parts.every(part=>ENGLISH[part]!==undefined))return leading+parts.map(part=>ENGLISH[part]).join(' · ')+trailing;
  }
  return text;
}
export function savedLanguage(value:unknown):Language{return value==='en'?'en':'it';}
