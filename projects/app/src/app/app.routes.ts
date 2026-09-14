import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Angular Tooltips',
    loadComponent: () =>
      import('./pages/tooltips-page/tooltips-page').then((m) => m.TooltipsPage),
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
    path: 'theming',
    title: 'Angular Tooltips — Theming',
    loadComponent: () =>
      import('./pages/theming-page/theming-page').then((m) => m.ThemingPage),
  },
  {
    path: 'api',
    title: 'Angular Tooltips — API',
    loadComponent: () => import('./pages/api-page/api-page').then((m) => m.ApiPage),
  },
  {
    path: 'inspiration',
    title: 'Angular Tooltips — Inspiration',
    loadComponent: () =>
      import('./pages/inspiration-page/inspiration-page').then((m) => m.InspirationPage),
  },
  // Old demo URLs.
  { path: 'both', redirectTo: '' },
  { path: 'examples', redirectTo: '' },
  { path: 'anchor-tooltips', redirectTo: 'invoker' },
];
