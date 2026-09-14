import { Component, DOCUMENT, afterNextRender, inject, signal, DestroyRef } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DenseGridCard } from '../../cards/dense-grid-card/dense-grid-card';
import { EngineHandoffCard } from '../../cards/engine-handoff-card/engine-handoff-card';
import { PlacementsCard } from '../../cards/placements-card/placements-card';
import { RichContentCard } from '../../cards/rich-content-card/rich-content-card';

/** The "reading line": a card whose box crosses this y is the active one. */
const READING_LINE = 140;

@Component({
  selector: 'app-tooltips-page',
  imports: [RouterLink, EngineHandoffCard, DenseGridCard, PlacementsCard, RichContentCard],
  templateUrl: './tooltips-page.html',
  styleUrl: './tooltips-page.scss',
  host: {
    '(window:scroll)': 'onScroll()',
  },
})
export class TooltipsPage {
  readonly #doc = inject(DOCUMENT);

  // Floating fragment nav on the right, scoped to this page's cards.
  protected readonly fragments = [
    { fragment: 'handoff', label: 'Engine handoff' },
    { fragment: 'dense-grid', label: 'Dense grid' },
    { fragment: 'placements', label: 'Placements' },
    { fragment: 'rich-content', label: 'Rich content' },
  ];

  /** Collapsed = only the active fragment stays visible (scrolling down). */
  protected readonly collapsed = signal(false);

  /** Scrollspy: the fragment of the card currently under the reading line. */
  protected readonly activeFragment = signal<string>(this.fragments[0].fragment);

  #lastY = 0;

  constructor() {
    // Scrollspy without layout reads on scroll: an IntersectionObserver
    // whose root is a one-pixel band at the reading line reports the card
    // crossing it — the browser does the geometry off the main thread.
    // The band depends on the viewport height, so it is rebuilt on resize.
    const win = this.#doc.defaultView;
    if (!win || !('IntersectionObserver' in win)) return;
    let observer: IntersectionObserver | null = null;
    const observe = () => {
      observer?.disconnect();
      observer = new IntersectionObserver(
        (entries) => {
          const hit = entries.find((entry) => entry.isIntersecting);
          if (hit) this.activeFragment.set(hit.target.id);
        },
        { rootMargin: `-${READING_LINE}px 0px -${Math.max(win.innerHeight - READING_LINE - 1, 0)}px 0px` },
      );
      for (const { fragment } of this.fragments) {
        const el = this.#doc.getElementById(fragment);
        if (el) observer.observe(el);
      }
    };
    afterNextRender(observe);
    win.addEventListener('resize', observe, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
      win.removeEventListener('resize', observe);
    });
  }

  /** Scroll direction only — no layout reads here. */
  protected onScroll(): void {
    const y = this.#doc.defaultView?.scrollY ?? 0;
    // Small hysteresis so pixel jitter doesn't flip the state; near the
    // top the nav is always expanded.
    if (y <= 120 || y < this.#lastY - 4) this.collapsed.set(false);
    else if (y > this.#lastY + 4) this.collapsed.set(true);
    this.#lastY = y;
  }
}
