import {
  Component,
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
import {
  HkTooltip,
  JSTooltips,
  supportsAnchorPositioning,
} from '../../../angular-tooltips/src/public-api';

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
    JSTooltips,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  host: {
    '[class]': 'themeClass()',
  },
})
export class App {
  #document = inject(DOCUMENT);
  protected readonly title = signal('app');
  #matDialog = inject(MatDialog);

  theme = signal<'light' | 'dark'>('light');
  themeClass = computed(() => `${this.theme()}-mode`);

  // Strict engine split: [hkTooltip] throws without CSS Anchor Positioning,
  // [hkJsTooltip] throws with it — so the toolbar triggers branch on this.
  protected readonly anchorSupported = supportsAnchorPositioning();

  toggleTheme() {
    if (this.#document.startViewTransition) {
      this.#document.startViewTransition(() => {
        this.theme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
      });

      return;
    }

    this.theme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
  }

  openLogin() {
    this.#matDialog.open(Dialog, {
      width: '480px',
      maxHeight: '80vh',
    });
  }
}
