import { Component } from '@angular/core';

import { InspirationCard } from '../../cards/inspiration-card/inspiration-card';

@Component({
  selector: 'app-home-page',
  imports: [InspirationCard],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {}
