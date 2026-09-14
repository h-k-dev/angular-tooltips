import { Component } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';

import { HkJsTooltip } from '../../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'app-any-element-card',
  imports: [MatIconModule, HkJsTooltip],
  templateUrl: './any-element-card.html',
  styleUrl: './any-element-card.scss',
  host: { class: 'test-card full-width-card' },
})
export class AnyElementCard {}
