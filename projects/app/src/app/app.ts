import {
  Component,
  DestroyRef,
  inject,
  DOCUMENT,

  // Signals
  signal,
  computed,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

// Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatDialog } from '@angular/material/dialog';
import { Dialog } from './dialog/dialog';

// Angular Tooltips (toolbar triggers)
import { HkTooltip } from '../../../angular-tooltips/src/public-api';

type Theme = 'light' | 'dark';

/** localStorage key for the user's explicit theme choice. */
export const THEME_STORAGE_KEY = 'hk-theme';

const DARK_QUERY = '(prefers-color-scheme: dark)';

@Component({
  selector: '[app-root]',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,

    // Angular Material
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatRippleModule,
    MatSidenavModule,

    // Angular Tooltips
    HkTooltip,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '[class]': 'themeClass()',
  },
})
export class App {
  #document = inject(DOCUMENT);
  #matDialog = inject(MatDialog);

  /**
   * An explicit choice saved in localStorage wins; otherwise the OS
   * preference, followed live until the user picks a theme themselves.
   */
  readonly theme = signal<Theme>(this.#readStoredTheme() ?? this.#systemTheme());
  readonly themeClass = computed(() => `${this.theme()}-mode`);

  constructor() {
    const media = this.#document.defaultView?.matchMedia?.(DARK_QUERY);
    if (!media) return;
    const followSystem = (event: MediaQueryListEvent) => {
      if (this.#readStoredTheme() === null) this.theme.set(event.matches ? 'dark' : 'light');
    };
    media.addEventListener('change', followSystem);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', followSystem));
  }

  toggleTheme() {
    const next: Theme = this.theme() === 'light' ? 'dark' : 'light';
    this.#storeTheme(next);

    if (this.#document.startViewTransition) {
      this.#document.startViewTransition(() => this.theme.set(next));
      return;
    }
    this.theme.set(next);
  }

  openLogin() {
    this.#matDialog.open(Dialog, {
      width: '480px',
      maxHeight: '80vh',
    });
  }

  #systemTheme(): Theme {
    return this.#document.defaultView?.matchMedia?.(DARK_QUERY).matches ? 'dark' : 'light';
  }

  // Storage can be unavailable or throw (private mode, blocked site data):
  // the theme then simply isn't remembered.
  #readStoredTheme(): Theme | null {
    try {
      const value = this.#document.defaultView?.localStorage.getItem(THEME_STORAGE_KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  #storeTheme(theme: Theme): void {
    try {
      this.#document.defaultView?.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Not persisted — the in-memory theme still applies.
    }
  }
}
