import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Angular Tooltips — Home',
    loadComponent: () => import('./pages/home-page/home-page').then((m) => m.HomePage),
  },
  {
    path: 'invoker',
    title: 'Angular Tooltips — Invoker',
    loadComponent: () => import('./pages/invoker-page/invoker-page').then((m) => m.InvokerPage),
  },
  {
    path: 'js-anchor',
    title: 'Angular Tooltips — JS Anchor',
    loadComponent: () =>
      import('./pages/js-anchor-page/js-anchor-page').then((m) => m.JsAnchorPage),
  },
  {
    path: 'both',
    title: 'Angular Tooltips — Both',
    loadComponent: () => import('./pages/both-page/both-page').then((m) => m.BothPage),
  },
  // Old demo URLs.
  { path: 'anchor-tooltips', redirectTo: 'invoker' },
  { path: 'examples', redirectTo: 'both' },
];
