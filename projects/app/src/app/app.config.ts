import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';

import { provideHkTooltipCache } from '../../../angular-tooltips/src/public-api';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    // Short TTL so the demo makes expiry observable.
    provideHkTooltipCache({ ttl: 15_000 }),
  ],
};
