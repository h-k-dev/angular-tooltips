import { Component } from '@angular/core';

import {
  HkTooltip,
  JSTooltips,
  supportsAnchorPositioning,
} from '../../../../../angular-tooltips/src/public-api';

@Component({
  selector: 'app-theming-card',
  imports: [HkTooltip, JSTooltips],
  templateUrl: './theming-card.html',
  styleUrl: './theming-card.scss',
  host: { class: 'test-card full-width-card' },
})
export class ThemingCard {
  // This card renders with either engine, so its own tooltips branch too.
  protected readonly anchorSupported = supportsAnchorPositioning();

  // Mirrors the public theming API in the library's global stylesheet:
  // --tt-* → Material tooltip token → Material system token → default.
  protected readonly themeVars: {
    name: string;
    purpose: string;
    fallback: string[];
    default: string;
  }[] = [
    {
      name: '--tt-container-color',
      purpose: 'Background of bubble and tail',
      fallback: ['--mat-tooltip-container-color', '--mat-sys-inverse-surface'],
      default: '#313033',
    },
    {
      name: '--tt-text-color',
      purpose: 'Text color',
      fallback: ['--mat-tooltip-supporting-text-color', '--mat-sys-inverse-on-surface'],
      default: '#f4eff4',
    },
    {
      name: '--tt-border-radius',
      purpose: 'Corner radius',
      fallback: ['--mat-tooltip-container-shape', '--mat-sys-corner-extra-small'],
      default: '4px',
    },
    {
      name: '--tt-font-family',
      purpose: 'Font family',
      fallback: ['--mat-tooltip-supporting-text-font', '--mat-sys-body-small-font'],
      default: 'Roboto, sans-serif',
    },
    {
      name: '--tt-font-size',
      purpose: 'Font size',
      fallback: ['--mat-tooltip-supporting-text-size', '--mat-sys-body-small-size'],
      default: '12px',
    },
    {
      name: '--tt-font-weight',
      purpose: 'Font weight',
      fallback: ['--mat-tooltip-supporting-text-weight', '--mat-sys-body-small-weight'],
      default: '400',
    },
    {
      name: '--tt-line-height',
      purpose: 'Line height',
      fallback: ['--mat-tooltip-supporting-text-line-height', '--mat-sys-body-small-line-height'],
      default: '1.4',
    },
    {
      name: '--tt-letter-spacing',
      purpose: 'Letter spacing',
      fallback: ['--mat-tooltip-supporting-text-tracking', '--mat-sys-body-small-tracking'],
      default: '0.033em',
    },
    { name: '--tt-shadow', purpose: 'Box shadow', fallback: [], default: 'none' },
    { name: '--tt-padding', purpose: 'Inner padding', fallback: [], default: '6px 10px' },
    { name: '--tt-max-width', purpose: 'Maximum width', fallback: [], default: '280px' },
    { name: '--tt-gap', purpose: 'Distance from the anchor', fallback: [], default: '8px' },
    { name: '--tt-tail-size', purpose: 'Tail (arrow) size', fallback: [], default: '6px' },
    { name: '--tt-enter-duration', purpose: 'Slide-in duration', fallback: [], default: '0.3s' },
    { name: '--tt-fade-duration', purpose: 'Fade-in duration', fallback: [], default: '0.15s' },
    { name: '--tt-slide-distance', purpose: 'Slide-in distance', fallback: [], default: '10px' },
  ];
}
