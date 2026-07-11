import { Component } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';

import { HkTooltip } from '../../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'app-any-element-card',
  imports: [MatIconModule, HkTooltip],
  templateUrl: './any-element-card.html',
  styleUrl: './any-element-card.scss',
  host: { class: 'test-card' },
})
export class AnyElementCard {}
