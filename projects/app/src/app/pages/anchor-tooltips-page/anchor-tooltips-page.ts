import { Component, inject } from '@angular/core';

import { HkTooltip } from '../../../../../angular-tooltips/src/public-api';
import { LifecycleLog, ProbeAlpha, ProbeBeta } from './lifecycle-probes';

@Component({
  selector: 'app-anchor-tooltips-page',
  imports: [HkTooltip, ProbeAlpha, ProbeBeta],
  providers: [LifecycleLog],
  templateUrl: './anchor-tooltips-page.html',
  styleUrl: './anchor-tooltips-page.scss',
})
export class AnchorTooltipsPage {
  protected readonly log = inject(LifecycleLog);
}
