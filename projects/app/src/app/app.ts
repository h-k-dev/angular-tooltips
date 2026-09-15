import {
  Component,
  DestroyRef,
  inject,
  DOCUMENT,

  // Signals
  signal,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';

// Angular CDK
import { BreakpointObserver } from '@angular/cdk/layout';

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

/** Below 768px the aside overlays the content instead of pushing it. */
const NARROW_QUERY = '(max-width: 767.98px)';

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

  /** The user's explicit choice (persisted), if any. */
  readonly #stored = signal<Theme | null>(this.#readStoredTheme());
  /** The OS preference, kept live. */
  readonly #system = signal<Theme>(this.#systemTheme());

  /** An explicit choice wins; otherwise the OS preference is followed. */
  readonly theme = computed<Theme>(() => this.#stored() ?? this.#system());
  readonly themeClass = computed(() => `${this.theme()}-mode`);

  /** Narrow viewports get an overlay drawer (backdrop, outside click closes). */
  protected readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe(NARROW_QUERY)
      .pipe(map((state) => state.matches)),
    { initialValue: false },
  );

  constructor() {
    const media = this.#document.defaultView?.matchMedia?.(DARK_QUERY);
    if (!media) return;
    const followSystem = (event: MediaQueryListEvent) =>
      this.#system.set(event.matches ? 'dark' : 'light');
    media.addEventListener('change', followSystem);
    inject(DestroyRef).onDestroy(() => media.removeEventListener('change', followSystem));
  }

  toggleTheme() {
    const next: Theme = this.theme() === 'light' ? 'dark' : 'light';
    this.#storeTheme(next);

    if (this.#document.startViewTransition) {
      this.#document.startViewTransition(() => this.#stored.set(next));
      return;
    }
    this.#stored.set(next);
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
