import { Component } from '@angular/core';

import { InspirationCard } from '../../cards/inspiration-card/inspiration-card';
import { ExampleSource, ExampleSourceFile } from '../../example-source/example-source';

@Component({
  selector: 'app-inspiration-page',
  imports: [InspirationCard, ExampleSource],
  templateUrl: './inspiration-page.html',
  styleUrl: './inspiration-page.scss',
})
export class InspirationPage {
  /** The card's REAL files, copied to `source/` by angular.json. */
  protected readonly files: ExampleSourceFile[] = [
    { label: 'HTML', file: 'inspiration-card.html', lang: 'angular-html' },
    { label: 'SCSS', file: 'inspiration-card.scss', lang: 'scss' },
  ];
}
