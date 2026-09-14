import { Component, DOCUMENT, computed, effect, inject, signal } from '@angular/core';

import { MatButtonModule } from '@angular/material/button';

import { HkJsTooltip, HkTooltip } from '../../../../../angular-tooltips/src/public-api';
import { ThemingCard } from '../../cards/theming-card/theming-card';
import { CodeBlock } from '../../code/code-block';

interface ThemePreset {
  id: string;
  label: string;
  /** `--tt-*` overrides; empty = the Material fallbacks. */
  vars: Record<string, string>;
}

const PRESETS: ThemePreset[] = [
  { id: 'material', label: 'Material (default)', vars: {} },
  {
    id: 'slate',
    label: 'Slate',
    vars: {
      '--tt-container-color': '#1e293b',
      '--tt-text-color': '#e2e8f0',
      '--tt-border-radius': '8px',
      '--tt-padding': '8px 12px',
      '--tt-shadow': '0 8px 24px rgb(0 0 0 / 0.25)',
    },
  },
  {
    id: 'brand',
    label: 'Brand',
    vars: {
      '--tt-container-color': 'var(--mat-sys-primary)',
      '--tt-text-color': 'var(--mat-sys-on-primary)',
      '--tt-border-radius': '12px',
      '--tt-font-weight': '500',
      '--tt-gap': '12px',
      '--tt-tail-size': '8px',
    },
  },
  {
    id: 'pill',
    label: 'Pill, slow entrance',
    vars: {
      '--tt-border-radius': '999px',
      '--tt-padding': '6px 14px',
      '--tt-enter-duration': '0.6s',
      '--tt-fade-duration': '0.4s',
      '--tt-slide-distance': '18px',
    },
  },
];

@Component({
  selector: 'app-theming-page',
  imports: [MatButtonModule, HkTooltip, HkJsTooltip, ThemingCard, CodeBlock],
  templateUrl: './theming-page.html',
  styleUrl: './theming-page.scss',
})
export class ThemingPage {
  readonly #root = inject(DOCUMENT).documentElement;

  protected readonly presets = PRESETS;
  protected readonly preset = signal(PRESETS[1]);

  /** The CSS a consumer would write for the selected preset. */
  protected readonly css = computed(() => {
    const entries = Object.entries(this.preset().vars);
    if (entries.length === 0) {
      return '/* Nothing to set: every --tt-* variable falls back to\n   --mat-tooltip-* → --mat-sys-* → the built-in default. */';
    }
    return `:root {\n${entries.map(([name, value]) => `  ${name}: ${value};`).join('\n')}\n}`;
  });

  constructor() {
    // The variables live on :root, exactly where an app would put them — so
    // the preview (and every other tooltip, toolbar included) is themed while
    // this page is open. Previous values are removed on change and on leave.
    effect((onCleanup) => {
      const vars = Object.entries(this.preset().vars);
      for (const [name, value] of vars) this.#root.style.setProperty(name, value);
      onCleanup(() => {
        for (const [name] of vars) this.#root.style.removeProperty(name);
      });
    });
  }
}
