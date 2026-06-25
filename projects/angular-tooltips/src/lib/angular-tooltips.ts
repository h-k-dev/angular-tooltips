import {
  inject,
  Injectable,
  Directive,
  input,
  ElementRef,
  DOCUMENT,
  OnDestroy,
  OnInit,
} from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

const TOOLTIP_ID = 'modern-singleton-tooltip';

const ATTR_TOOLTIP = 'data-tooltip';
const ATTR_PLACEMENT = 'data-tooltip-placement';
const ATTR_DELAY = 'data-tooltip-delay';
const ATTR_HIDE_DELAY = 'data-tooltip-hide-delay';
const ATTR_ANCHOR_ID = 'data-tooltip-id';

const CSS_ANCHOR_SUPPORTED = typeof CSS !== 'undefined' && CSS.supports?.('anchor-name', '--a');

/**
 * Interest Invokers (`interestfor`) feature detection. The reflected IDL
 * attribute is `interestForElement`; if it exists on anchors, the browser
 * handles hover *and* focus *and* touch long-press *and* delays natively.
 */
const INTEREST_FOR_SUPPORTED =
  typeof HTMLAnchorElement !== 'undefined' && 'interestForElement' in HTMLAnchorElement.prototype;

// ─── TooltipsManager ─────────────────────────────────────────────────────────
// Two trigger paths share one singleton popover:
//
//  1. `interestfor` path — used for <a href> hosts in supporting browsers.
//     The BROWSER owns showing/hiding, delays (via CSS interest-delay-*),
//     keyboard interest, and touch long-press. The only JS left is the
//     `interest` event listener that writes text + position-anchor before
//     the popover opens.
//
//  2. JS-delegation path — everything else (buttons, spans, icons…).
//     Same as before: delegated hover/focus, timers, showPopover().
//
// Positioning, flipping, tail direction, and clip-hiding are all CSS.

@Injectable({ providedIn: 'root' })
export class TooltipsManager {
  private tooltipEl: HTMLElement | null = null;

  private showTimer: ReturnType<typeof setTimeout> | null = null;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;
  private activeId: string | null = null;

  private delegationRoots = new Map<Element, () => void>();

  private readonly doc = inject(DOCUMENT);

  // ── Public API ─────────────────────────────────────────────────────────────
  registerRoot(root: Element): void {
    if (this.delegationRoots.has(root)) return;
    this.ensureInit();

    const over = (e: MouseEvent) => {
      const target = (e.target as Element).closest(`[${ATTR_TOOLTIP}]`) as HTMLElement | null;
      if (!target) return;
      // interestfor elements are the browser's job — don't double-trigger.
      if (target.hasAttribute('interestfor')) return;
      const text = target.getAttribute(ATTR_TOOLTIP) ?? '';
      if (!text) return;
      const placement = (target.getAttribute(ATTR_PLACEMENT) ?? 'top') as TooltipPlacement;
      const delay = Number(target.getAttribute(ATTR_DELAY) ?? '0');
      const id = target.getAttribute(ATTR_ANCHOR_ID) ?? '';
      this.scheduleShow(id, text, placement, delay);
    };

    const out = (e: MouseEvent) => {
      const src = (e.target as Element).closest(`[${ATTR_TOOLTIP}]`);
      if (src?.hasAttribute('interestfor')) return;
      const related = e.relatedTarget as Element | null;
      if (related?.closest(`[${ATTR_TOOLTIP}]`)) return;
      if (related === this.tooltipEl || this.tooltipEl?.contains(related)) return;
      const hideDelay = Number(src?.getAttribute(ATTR_HIDE_DELAY) ?? '80');
      this.scheduleHide(hideDelay);
    };

    const focus = (e: FocusEvent) => {
      const target = (e.target as Element).closest(`[${ATTR_TOOLTIP}]`) as HTMLElement | null;
      if (!target) return;
      if (target.hasAttribute('interestfor')) return;
      const text = target.getAttribute(ATTR_TOOLTIP) ?? '';
      if (!text) return;
      const placement = (target.getAttribute(ATTR_PLACEMENT) ?? 'top') as TooltipPlacement;
      const id = target.getAttribute(ATTR_ANCHOR_ID) ?? '';
      this.scheduleShow(id, text, placement, 0);
    };

    const blur = (e: FocusEvent) => {
      const src = (e.target as Element).closest?.(`[${ATTR_TOOLTIP}]`);
      if (src?.hasAttribute('interestfor')) return;
      this.scheduleHide(80);
    };

    root.addEventListener('mouseover', over as EventListener);
    root.addEventListener('mouseout', out as EventListener);
    root.addEventListener('focusin', focus as EventListener);
    root.addEventListener('focusout', blur as EventListener);

    this.delegationRoots.set(root, () => {
      root.removeEventListener('mouseover', over as EventListener);
      root.removeEventListener('mouseout', out as EventListener);
      root.removeEventListener('focusin', focus as EventListener);
      root.removeEventListener('focusout', blur as EventListener);
    });
  }

