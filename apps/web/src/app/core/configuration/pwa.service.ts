import { Injectable, signal } from '@angular/core';
interface InstallEvent extends Event {prompt():Promise<void>;userChoice:Promise<{outcome:string}>}
@Injectable({providedIn:'root'})
export class PwaService {
  readonly installAvailable=signal(false);readonly installed=signal(matchMedia('(display-mode: standalone)').matches);private event?:InstallEvent;
  constructor(){window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();this.event=e as InstallEvent;this.installAvailable.set(true);});window.addEventListener('appinstalled',()=>{this.installed.set(true);this.installAvailable.set(false);this.event=undefined;});}
  async install():Promise<void>{if(!this.event)return;await this.event.prompt();await this.event.userChoice;this.event=undefined;this.installAvailable.set(false);}
}
