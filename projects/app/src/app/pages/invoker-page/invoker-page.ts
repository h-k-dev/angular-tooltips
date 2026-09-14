import { Component } from '@angular/core';

import { HkTooltip } from '../../../../../angular-tooltips/src/public-api';
import { LifecycleLog, LifecycleLogView, ProbeAlpha, ProbeBeta } from '../../lifecycle/lifecycle-probes';

@Component({
  selector: 'app-invoker-page',
  imports: [HkTooltip, LifecycleLogView, ProbeAlpha, ProbeBeta],
  providers: [LifecycleLog],
  templateUrl: './invoker-page.html',
  styleUrl: './invoker-page.scss',
})
export class InvokerPage {}
