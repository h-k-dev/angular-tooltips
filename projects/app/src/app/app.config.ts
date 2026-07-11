import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withInMemoryScrolling } from '@angular/router';

import { provideHkTooltipCache } from '../../../angular-tooltips/src/public-api';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // anchorScrolling drives the aside's fragment links to the example cards.
    provideRouter(routes, withInMemoryScrolling({ anchorScrolling: 'enabled' })),
    // Short TTL so the demo makes expiry observable.
    provideHkTooltipCache({ ttl: 15_000 }),
  ],
};
