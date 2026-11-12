import { bootstrapApplication } from '@angular/platform-browser';
import { provideBrowserGlobalErrorListeners, provideZonelessChangeDetection, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { completeLoginPopup } from './app/core/home-assistant/oauth-popup';
if(['/auth/callback','/auth/server-callback'].includes(location.pathname))completeLoginPopup();
else bootstrapApplication(AppComponent,{providers:[provideZonelessChangeDetection(),provideBrowserGlobalErrorListeners(),provideRouter(routes),provideServiceWorker('ngsw-worker.js',{enabled:!isDevMode(),registrationStrategy:'registerWhenStable:30000'})]}).catch(console.error);
