import { Component, DestroyRef, inject, signal } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';

import { HkJsTooltip, HkTooltip } from '../../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'app-engine-handoff-card',
  imports: [MatButtonModule, HkTooltip, HkJsTooltip],
  templateUrl: './engine-handoff-card.html',
  styleUrl: './engine-handoff-card.scss',
  host: { class: 'test-card full-width-card' },
})
export class EngineHandoffCard {
  protected readonly disabled = signal(false);

  /** Ticks once a second so an OPEN tooltip visibly re-renders in place. */
  protected readonly seconds = signal(0);

  constructor() {
    const timer = setInterval(() => this.seconds.update((n) => n + 1), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
