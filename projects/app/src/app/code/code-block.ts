import { Component, input, resource } from '@angular/core';

import { CodeLang, injectHighlighter } from './highlight';

/** A Shiki-highlighted snippet; re-highlights when `code` changes. */
@Component({
  selector: 'app-code-block',
  template: `
    @if (html.hasValue()) {
      <div class="demo-code" [innerHTML]="html.value()"></div>
    } @else {
      <!-- Unhighlighted fallback while Shiki loads — same text, no layout jump. -->
      <pre class="code-block__plain">{{ code() }}</pre>
    }
  `,
  styles: `
    :host {
      display: block;
      overflow: auto;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 8px;
    }
    .code-block__plain {
      margin: 0;
      padding: 1rem 1.25rem;
      font: 0.8125rem/1.5 ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
    }
  `,
})
export class CodeBlock {
  readonly #highlight = injectHighlighter();

  readonly code = input.required<string>();
  readonly lang = input<CodeLang>('angular-ts');

  protected readonly html = resource({
    params: () => ({ code: this.code(), lang: this.lang() }),
    loader: ({ params }) => this.#highlight(params.code, params.lang),
  });
}
