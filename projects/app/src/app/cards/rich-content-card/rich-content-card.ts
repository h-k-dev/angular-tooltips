import { Component } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';

import { HkJsTooltip, HkTooltip } from '../../../../../angular-tooltips/src/public-api';
import { UserCard } from '../../user-card/user-card';

@Component({
  selector: 'app-rich-content-card',
  imports: [MatIconModule, HkTooltip, HkJsTooltip, UserCard],
  templateUrl: './rich-content-card.html',
  styleUrl: './rich-content-card.scss',
  host: { class: 'test-card' },
})
export class RichContentCard {}
