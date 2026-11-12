import { Routes } from '@angular/router';
export const routes:Routes=[
  {path:'',loadComponent:()=>import('./features/dashboard/dashboard.component').then(m=>m.DashboardComponent)},
  {path:'editor',loadComponent:()=>import('./features/floorplan-editor/editor.component').then(m=>m.EditorComponent)},
  {path:'devices',loadComponent:()=>import('./features/devices/devices.component').then(m=>m.DevicesComponent)},
  {path:'energy',loadComponent:()=>import('./features/energy/energy.component').then(m=>m.EnergyComponent)},
  {path:'settings',loadComponent:()=>import('./features/settings/settings.component').then(m=>m.SettingsComponent)},
  {path:'**',redirectTo:''}
];
