import { Component } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';

import {
  HkTooltip,
  JSTooltips,
  supportsAnchorPositioning,
} from '../../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'app-inspiration-card',
  imports: [MatIconModule, HkTooltip, JSTooltips],
  templateUrl: './inspiration-card.html',
  styleUrl: './inspiration-card.scss',
  host: { class: 'test-card full-width-card' },
})
export class InspirationCard {
  // This card renders on Home with either engine, so its triggers branch.
  protected readonly anchorSupported = supportsAnchorPositioning();
}
