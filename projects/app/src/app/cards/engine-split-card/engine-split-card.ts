import { Component } from '@angular/core';

import { supportsAnchorPositioning } from '../../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'app-engine-split-card',
  imports: [],
  templateUrl: './engine-split-card.html',
  styleUrl: './engine-split-card.scss',
  host: { class: 'test-card full-width-card' },
})
export class EngineSplitCard {
  protected readonly anchorSupported = supportsAnchorPositioning();
}
