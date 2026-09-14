import {
  Component,
  ElementRef,
  computed,
  input,
  linkedSignal,
  resource,
  viewChildren,
} from '@angular/core';
import { SafeHtml } from '@angular/platform-browser';

import { CodeLang, injectHighlighter } from '../code/highlight';

/** One source tab: a REAL file the build copies to `source/` (angular.json assets). */
export interface ExampleSourceFile {
  label: string;
  file: string;
  lang: CodeLang;
}

interface Tab {
  id: string;
  label: string;
  file?: ExampleSourceFile;
}

const PREVIEW: Tab = { id: 'preview', label: 'Preview' };

/**
 * Preview / source switcher. The projected content is the live example; the
 * other tabs show that example's REAL source files, fetched from the copied
 * `source/` assets and highlighted with Shiki — zero drift between what runs
 * and what is shown.
 *
 * Shiki loads lazily with the first code tab, and each file is highlighted
 * once. The preview stays mounted (hidden) while code is shown, so the live
 * example keeps its state.
 *
 * WAI-ARIA tabs pattern: tablist / tab / tabpanel, roving tabindex, arrow
 * keys + Home/End move and activate, the code panel is a focusable scroll
 * region.
 */
@Component({
  selector: 'app-example-source',
  templateUrl: './example-source.html',
  styleUrl: './example-source.scss',
})
export class ExampleSource {
  readonly #highlight = injectHighlighter();
  readonly #highlighted = new Map<string, Promise<SafeHtml>>();
  readonly #idPrefix = `example-source-${nextId++}`;

  readonly files = input.required<readonly ExampleSourceFile[]>();
  /** Accessible name of the tab list, e.g. "Inspiration example". */
  readonly label = input.required<string>();

  protected readonly tabs = computed<Tab[]>(() => [
    PREVIEW,
    ...this.files().map((file) => ({ id: file.file, label: file.label, file })),
  ]);
  /** Selected tab id; falls back to Preview whenever the file list changes. */
  protected readonly active = linkedSignal<string>(() => {
    this.files();
    return PREVIEW.id;
  });
  protected readonly activeTab = computed(
    () => this.tabs().find((tab) => tab.id === this.active()) ?? PREVIEW,
  );
  protected readonly activeFile = computed(() => this.activeTab().file);

  protected readonly code = resource({
    params: () => this.activeFile(),
    loader: ({ params }) => this.#load(params),
  });

  // Signal queries cannot be ES-private (NG1053).
  protected readonly tabButtons = viewChildren<ElementRef<HTMLButtonElement>>('tabButton');

  /** Two panels: the live preview, and one code panel reused by every file tab. */
  protected readonly previewPanelId = `${this.#idPrefix}-panel-preview`;
  protected readonly codePanelId = `${this.#idPrefix}-panel-code`;

  protected tabId(tab: Tab): string {
    return `${this.#idPrefix}-tab-${tab.label.toLowerCase()}`;
  }

  protected panelId(tab: Tab): string {
    return tab.file ? this.codePanelId : this.previewPanelId;
  }

  protected select(tab: Tab): void {
    this.active.set(tab.id);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const count = this.tabs().length;
    const next =
      event.key === 'ArrowRight'
        ? (index + 1) % count
        : event.key === 'ArrowLeft'
          ? (index - 1 + count) % count
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? count - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    this.select(this.tabs()[next]);
    this.tabButtons()[next]?.nativeElement.focus();
  }

  #load(file: ExampleSourceFile): Promise<SafeHtml> {
    let pending = this.#highlighted.get(file.file);
    if (!pending) {
      pending = fetch(`source/${file.file}`)
        .then((response) =>
          response.ok ? response.text() : `// failed to load (${response.status})`,
        )
        .then((source) => this.#highlight(source, file.lang));
      pending.catch(() => this.#highlighted.delete(file.file));
      this.#highlighted.set(file.file, pending);
    }
    return pending;
  }
}

let nextId = 0;