  unregisterRoot(root: Element): void {
    this.delegationRoots.get(root)?.();
    this.delegationRoots.delete(root);
  }

  ensureBodyDelegation(): void {
    this.registerRoot(this.doc.body);
  }

  /**
   * Point the singleton at a trigger: three writes, no reads, no math.
   * Used by both paths — the interest path calls it from the `interest`
   * event (where the browser then opens the popover itself; the
   * showPopover() below is a no-op-guard for that case).
   */
  show(id: string, text: string, placement: TooltipPlacement) {
    this.ensureInit();
    const el = this.tooltipEl!;

    this.clearShowTimer();
    this.clearHideTimer();

    if (this.activeId === id && el.matches(':popover-open')) return;
    this.activeId = id;

    el.textContent = text;
    el.style.setProperty('position-anchor', `--${id}`);
    el.setAttribute('data-placement-pref', placement);

    if (!el.matches(':popover-open')) el.showPopover();
  }

  // ── Timer helpers (JS-delegation path only) ────────────────────────────────

  private scheduleShow(id: string, text: string, placement: TooltipPlacement, delay: number) {
    this.clearShowTimer();
    this.clearHideTimer();
    if (delay > 0) {
      this.showTimer = setTimeout(() => this.show(id, text, placement), delay);
    } else {
      this.show(id, text, placement);
    }
  }

  private scheduleHide(delay: number) {
    this.clearShowTimer();
    this.clearHideTimer();
    this.hideTimer = setTimeout(() => {
      if (this.tooltipEl?.matches(':popover-open')) this.tooltipEl.hidePopover();
      this.activeId = null;
    }, delay);
  }

  private clearShowTimer() {
    if (this.showTimer) {
      clearTimeout(this.showTimer);
      this.showTimer = null;
    }
  }

  private clearHideTimer() {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────

  private ensureInit() {
    if (this.tooltipEl) return;
    this.injectStyles();

    const el = this.doc.createElement('div');
    el.id = TOOLTIP_ID;
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'tooltip');

    // ── interestfor path ─────────────────────────────────────────────────
    // The `interest` event fires ON THE TARGET (this element), with
    // `event.source` = the invoker, BEFORE the browser's default action
    // opens the popover. That's exactly the hook we need to write the
    // text and re-point position-anchor at the right trigger.
    el.addEventListener('interest', (e: Event) => {
      const src = (e as Event & { source?: Element }).source ?? null;
      if (!(src instanceof HTMLElement)) return;
      const text = src.getAttribute(ATTR_TOOLTIP) ?? '';
      if (!text) return;
      const placement = (src.getAttribute(ATTR_PLACEMENT) ?? 'top') as TooltipPlacement;
      const id = src.getAttribute(ATTR_ANCHOR_ID) ?? '';
      this.show(id, text, placement);
    });

    // Losing interest: the browser hides the popover; we only sync state.
    // (Interest is sustained while hovering the tooltip itself, so
    // hover-to-select-text works for free on this path.)
    el.addEventListener('loseinterest', () => {
      this.activeId = null;
      if (el.matches(':popover-open')) el.hidePopover();
    });

    // Whatever closed the popover (interest loss, Esc, JS): reset state.
    el.addEventListener('toggle', (e: Event) => {
      if ((e as ToggleEvent).newState === 'closed') this.activeId = null;
    });

    // JS-delegation path: hovering the tooltip cancels a pending hide.
    el.addEventListener('mouseover', () => this.clearHideTimer());
    el.addEventListener('mouseout', () => {
      // Only relevant when JS owns the lifecycle; interest-driven hides
      // are handled by loseinterest above.
      if (this.hideTimer || this.activeId) this.scheduleHide(80);
    });

    this.doc.body.appendChild(el);
    this.tooltipEl = el;

    this.registerRoot(this.doc.body);
  }

