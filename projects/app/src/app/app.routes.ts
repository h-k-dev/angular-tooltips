import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: 'Angular Tooltips — Home',
    loadComponent: () => import('./pages/home-page/home-page').then((m) => m.HomePage),
  },
  {
    path: 'anchor-tooltips',
    title: 'Angular Tooltips — Anchor Tooltips',
    loadComponent: () =>
      import('./pages/anchor-tooltips-page/anchor-tooltips-page').then(
        (m) => m.AnchorTooltipsPage,
      ),
  },
  {
    path: 'examples',
    title: 'Angular Tooltips — Examples',
    loadComponent: () =>
      import('./pages/examples-page/examples-page').then((m) => m.ExamplesPage),
  },
];
