import { Component } from '@angular/core';

import { JSTooltips } from '../../../../../angular-tooltips/src/public-api';
import { UserCard } from '../../user-card/user-card';

@Component({
  selector: 'app-js-playground-card',
  imports: [JSTooltips, UserCard],
  templateUrl: './js-playground-card.html',
  styleUrl: './js-playground-card.scss',
  host: { class: 'test-card full-width-card' },
})
export class JsPlaygroundCard {}
