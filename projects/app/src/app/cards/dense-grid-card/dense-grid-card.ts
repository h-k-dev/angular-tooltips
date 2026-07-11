import { Component } from '@angular/core';

import { HkTooltip } from '../../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'app-dense-grid-card',
  imports: [HkTooltip],
  templateUrl: './dense-grid-card.html',
  styleUrl: './dense-grid-card.scss',
  host: { class: 'test-card full-width-card' },
})
export class DenseGridCard {
  protected readonly stressCells = Array.from({ length: 100 }, (_, i) => i + 1);
}
