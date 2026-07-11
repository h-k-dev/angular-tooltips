import { Component, inject, signal, DOCUMENT } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DenseGridCard } from '../../cards/dense-grid-card/dense-grid-card';
import { PlacementsCard } from '../../cards/placements-card/placements-card';
import { RichContentCard } from '../../cards/rich-content-card/rich-content-card';
import { ThemingCard } from '../../cards/theming-card/theming-card';

@Component({
  selector: 'app-examples-page',
  imports: [RouterLink, DenseGridCard, PlacementsCard, RichContentCard, ThemingCard],
  templateUrl: './examples-page.html',
  styleUrl: './examples-page.scss',
  host: {
    '(window:scroll)': 'onScroll()',
  },
})
export class ExamplesPage {
  readonly #doc = inject(DOCUMENT);

  // Floating fragment nav on the right, scoped to this page's cards.
  protected readonly fragments = [
    { fragment: 'dense-grid', label: 'Dense grid' },
    { fragment: 'placements', label: 'Placements' },
    { fragment: 'rich-content', label: 'Rich content' },
    { fragment: 'theming', label: 'Theming' },
  ];

  /** Collapsed = only the active fragment stays visible (scrolling down). */
  protected readonly collapsed = signal(false);

  /** Scrollspy: the fragment of the card currently under the reading line. */
  protected readonly activeFragment = signal<string>(this.fragments[0].fragment);

  #lastY = 0;

  protected onScroll(): void {
    const win = this.#doc.defaultView;
    if (!win) return;
    const y = win.scrollY;

    // Direction with a small hysteresis so pixel jitter doesn't flip the
    // state; near the top the nav is always expanded.
    if (y <= 120 || y < this.#lastY - 4) this.collapsed.set(false);
    else if (y > this.#lastY + 4) this.collapsed.set(true);
    this.#lastY = y;

    // The active card is the last one whose top has passed the reading line.
    let active = this.fragments[0].fragment;
    for (const { fragment } of this.fragments) {
      const el = this.#doc.getElementById(fragment);
      if (el && el.getBoundingClientRect().top <= 140) active = fragment;
    }
    this.activeFragment.set(active);
  }
}
