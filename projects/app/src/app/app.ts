import {
  Component,
  inject,
  DOCUMENT,

  // Signals
  signal,
  computed,
} from '@angular/core';

// Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatRippleModule } from '@angular/material/core';
import { MatDialog } from '@angular/material/dialog';
import { Dialog } from './dialog/dialog';

// Angular Tooltips
import { AngularTooltip } from '../../../angular-tooltips/src/public-api';

@Component({
  selector: '[app-root]',
  imports: [
    // Angular Material
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatRippleModule,

    // Angular Tooltips
    AngularTooltip,
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

  toggleTheme() {
    if (this.#document.startViewTransition) {
      this.#document.startViewTransition(() => {
        this.theme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
      });

      return;
    }

    this.theme.update((theme) => (theme === 'light' ? 'dark' : 'light'));
  }

  stressCells = Array.from({ length: 100 }, (_, i) => i + 1);

  openSettings() {
    console.log('openSettings');
    this.#matDialog.open(Dialog, {
      width: '300px',
      height: '200px',
      data: {
        theme: this.theme(),
      },
    });
  }
}
