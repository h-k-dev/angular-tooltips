import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { InspirationCard } from '../../cards/inspiration-card/inspiration-card';

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, InspirationCard],
  templateUrl: './home-page.html',
  styleUrl: './home-page.scss',
})
export class HomePage {}