  private injectStyles() {
    if (this.doc.getElementById('modern-tooltip-styles')) return;
    const s = this.doc.createElement('style');
    s.id = 'modern-tooltip-styles';
    s.textContent = TOOLTIP_CSS;
    this.doc.head.appendChild(s);
  }
}

// ─── ngTooltipRoot directive ──────────────────────────────────────────────────
// Unchanged — scopes delegation to a subtree, e.g. a virtualized grid.

@Directive({
  selector: '[ngTooltipRoot]',
  standalone: true,
})
export class NgTooltipRoot implements OnInit, OnDestroy {
  private readonly manager = inject(TooltipsManager);
  private readonly el = inject(ElementRef<Element>);

  ngOnInit() {
    this.manager.registerRoot(this.el.nativeElement);
  }
  ngOnDestroy() {
    this.manager.unregisterRoot(this.el.nativeElement);
  }
}

// ─── AngularTooltip directive ──────────────────────────────────────────────────
// Trigger selection, per host element:
//
//   <a href …>  + Interest Invokers supported
//     → `interestfor` points at the singleton popover. The browser owns
//       show/hide, hover+focus+long-press semantics, and delays (mapped to
//       the CSS `interest-delay-start/end` properties from the same inputs).
//
//   anything else (or no Interest Invokers support, but Anchor Positioning ok)
//     → JS-delegation path via data-attributes, exactly as before.
//
//   no CSS Anchor Positioning at all
//     → native `title` attribute.

let _uid = 0;

@Directive({
  selector: '[ngTooltip]',
  standalone: true,
  host: {
    '[style.anchor-name]': 'supported ? anchorName : null',
    '[attr.title]': '!supported ? content() : null',

    // Shared metadata — the interest handler reads these off event.source,
    // the JS delegation reads them off the hovered/focused element.
    '[attr.data-tooltip]': 'supported ? content() : null',
    '[attr.data-tooltip-placement]': 'supported ? placement() : null',
    '[attr.data-tooltip-id]': 'supported ? anchorId : null',

    // interestfor path: browser-native trigger + CSS-native delays.
    '[attr.interestfor]': 'useInterest ? tooltipId : null',
    '[style.interest-delay-start]': 'useInterest ? showDelay() + "ms" : null',
    '[style.interest-delay-end]': 'useInterest ? hideDelay() + "ms" : null',

    // JS path: delays consumed by the manager's timers.
    '[attr.data-tooltip-delay]': 'supported && !useInterest ? showDelay() : null',
    '[attr.data-tooltip-hide-delay]': 'supported && !useInterest ? hideDelay() : null',
  },
})
export class AngularTooltip {
  private readonly manager = inject(TooltipsManager);
  private readonly hostEl = inject(ElementRef<HTMLElement>).nativeElement;

  content = input.required<string>({ alias: 'ngTooltip' });
  placement = input<TooltipPlacement>('top', { alias: 'ngTooltipPlacement' });
  showDelay = input<number>(0, { alias: 'ngTooltipDelay' });
  hideDelay = input<number>(80, { alias: 'ngTooltipHideDelay' });

  protected readonly supported = CSS_ANCHOR_SUPPORTED;
  protected readonly tooltipId = TOOLTIP_ID;
  protected readonly anchorName: string;
  readonly anchorId: string;

  /**
   * Getter (not a field) so a `href` added late — e.g. by routerLink —
   * still flips the element onto the interest path on the next CD cycle.
   * Only focusable links qualify: `interestfor` is defined for <a href>,
   * <area href> and buttons; we deliberately keep buttons on the JS path
   * per current requirements.
   */
  protected get useInterest(): boolean {
    return (
      this.supported &&
      INTEREST_FOR_SUPPORTED &&
      this.hostEl instanceof HTMLAnchorElement &&
      this.hostEl.hasAttribute('href')
    );
  }

  constructor() {
    this.anchorId = `tt-${(++_uid).toString(36)}`;
    this.anchorName = `--${this.anchorId}`;
    // Always init: creates the singleton + its interest listeners, and
    // registers body delegation for the JS path.
    if (this.supported) this.manager.ensureBodyDelegation();
  }
}

