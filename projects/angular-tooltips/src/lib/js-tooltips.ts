import { Directive, ElementRef, inject, input } from '@angular/core';

import {
  HkTooltipBase,
  HkTooltipContent,
  isInterestInvoker,
  supportsAnchorPositioning,
} from './angular-tooltips';

// ─── HkJsTooltip — the JS engine ────────────────────────────────────────────
// For every host that can NOT be an interest invoker: <span>, <div>, <img>,
// <input>, <code>, icons, component hosts… What the browser does for
// invokers is done here in JS, tippy-style: pointer/focus listeners on the
// host, show/hide delays, keep-open while hovering the popover, Escape and
// pointerdown-outside to dismiss (the last two live in the manager).
//
// Same singleton popover, same content model, same CSS anchor positioning,
// same API (HkTooltipBase) — so a pointer sweeping from an invoker trigger
// onto a JS trigger and back is one continuous tooltip.
//
// A host that CAN be an invoker throws at construction: the browser engine
// is strictly better there (native long-press, no listeners, no timers).

@Directive({
  selector: '[hkJsTooltip]',
  exportAs: 'hkJsTooltip',
  standalone: true,
  host: {
    '(pointerenter)': 'onPointerEnter($event)',
    '(pointerleave)': 'onPointerLeave($event)',
    '(focusin)': 'onFocusIn()',
    '(focusout)': 'hide()',
  },
})
export class HkJsTooltip extends HkTooltipBase {
  readonly engine = 'js' as const;
  readonly content = input.required<HkTooltipContent>({ alias: 'hkJsTooltip' });

  constructor() {
    // Checks run BEFORE registration so a throwing constructor leaves
    // nothing behind in the manager.
    const hostEl = inject(ElementRef<HTMLElement>).nativeElement;
    if (!supportsAnchorPositioning()) {
      throw new Error(
        '[hkJsTooltip] This environment lacks CSS Anchor Positioning. This ' +
          'library is anchor-native only — there is no positioning fallback.',
      );
    }
    if (isInterestInvoker(hostEl)) {
      throw new Error(
        `[hkJsTooltip] <${hostEl.tagName.toLowerCase()}> is an interest invoker — ` +
          'use `hkTooltip` here; the browser engine is strictly better on it.',
      );
    }
    super();
  }

  protected onPointerEnter(e: PointerEvent): void {
    // Touch: a tap shows immediately; the manager's pointerdown-outside
    // listener dismisses it (there is no reliable pointerleave for touch).
    this.show(e.pointerType === 'touch' ? 0 : undefined);
  }

  protected onPointerLeave(e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    this.hide();
  }

  protected onFocusIn(): void {
    // Keyboard focus only — a mouse click that focuses the host must not
    // pop the tooltip (inputs always match :focus-visible, which is right).
    if (this.hostEl.matches(':focus-visible')) this.show(0);
  }
}
