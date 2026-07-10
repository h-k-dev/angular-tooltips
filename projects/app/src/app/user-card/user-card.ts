import { Component, inject, input, resource } from '@angular/core';

import { HkTooltipCache } from '../../../../angular-tooltips/src/public-api';

interface DemoUser {
  id: number;
  name: string;
  avatar: string;
  role: string;
  location: string;
  fetchedAt: string;
}

const FAKE_DB: Record<number, Omit<DemoUser, 'fetchedAt' | 'avatar'>> = {
  1: { id: 1, name: 'Amelia Chen', role: 'Design Systems Lead', location: 'Rotterdam' },
  2: { id: 2, name: 'Jonas Weber', role: 'Frontend Engineer', location: 'Berlin' },
  3: { id: 3, name: 'Priya Nair', role: 'Product Manager', location: 'Amsterdam' },
};

/** Simulated API call — ~900 ms latency so the skeleton state is visible. */
function fetchUser(id: number): Promise<DemoUser> {
  const record = FAKE_DB[id];
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          ...record,
          // DiceBear is seeded by name, so every trigger for the same user
          // renders the same face — and the avatar arrives like real API data.
          avatar: `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(record.name)}`,
          fetchedAt: new Date().toLocaleTimeString(),
        }),
      900,
    ),
  );
}

@Component({
  selector: 'app-user-card',
  template: `
    @if (user.hasValue()) {
      <div class="user-card">
        <img class="user-card__avatar" [src]="user.value().avatar" [alt]="user.value().name"
          width="36" height="36" />
        <div class="user-card__body">
          <strong>{{ user.value().name }}</strong>
          <span>{{ user.value().role }} · {{ user.value().location }}</span>
          <small>fetched at {{ user.value().fetchedAt }} — cached 15 s</small>
        </div>
      </div>
    } @else {
      <div class="user-card">
        <div class="user-card__avatar user-card__skeleton"></div>
        <div class="user-card__body">
          <span class="user-card__skeleton user-card__skeleton--wide"></span>
          <span class="user-card__skeleton"></span>
        </div>
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .user-card {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 210px;
      padding: 2px;
    }
    .user-card__avatar {
      flex: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      /* placeholder circle stays visible until the SVG arrives */
      background: color-mix(in srgb, currentColor 18%, transparent);
    }
    .user-card__body {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .user-card__body small {
      opacity: 0.65;
    }
    .user-card__skeleton {
      height: 10px;
      width: 70px;
      border-radius: 5px;
      background: color-mix(in srgb, currentColor 22%, transparent);
      animation: user-card-pulse 0.8s ease-in-out infinite alternate;
    }
    .user-card__skeleton--wide {
      width: 140px;
    }
    .user-card__avatar.user-card__skeleton {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }
    @keyframes user-card-pulse {
      from { opacity: 0.45; }
      to { opacity: 1; }
    }
  `,
})
export class UserCard {
  readonly userId = input.required<number>();
  readonly #cache = inject(HkTooltipCache);

  // Lazy by construction: this component (and therefore this resource) is
  // only instantiated when the tooltip template is stamped on first show.
  // The cache dedupes concurrent hovers and keeps results for the TTL.
  readonly user = resource({
    params: () => this.userId(),
    loader: ({ params }) => this.#cache.getOrFetch(`user:${params}`, () => fetchUser(params)),
  });
}
