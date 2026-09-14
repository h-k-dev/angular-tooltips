import { Component, Injectable, OnDestroy, OnInit, inject, resource, signal } from '@angular/core';

import { HkTooltipCache } from '../../../../angular-tooltips/src/public-api';

/**
 * Page-provided log the probes write into: every ngOnInit / ngOnDestroy of
 * a projected tooltip component lands here, visible on the page — proof
 * that switching triggers runs the full component lifecycle. Newest entry
 * first, so the latest event is always in view.
 */
@Injectable()
export class LifecycleLog {
  readonly entries = signal<string[]>([]);

  push(message: string): void {
    const at = new Date().toLocaleTimeString();
    this.entries.update((list) => [`${at} — ${message}`, ...list]);
  }
}

/** Renders the page's LifecycleLog, newest event on top. */
@Component({
  selector: 'app-lifecycle-log',
  template: `
    <h2>Lifecycle log</h2>
    @if (log.entries().length === 0) {
      <p class="lifecycle-log__empty">Hover a trigger to start.</p>
    } @else {
      <ol reversed>
        @for (entry of log.entries(); track $index) {
          <li>{{ entry }}</li>
        }
      </ol>
    }
  `,
  styles: `
    :host {
      display: block;
      margin-top: 2rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 12px;
      padding: 1rem 1.5rem;
      background: var(--mat-sys-surface);
    }
    h2 {
      font-size: 1rem;
      font-weight: 600;
      margin: 0 0 0.5rem;
      color: var(--mat-sys-on-surface);
    }
    ol {
      margin: 0;
      padding-left: 2.5rem;
      font: 0.85rem/1.7 monospace;
      color: var(--mat-sys-on-surface-variant);
    }
    .lifecycle-log__empty {
      font-size: 0.875rem;
      color: var(--mat-sys-on-surface-variant);
      margin: 0;
    }
  `,
})
export class LifecycleLogView {
  protected readonly log = inject(LifecycleLog);
}

/** Sync content: pure lifecycle probe. */
@Component({
  selector: 'app-probe-alpha',
  template: `
    <strong>Alpha</strong>
    <p>Plain synchronous content. Check the lifecycle log below.</p>
  `,
  styles: `
    :host { display: block; max-width: 24ch; }
    p { margin: 4px 0 0; opacity: 0.8; }
  `,
})
export class ProbeAlpha implements OnInit, OnDestroy {
  readonly #log = inject(LifecycleLog);

  ngOnInit(): void {
    this.#log.push('ProbeAlpha ngOnInit — view stamped');
  }
  ngOnDestroy(): void {
    this.#log.push('ProbeAlpha ngOnDestroy — view torn down');
  }
}

/** Simulated API call — visible latency so the async injection shows. */
function fetchQuote(): Promise<string> {
  return new Promise((resolve) =>
    setTimeout(() => resolve(`"Anchors aweigh" — fetched at ${new Date().toLocaleTimeString()}`), 800),
  );
}

/** Async content: lifecycle probe + resource() through the tooltip cache. */
@Component({
  selector: 'app-probe-beta',
  template: `
    <strong>Beta</strong>
    @if (quote.hasValue()) {
      <p>{{ quote.value() }}</p>
    } @else {
      <p class="loading">fetching…</p>
    }
  `,
  styles: `
    :host { display: block; max-width: 28ch; }
    p { margin: 4px 0 0; opacity: 0.8; }
    .loading { font-style: italic; }
  `,
})
export class ProbeBeta implements OnInit, OnDestroy {
  readonly #log = inject(LifecycleLog);
  readonly #cache = inject(HkTooltipCache);

  // Lazy by construction: this component only exists while the tooltip
  // shows it, so the loader fires on first show — and the cache makes the
  // next show instant (TTL from provideHkTooltipCache).
  readonly quote = resource({
    loader: () => this.#cache.getOrFetch('probe-beta:quote', () => fetchQuote()),
  });

  ngOnInit(): void {
    this.#log.push('ProbeBeta ngOnInit — view stamped, resource loading');
  }
  ngOnDestroy(): void {
    this.#log.push('ProbeBeta ngOnDestroy — view torn down');
  }
}