// ─── Styles ───────────────────────────────────────────────────────────────────
// All positioning, flipping, and tail-direction logic lives here.
//
// The tail rework: the tooltip itself is `container-type: anchored`, so its
// ::before can ask the browser "did a position-try fallback actually fire?"
// via @container anchored(fallback: flip-block | flip-inline). That replaces
// the whole @property/--tt-side/style() machinery AND the named
// @position-try blocks — the built-in flip tactics are queryable directly.
//
// Note the container-query rule that shapes this design: an element cannot
// match a container query against ITSELF, only its descendants and
// pseudo-elements can. So the flip queries only ever select ::before —
// which is also why the entrance animation direction is keyed off
// [data-placement-pref] (the preferred side) rather than the resolved side.
const TOOLTIP_CSS = `
/* ── The tooltip ──────────────────────────────────────────────────────────
   Follows the reference example exactly: one element, one-shot keyframe
   entrance, no transitions at all. Why this matters for a SINGLETON:

   - A keyframe animation runs once when the element starts rendering
     (popover open) and then goes inert. Nothing is "live" afterwards,
     so swapping textContent / anchor / placement while open — or the
     anchored() query flipping the tail — applies instantly with zero
     secondary motion. Transitions, by contrast, re-fire on every such
     change, which is what caused the drifting text and blinking tail.

   - Exit is instant (no allow-discrete fade), so there is never a
     half-faded ghost whose tail re-evaluates mid-flight.

   - The tail rides along with the entrance translate as one solid unit
     with the bubble — same as the example. */
#${TOOLTIP_ID} {
  /* Tail size must stay smaller than the gap so it never overlaps the trigger. */
  --tt-tail: 6px;
  --tt-gap: 8px;

  /* Anchored query container: lets ::before query which fallback resolved. */
  container-type: anchored;

  box-sizing: border-box;
  border: none;
  overflow: visible;            /* the tail renders outside the border box */

  padding: 6px 10px;
  max-width: 280px;
  white-space: normal;
  word-break: break-word;
  z-index: 9999;

  --tt-bg: var(--angular-tooltip-container-color,
            var(--mat-tooltip-container-color,
            var(--mat-sys-inverse-surface, #313033)));
  background: var(--tt-bg);
  color: var(--angular-tooltip-color,
         var(--mat-tooltip-supporting-text-color,
         var(--mat-sys-inverse-on-surface, #f4eff4)));
  border-radius: var(--angular-tooltip-border-radius,
                 var(--mat-tooltip-container-shape,
                 var(--mat-sys-corner-extra-small, 4px)));
  font-family: var(--mat-tooltip-supporting-text-font,
               var(--mat-sys-body-small-font, inherit));
  font-size:   var(--mat-tooltip-supporting-text-size,
               var(--mat-sys-body-small-size, 12px));
  font-weight: var(--mat-tooltip-supporting-text-weight,
               var(--mat-sys-body-small-weight, 400));
  line-height: var(--mat-tooltip-supporting-text-line-height,
               var(--mat-sys-body-small-line-height, 1.4));

  position: fixed;
  inset: auto;
  margin: var(--tt-gap);

  /* Hide automatically when the anchor scrolls out of view or is clipped. */
  position-visibility: anchors-visible;

  /* One-shot entrance, direction set per placement below. Restarts only
     when the popover re-renders (close → open), never while open.
     Two layered animations: 
     1. The directional slide gets the custom linear curve and 0.3s duration 
        so the "spring/slickness" has time to actually play out.
     2. The opacity fade gets a quick 0.15s ease-out so it appears quickly 
        while the motion is still settling into place. */
  animation:
    tt-in-up 0.3s linear(0, 0.68 24%, 0.86 48%, 0.95 72%, 1),
    tt-fade  0.15s ease-out;
}

/* ── Preferred side + built-in flip fallback ─────────────────────────────
   Set by JS from [ngTooltipPlacement]. The browser does all overlap
   detection; flip-block / flip-inline are queryable from the tail below.
   Entrance direction follows the PREFERRED side (an element can't run an
   anchored() query against itself — same as the reference example, where
   the element-level flip block never actually matches). */

#${TOOLTIP_ID}[data-placement-pref="top"] {
  position-area: top;
  position-try-fallbacks: flip-block;
  animation-name: tt-in-up, tt-fade;   /* animation-name overrides the full list */
  transform-origin: bottom;
}
#${TOOLTIP_ID}[data-placement-pref="bottom"] {
  position-area: bottom;
  position-try-fallbacks: flip-block;
  animation-name: tt-in-down, tt-fade;
  transform-origin: top;
}
#${TOOLTIP_ID}[data-placement-pref="left"] {
  position-area: left;
  position-try-fallbacks: flip-inline;
  animation-name: tt-in-left, tt-fade;
  transform-origin: right;
}
#${TOOLTIP_ID}[data-placement-pref="right"] {
  position-area: right;
  position-try-fallbacks: flip-inline;
  animation-name: tt-in-right, tt-fade;
  transform-origin: left;
}

/* Directional slides — transform only; opacity lives in tt-fade so the
   two can run on different durations/easings. */
@keyframes tt-in-up {
  from { transform: translateY(10px); }
  to   { transform: translateY(0); }
}
@keyframes tt-in-down {
  from { transform: translateY(-10px); }
  to   { transform: translateY(0); }
}
@keyframes tt-in-left {
  from { transform: translateX(10px); }
  to   { transform: translateX(0); }
}
@keyframes tt-in-right {
  from { transform: translateX(-10px); }
  to   { transform: translateX(0); }
}

/* Fade starts at 0 for maximum slickness. */
@keyframes tt-fade {
  from { opacity: 0; }
  to   { opacity: 1; }
}

/* ── The tail ─────────────────────────────────────────────────────────────
   Plain absolutely-positioned border triangle hanging off the tooltip's
   edge into the gap — no anchor() functions needed for the tail itself.
   Direction flips via anchored() container queries against the tooltip. */

#${TOOLTIP_ID}::before {
  content: "";
  position: absolute;
  border: var(--tt-tail) solid transparent;
}

/* pref=top: tooltip above trigger → tail on bottom edge, pointing down */
#${TOOLTIP_ID}[data-placement-pref="top"]::before {
  left: 50%;
  translate: -50% 0;
  bottom: calc(-1 * var(--tt-tail));
  border-bottom: none;
  border-top-color: var(--tt-bg);
}
@container anchored(fallback: flip-block) {
  #${TOOLTIP_ID}[data-placement-pref="top"]::before {
    bottom: auto;
    top: calc(-1 * var(--tt-tail));
    border-bottom: var(--tt-tail) solid var(--tt-bg);
    border-top: none;
  }
}

/* pref=bottom: tail on top edge, pointing up */
#${TOOLTIP_ID}[data-placement-pref="bottom"]::before {
  left: 50%;
  translate: -50% 0;
  top: calc(-1 * var(--tt-tail));
  border-top: none;
  border-bottom-color: var(--tt-bg);
}
@container anchored(fallback: flip-block) {
  #${TOOLTIP_ID}[data-placement-pref="bottom"]::before {
    top: auto;
    bottom: calc(-1 * var(--tt-tail));
    border-top: var(--tt-tail) solid var(--tt-bg);
    border-bottom: none;
  }
}

/* pref=left: tooltip left of trigger → tail on right edge, pointing right */
#${TOOLTIP_ID}[data-placement-pref="left"]::before {
  top: 50%;
  translate: 0 -50%;
  right: calc(-1 * var(--tt-tail));
  border-right: none;
  border-left-color: var(--tt-bg);
}
@container anchored(fallback: flip-inline) {
  #${TOOLTIP_ID}[data-placement-pref="left"]::before {
    right: auto;
    left: calc(-1 * var(--tt-tail));
    border-right: var(--tt-tail) solid var(--tt-bg);
    border-left: none;
  }
}

/* pref=right: tail on left edge, pointing left */
#${TOOLTIP_ID}[data-placement-pref="right"]::before {
  top: 50%;
  translate: 0 -50%;
  left: calc(-1 * var(--tt-tail));
  border-left: none;
  border-right-color: var(--tt-bg);
}
@container anchored(fallback: flip-inline) {
  #${TOOLTIP_ID}[data-placement-pref="right"]::before {
    left: auto;
    right: calc(-1 * var(--tt-tail));
    border-left: var(--tt-tail) solid var(--tt-bg);
    border-right: none;
  }
}

/* ── Fallback for browsers without CSS Anchor Positioning ────────────────
   The directive swaps to the native [title] attribute; the singleton is
   simply never shown. */

@supports not (anchor-name: --a) {
  #${TOOLTIP_ID} {
    display: none;
  }
}
`;
