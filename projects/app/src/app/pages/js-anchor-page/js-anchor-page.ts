import { Component } from '@angular/core';

import { HkJsTooltip } from '../../../../../angular-tooltips/src/public-api';
import { AnyElementCard } from '../../cards/any-element-card/any-element-card';
import { LifecycleLog, LifecycleLogView, ProbeAlpha, ProbeBeta } from '../../lifecycle/lifecycle-probes';

@Component({
  selector: 'app-js-anchor-page',
  imports: [HkJsTooltip, AnyElementCard, LifecycleLogView, ProbeAlpha, ProbeBeta],
  providers: [LifecycleLog],
  templateUrl: './js-anchor-page.html',
  styleUrl: './js-anchor-page.scss',
})
export class JsAnchorPage {}
