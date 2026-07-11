import { Component } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { HkTooltip } from '../../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'app-placements-card',
  imports: [MatButtonModule, MatIconModule, HkTooltip],
  templateUrl: './placements-card.html',
  styleUrl: './placements-card.scss',
  host: { class: 'test-card' },
})
export class PlacementsCard {}
