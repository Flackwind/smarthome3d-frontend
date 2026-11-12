import { TranslatePipe } from './core/i18n/translate.pipe';
import { FormsModule } from '@angular/forms';
import { I18nService } from './core/i18n/i18n.service';
import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ProjectStore } from './core/configuration/project.store';
import { DeviceStore } from './core/providers/device.store';
import { SetupWizardComponent } from './features/setup-wizard/setup-wizard.component';
import { PwaService } from './core/configuration/pwa.service';
@Component({selector:'sh3d-app',standalone:true,imports:[TranslatePipe,FormsModule,RouterOutlet,RouterLink,RouterLinkActive,SetupWizardComponent],template:`
  <div class="app-shell">
    <nav class="rail" [attr.aria-label]="'Navigazione principale'|t">
      <a routerLink="/" class="brand" aria-label="Smart Home 3D"><span class="brand-mark">⌂</span><span>smart home<span class="brand-sub">3D WORKSPACE</span></span></a>
      <div class="nav-links"><a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}"><span>◈</span> Dashboard</a><a routerLink="/editor" routerLinkActive="active"><span>▱</span>  {{'Editor casa'|t}}</a><a routerLink="/devices" routerLinkActive="active"><span>⊙</span>  {{'Dispositivi'|t}}</a><a routerLink="/energy" routerLinkActive="active"><span>ϟ</span>  {{'Consumi'|t}}</a></div>
      <div class="rail-bottom"><div class="local-badge"><span class="status-dot"></span>  {{'Locale, per scelta'|t}}<span>{{'I tuoi spazi. I tuoi dati.'|t}}</span></div><a routerLink="/settings" routerLinkActive="active"><span>⚙</span>  {{'Impostazioni'|t}}</a><div class="workspace-label">SMART HOME 3D <span>v0.1 · MVP</span></div></div>
    </nav>
    <div class="main-shell"><header class="topbar"><div><span class="eyebrow">{{'IL TUO SPAZIO, CONNESSO'|t}}</span><div class="project-heading">{{store.hasProject()?store.project().name:('Nessuna casa aperta'|t)}}@if(store.hasProject()){<span class="tag">{{store.floor().name}}</span>}<span class="tag storage-location">{{store.repository.mode()==='server'?('Archivio server'|t):('Archivio locale'|t)}}</span></div></div><div class="topbar-actions"><label class="language-picker"><span class="sr-only">{{'Lingua'|t}}</span><select [attr.aria-label]="'Lingua'|t" [ngModel]="i18n.language()" (ngModelChange)="i18n.choose($event)"><option value="it">Italiano</option><option value="en">English</option></select></label><span class="connection-pill" [class.offline]="devices.status()!=='connected'"><i class="status-dot"></i>{{devices.providerId()==='mock'?('Modalità demo'|t):'Home Assistant'}}<span class="connection-detail"> · {{devices.status()==='connected'?('connesso'|t):(devices.status()|t)}}</span></span><button class="icon-button" [title]="'Cambia tema'|t" [attr.aria-label]="'Cambia tema'|t" (click)="toggleTheme()">◐</button><button class="button quiet save-button" [disabled]="!store.hasProject()||!store.ready()||store.repository.serverPending()" (click)="store.save()">{{store.saving()?('Salvataggio…'|t):store.saved()?('✓ Salvato'|t):('Salva progetto'|t)}}</button></div></header>
    <main>@if(store.repository.serverPending()){<div class="archive-pending" role="status"><div><strong>{{'Riapri la tua casa sul server'|t}}</strong><p>{{'Accedi al profilo per ritrovare progetti, associazioni e collegamento Home Assistant. Il backup non serve per riaprire una casa già salvata.'|t}}</p></div><a class="button primary" routerLink="/settings">{{'Accedi al server'|t}}</a></div>}<router-outlet /></main></div>
    @if(store.message()){<div class="toast" role="status">{{(store.message()|t)}}<button [attr.aria-label]="'Chiudi messaggio'|t" (click)="store.message.set('')">×</button></div>}
    @if(devices.error()){<div class="error-banner" role="alert">{{(devices.error()|t)}}<button (click)="devices.error.set('')" [attr.aria-label]="'Chiudi errore'|t">×</button></div>}
    @if(store.ready()&&store.setupOpen()){<sh3d-setup />}
  </div>
`,styles:[`.archive-pending{margin:20px 28px 0;padding:18px;border:1px solid var(--accent);border-radius:12px;background:var(--panel);display:flex;align-items:center;gap:20px;flex-wrap:wrap}.archive-pending>div{flex:1;min-width:180px}.archive-pending strong{font-size:14px}.archive-pending p{font-size:12px;line-height:1.6;margin:7px 0 0;color:var(--muted)}@media(max-width:600px){.archive-pending{margin:16px 16px 0}.archive-pending .button{width:100%;text-align:center}}`]})
export class AppComponent {readonly i18n=inject(I18nService);readonly store=inject(ProjectStore);readonly devices=inject(DeviceStore);readonly pwa=inject(PwaService);toggleTheme():void{this.store.change(p=>p.scene.theme=p.scene.theme==='dark'?'light':'dark');}}
