import { Directive, DestroyRef, ElementRef, inject, input } from '@angular/core';

import {
  HkTooltipContent,
  TooltipPlacement,
  TooltipTrigger,
  TooltipsManager,
  nextTooltipAnchorId,
  supportsAnchorPositioning,
} from './angular-tooltips';

// ─── JSTooltips directive — what tippy does, the Angular way ────────────────
// Same singleton popover, same content model (string fast path or lazily
// stamped TemplateRef), same delegated trigger events — but positioning is
// computed by the manager from getBoundingClientRect: preferred side, flip
// when the viewport runs out, cross-axis clamp, re-positioned on scroll and
// resize while open. The resolved side lands in [data-placement] so the
// stylesheet's `.hk-tooltip--js` rules drive tail and entrance direction.
//
// This directive is the counterpart for environments WITHOUT CSS Anchor
// Positioning and THROWS at construction where anchor positioning exists:
// use `hkTooltip` there instead (branch templates with the exported
// `supportsAnchorPositioning()` helper).

@Directive({
  selector: '[hkJsTooltip]',
  standalone: true,
  host: {
    // The registry key — the delegation resolves the directive from it and
    // reads content/placement/delays live off its signals.
    '[attr.data-tooltip-id]': 'anchorId',
  },
})
export class JSTooltips implements TooltipTrigger {
  readonly #manager = inject(TooltipsManager);

  /** Host element — the manager positions against it and reads :hover off it. */
  readonly hostEl = inject(ElementRef<HTMLElement>).nativeElement;

  readonly method = 'js' as const;

  content = input.required<HkTooltipContent>({ alias: 'hkJsTooltip' });
  data = input<unknown>(undefined, { alias: 'hkJsTooltipData' });
  placement = input<TooltipPlacement>('top', { alias: 'hkJsTooltipPlacement' });
  showDelay = input<number>(0, { alias: 'hkJsTooltipDelay' });
  hideDelay = input<number>(80, { alias: 'hkJsTooltipHideDelay' });

  readonly anchorId: string;

  constructor() {
    // Early, loud, and at construction: on an anchor-capable platform the
    // JS engine is the wrong directive — the CSS engine is strictly better
    // (no rect reads, no scroll listeners, browser-owned flipping).
    if (supportsAnchorPositioning()) {
      throw new Error(
        '[hkJsTooltip] This environment supports CSS Anchor Positioning — ' +
          'use the `hkTooltip` directive here instead ' +
          '(branch with the exported supportsAnchorPositioning() helper).',
      );
    }
    this.anchorId = nextTooltipAnchorId();
    this.#manager.register(this);
    inject(DestroyRef).onDestroy(() => this.#manager.unregister(this));
  }
}
