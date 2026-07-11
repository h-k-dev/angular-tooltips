import {
  inject,
  Injectable,
  Directive,
  input,
  ElementRef,
  ApplicationRef,
  DestroyRef,
  TemplateRef,
  EmbeddedViewRef,
  DOCUMENT,
  OnDestroy,
  OnInit,
} from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

/** Which positioning engine a trigger directive drives. */
export type TooltipMethod = 'anchor' | 'js';

/**
 * Template context for rich tooltip content. The implicit `let` variable
 * binds to the trigger's `[hkTooltipData]` / `[hkJsTooltipData]` input.
 */
export interface HkTooltipContext<T = unknown> {
  $implicit: T;
}

export type HkTooltipContent = string | TemplateRef<HkTooltipContext>;

/**
 * The contract every trigger directive fulfils towards the TooltipsManager.
 * The manager is the ONLY owner of the popover element, its content and the
 * positioning; directives are thin registrations that expose their signals.
 */
export interface TooltipTrigger {
  readonly anchorId: string;
  readonly hostEl: HTMLElement;
  readonly method: TooltipMethod;
  readonly content: () => HkTooltipContent;
  readonly data: () => unknown;
  readonly placement: () => TooltipPlacement;
  readonly showDelay: () => number;
  readonly hideDelay: () => number;
}

/**
 * Feature check the two directives split on: `[hkTooltip]` requires it and
 * throws without it; `[hkJsTooltip]` refuses to run with it. Use it to
 * branch your own templates (`@if (supportsAnchorPositioning()) { … }`).
 * Deliberately not cached so tests can stub `CSS.supports`.
 */
export function supportsAnchorPositioning(): boolean {
  return typeof CSS !== 'undefined' && !!CSS.supports?.('anchor-name', '--a');
}

/** Singleton popover element id — also the `interestfor` target id. */
export const TOOLTIP_ID = 'hk-tooltip';

const CLASS_BASE = 'hk-tooltip';
const CLASS_ANCHOR = 'hk-tooltip--anchor';
const CLASS_JS = 'hk-tooltip--js';

/**
 * The only metadata that lives on the host element. Everything else
 * (content, placement, delays) is read live off the registered directive —
 * attributes can't carry a TemplateRef, and signal values shouldn't need a
 * DOM round-trip.
 */
const ATTR_ANCHOR_ID = 'data-tooltip-id';

/**
 * Interest Invokers (`interestfor`) feature detection. The reflected IDL
 * attribute is `interestForElement`; if it exists on anchors, the browser
 * handles hover *and* focus *and* touch long-press *and* delays natively.
 */
const INTEREST_FOR_SUPPORTED =
  typeof HTMLAnchorElement !== 'undefined' && 'interestForElement' in HTMLAnchorElement.prototype;

let _uid = 0;

/** Internal: unique per-trigger id shared by both directives. */
export function nextTooltipAnchorId(): string {
  return `tt-${(++_uid).toString(36)}`;
}

const OPPOSITE: Record<TooltipPlacement, TooltipPlacement> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

// ─── TooltipsManager ─────────────────────────────────────────────────────────
// The service exclusively manages the singleton popover element, its content
// (string fast path / lazily stamped embedded views) and show/hide state.
// Trigger directives only register themselves; the async content cache is the
// HkTooltipCache service next door.
//
// Trigger paths sharing the one popover:
//
//  1. `interestfor` path — <a href> hosts of the anchor directive in
//     supporting browsers. The BROWSER owns showing/hiding, delays (via CSS
//     interest-delay-*), keyboard interest, and touch long-press. The only
//     JS left is the `interest` event listener that renders content +
//     position-anchor before the popover opens.
//
//  2. JS-delegation path — every other trigger of either directive:
//     delegated hover/focus listeners, timers, showPopover().
//
// Positioning is per-method:
//   'anchor' → 100% CSS (position-anchor, position-area, position-try
//              fallbacks, anchored container queries for the tail).
//   'js'     → tippy-style math: rects + flip + clamp, re-run on
//              scroll/resize while open, resolved side in [data-placement].
//
// Both paths resolve the trigger directive from a registry by anchor id,
// then read content/placement/delays live off its signals. String content
// stays a bare textContent write; TemplateRef content is stamped as an
// embedded view — created lazily on show, destroyed on hide/swap.

@Injectable({ providedIn: 'root' })
export class TooltipsManager {
  #tooltipEl: HTMLElement | null = null;

  #showTimer: ReturnType<typeof setTimeout> | null = null;
  #hideTimer: ReturnType<typeof setTimeout> | null = null;
  #activeId: string | null = null;
  #activeView: EmbeddedViewRef<HkTooltipContext> | null = null;
  #stopJsTracking: (() => void) | null = null;

  #delegationRoots = new Map<Element, () => void>();
  #registry = new Map<string, TooltipTrigger>();

  readonly #doc = inject(DOCUMENT);
  readonly #appRef = inject(ApplicationRef);

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Every trigger directive registers on construction and unregisters on destroy. */
  register(dir: TooltipTrigger): void {
    this.#registry.set(dir.anchorId, dir);
    this.ensureBodyDelegation();
  }

  unregister(dir: TooltipTrigger): void {
    this.#registry.delete(dir.anchorId);
    if (this.#activeId === dir.anchorId) this.#hide();
  }

  registerRoot(root: Element): void {
    if (this.#delegationRoots.has(root)) return;
    this.#ensureInit();

    const over = (e: MouseEvent) => {
      const dir = this.#delegatedDir(e.target as Element);
      if (dir) this.#scheduleShow(dir, dir.showDelay());
    };

    const out = (e: MouseEvent) => {
      const src = (e.target as Element).closest(`[${ATTR_ANCHOR_ID}]`);
      if (src?.hasAttribute('interestfor')) return;
      const related = e.relatedTarget as Element | null;
      if (related?.closest(`[${ATTR_ANCHOR_ID}]`)) return;
      if (related === this.#tooltipEl || this.#tooltipEl?.contains(related)) return;
      const dir = src ? this.#registry.get(src.getAttribute(ATTR_ANCHOR_ID) ?? '') : undefined;
      this.#scheduleHide(dir?.hideDelay() ?? 80);
    };

    const focus = (e: FocusEvent) => {
      const dir = this.#delegatedDir(e.target as Element);
      if (dir) this.#scheduleShow(dir, 0);
    };

    const blur = (e: FocusEvent) => {
      const src = (e.target as Element).closest?.(`[${ATTR_ANCHOR_ID}]`);
      if (src?.hasAttribute('interestfor')) return;
      this.#scheduleHide(80);
    };

    root.addEventListener('mouseover', over as EventListener);
    root.addEventListener('mouseout', out as EventListener);
    root.addEventListener('focusin', focus as EventListener);
    root.addEventListener('focusout', blur as EventListener);

    this.#delegationRoots.set(root, () => {
      root.removeEventListener('mouseover', over as EventListener);
      root.removeEventListener('mouseout', out as EventListener);
      root.removeEventListener('focusin', focus as EventListener);
      root.removeEventListener('focusout', blur as EventListener);
    });
  }

  unregisterRoot(root: Element): void {
    this.#delegationRoots.get(root)?.();
    this.#delegationRoots.delete(root);
  }

  ensureBodyDelegation(): void {
    this.registerRoot(this.#doc.body);
  }

  /**
   * Point the singleton at a trigger. Content, placement and anchor come
   * live off the directive's signals; positioning strategy follows the
   * trigger's method. Used by both paths — the interest path calls it from
   * the `interest` event (where the browser then opens the popover itself;
   * the showPopover() below is a no-op-guard for that case).
   */
  show(dir: TooltipTrigger): void {
    if (!this.#registry.has(dir.anchorId) || !this.#hasContent(dir)) return;
    this.#ensureInit();
    const el = this.#tooltipEl!;

    this.#clearShowTimer();
    this.#clearHideTimer();

    if (this.#activeId === dir.anchorId && el.matches(':popover-open')) return;
    this.#activeId = dir.anchorId;

    this.#render(dir);
    this.#applyMethod(dir);

    if (!el.matches(':popover-open')) el.showPopover();

    // JS engine can only measure once the popover renders.
    if (dir.method === 'js') this.#trackJs(dir);
  }

  // ── Positioning ────────────────────────────────────────────────────────────

  /**
   * Each trigger method injects its own class on the popover so only that
   * engine's stylesheet rules apply, and clears the other engine's residue.
   */
  #applyMethod(dir: TooltipTrigger): void {
    const el = this.#tooltipEl!;
    el.classList.toggle(CLASS_ANCHOR, dir.method === 'anchor');
    el.classList.toggle(CLASS_JS, dir.method === 'js');
    this.#stopJs();

    if (dir.method === 'anchor') {
      el.style.removeProperty('left');
      el.style.removeProperty('top');
      el.removeAttribute('data-placement');
      el.style.setProperty('position-anchor', `--${dir.anchorId}`);
      el.setAttribute('data-placement-pref', dir.placement());
    } else {
      el.style.removeProperty('position-anchor');
      el.removeAttribute('data-placement-pref');
    }
  }

  /** JS engine: position now and follow the anchor while open. */
  #trackJs(dir: TooltipTrigger): void {
    this.#positionJs(dir);
    const win = this.#doc.defaultView;
    if (!win) return;
    const update = () => this.#positionJs(dir);
    win.addEventListener('scroll', update, { capture: true, passive: true });
    win.addEventListener('resize', update, { passive: true });
    this.#stopJsTracking = () => {
      win.removeEventListener('scroll', update, { capture: true });
      win.removeEventListener('resize', update);
    };
  }

  #stopJs(): void {
    this.#stopJsTracking?.();
    this.#stopJsTracking = null;
  }

  /**
   * Tippy-style placement: preferred side, flip to the opposite side when
   * the viewport runs out, clamp ("shift") along the cross axis. The
   * RESOLVED side lands in [data-placement] for the tail + animation CSS.
   */
  #positionJs(dir: TooltipTrigger): void {
    const el = this.#tooltipEl!;
    const win = this.#doc.defaultView;
    if (!win) return;

    const anchor = dir.hostEl.getBoundingClientRect();
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    const gap = parseFloat(win.getComputedStyle(el).getPropertyValue('--_tt-gap')) || 8;
    const pad = 4;
    const vw = win.innerWidth;
    const vh = win.innerHeight;

    const room: Record<TooltipPlacement, number> = {
      top: anchor.top,
      bottom: vh - anchor.bottom,
      left: anchor.left,
      right: vw - anchor.right,
    };
    const needs = (side: TooltipPlacement) =>
      (side === 'top' || side === 'bottom' ? tipH : tipW) + gap + pad;

    let placement = dir.placement();
    if (room[placement] < needs(placement) && room[OPPOSITE[placement]] >= needs(placement)) {
      placement = OPPOSITE[placement];
    }

    let x: number;
    let y: number;
    switch (placement) {
      case 'top':
        x = anchor.left + anchor.width / 2 - tipW / 2;
        y = anchor.top - gap - tipH;
        break;
      case 'bottom':
        x = anchor.left + anchor.width / 2 - tipW / 2;
        y = anchor.bottom + gap;
        break;
      case 'left':
        x = anchor.left - gap - tipW;
        y = anchor.top + anchor.height / 2 - tipH / 2;
        break;
      case 'right':
        x = anchor.right + gap;
        y = anchor.top + anchor.height / 2 - tipH / 2;
        break;
    }
    if (placement === 'top' || placement === 'bottom') {
      x = Math.min(Math.max(x, pad), Math.max(vw - tipW - pad, pad));
    } else {
      y = Math.min(Math.max(y, pad), Math.max(vh - tipH - pad, pad));
    }

    el.style.left = `${Math.round(x)}px`;
    el.style.top = `${Math.round(y)}px`;
    el.setAttribute('data-placement', placement);
  }

  // ── Registry / content helpers ─────────────────────────────────────────────

  /** Delegation helper: nearest registered trigger, unless the browser owns it. */
  #delegatedDir(target: Element): TooltipTrigger | null {
    const host = target.closest?.(`[${ATTR_ANCHOR_ID}]`);
    if (!host || host.hasAttribute('interestfor')) return null;
    return this.#registry.get(host.getAttribute(ATTR_ANCHOR_ID) ?? '') ?? null;
  }

  #hasContent(dir: TooltipTrigger): boolean {
    const content = dir.content();
    return typeof content === 'string' ? content.length > 0 : content != null;
  }

  /** Is the pointer or keyboard focus still on this trigger (or the tooltip)? */
  #isEngaged(dir: TooltipTrigger): boolean {
    return (
      dir.hostEl.matches(':hover') ||
      dir.hostEl.matches(':focus-within') ||
      (this.#tooltipEl?.matches(':hover') ?? false)
    );
  }

  /**
   * String content stays the fast path: one textContent write, no Angular.
   * A TemplateRef is stamped as an embedded view — created lazily here on
   * first show (so a resource() inside it fires only now), attached to
   * ApplicationRef so its signals keep driving change detection while open,
   * and rendered synchronously so positioning sees the real size.
   * `role="tooltip"` only fits plain text; template content is a hovercard,
   * not a tooltip, in ARIA terms, so the role is dropped while one is active.
   */
  #render(dir: TooltipTrigger): void {
    const el = this.#tooltipEl!;
    this.#destroyView();
    const content = dir.content();

    if (typeof content === 'string') {
      el.setAttribute('role', 'tooltip');
      el.textContent = content;
      return;
    }

    el.removeAttribute('role');
    el.textContent = '';
    const view = content.createEmbeddedView({ $implicit: dir.data() });
    this.#appRef.attachView(view);
    for (const node of view.rootNodes as Node[]) el.appendChild(node);
    view.detectChanges();
    this.#activeView = view;
  }

  #destroyView(): void {
    if (!this.#activeView) return;
    this.#activeView.destroy();
    this.#activeView = null;
    // destroy() tears the view down but leaves its root nodes parented here.
    if (this.#tooltipEl) this.#tooltipEl.textContent = '';
  }

  #hide(): void {
    this.#clearShowTimer();
    this.#clearHideTimer();
    this.#stopJs();
    this.#activeId = null;
    if (this.#tooltipEl?.matches(':popover-open')) this.#tooltipEl.hidePopover();
    this.#destroyView();
  }

  // ── Timer helpers (JS-delegation path only) ────────────────────────────────

  #scheduleShow(dir: TooltipTrigger, delay: number) {
    if (!this.#hasContent(dir)) return;
    this.#clearShowTimer();
    this.#clearHideTimer();
    if (delay > 0) {
      this.#showTimer = setTimeout(() => this.show(dir), delay);
    } else {
      this.show(dir);
    }
  }

  #scheduleHide(delay: number) {
    this.#clearShowTimer();
    this.#clearHideTimer();
    this.#hideTimer = setTimeout(() => this.#hide(), delay);
  }

  #clearShowTimer() {
    if (this.#showTimer) {
      clearTimeout(this.#showTimer);
      this.#showTimer = null;
    }
  }

  #clearHideTimer() {
    if (this.#hideTimer) {
      clearTimeout(this.#hideTimer);
      this.#hideTimer = null;
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  // No style injection here: the stylesheet ships as a global CSS file
  // (styles/angular-tooltips.css) imported once by the application.

  #ensureInit() {
    if (this.#tooltipEl) return;

    const el = this.#doc.createElement('div');
    el.id = TOOLTIP_ID;
    el.classList.add(CLASS_BASE);
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'tooltip');

    // ── interestfor path (anchor directive on <a href> hosts) ───────────
    // The `interest` event fires ON THE TARGET (this element), with
    // `event.source` = the invoker, BEFORE the browser's default action
    // opens the popover. That's exactly the hook we need to render the
    // content and re-point position-anchor at the right trigger.
    el.addEventListener('interest', (e: Event) => {
      const src = (e as Event & { source?: Element }).source ?? null;
      if (!(src instanceof HTMLElement)) return;
      const dir = this.#registry.get(src.getAttribute(ATTR_ANCHOR_ID) ?? '');
      // No content (yet): cancel the event, or the browser's default action
      // would open the popover empty — show() alone can't stop that.
      if (!dir || !this.#hasContent(dir)) {
        e.preventDefault();
        return;
      }
      this.show(dir);
    });

    // Losing interest: the browser hides the popover; we sync state and
    // drop any stamped view. (Interest is sustained while hovering the
    // tooltip itself, so hover-to-select-text — and interacting with rich
    // template content — works for free on this path.)
    //
    // Staleness guard: `loseinterest` fires interest-delay-end AFTER the
    // pointer left the invoker, so during a fast invoker → other-trigger
    // handoff it belongs to a PREVIOUS anchor. NEVER cancel it — a
    // cancelled loseinterest leaves the invoker permanently "interested"
    // and its next hover fires no interest event at all.
    el.addEventListener('loseinterest', (e: Event) => {
      const src = (e as Event & { source?: Element }).source ?? null;
      const id = src instanceof HTMLElement ? src.getAttribute(ATTR_ANCHOR_ID) : null;
      const active = this.#activeId !== null ? this.#registry.get(this.#activeId) : undefined;

      // Stale + engaged: do nothing ourselves. The browser will clear its
      // interest state and hide the popover on its own schedule (sync or a
      // later task — implementations differ); the beforetoggle guard below
      // restores it the moment that hide actually executes.
      if (active && id !== active.anchorId && this.#isEngaged(active)) return;
      this.#hide();
    });

    // ── Seamless-reopen guard ────────────────────────────────────────────
    // beforetoggle fires SYNCHRONOUSLY inside every popover hide, no matter
    // who initiated it or when. Library-initiated hides clear #activeId
    // before calling hidePopover(), so a hide that arrives here with an
    // active, still-engaged trigger can only be the browser closing over a
    // handed-off tooltip (stale interest loss). Reopen one microtask later —
    // after the hide completes, before the next paint — with the entrance
    // animation suppressed, so visually the tooltip never left.
    el.addEventListener('beforetoggle', (e: Event) => {
      if ((e as ToggleEvent).newState !== 'closed') return;
      const active = this.#activeId !== null ? this.#registry.get(this.#activeId) : undefined;
      if (!active || !this.#isEngaged(active)) return;
      queueMicrotask(() => {
        if (this.#activeId !== active.anchorId) return;
        if (el.matches(':popover-open')) return;
        el.style.animation = 'none';
        el.showPopover();
      });
    });

    // Whatever closed the popover (interest loss, JS): reset state and
    // drop any stamped view. The open-state guard covers the coalesced
    // toggle case where the popover was re-opened before this async event
    // fired — never tear down a view that a newer show() just stamped.
    el.addEventListener('toggle', (e: Event) => {
      if ((e as ToggleEvent).newState !== 'closed') return;
      if (el.matches(':popover-open')) return;
      this.#activeId = null;
      this.#stopJs();
      this.#destroyView();
      // If a seamless reopen suppressed the entrance animation, restore it
      // now that the popover is genuinely closed (invisible, so no restart).
      el.style.removeProperty('animation');
    });

    // JS-delegation path: hovering the tooltip cancels a pending hide.
    el.addEventListener('mouseover', () => this.#clearHideTimer());
    el.addEventListener('mouseout', () => {
      // Only relevant when JS owns the lifecycle; interest-driven hides
      // are handled by loseinterest above.
      if (this.#hideTimer || this.#activeId) this.#scheduleHide(80);
    });

    this.#doc.body.appendChild(el);
    this.#tooltipEl = el;

    this.registerRoot(this.#doc.body);
  }
}

// ─── hkTooltipRoot directive ──────────────────────────────────────────────────
// Scopes delegation to a subtree, e.g. a virtualized grid. Method-agnostic.

@Directive({
  selector: '[hkTooltipRoot]',
  standalone: true,
})
export class HkTooltipRoot implements OnInit, OnDestroy {
  readonly #manager = inject(TooltipsManager);
  readonly #el = inject(ElementRef<Element>);

  ngOnInit() {
    this.#manager.registerRoot(this.#el.nativeElement);
  }
  ngOnDestroy() {
    this.#manager.unregisterRoot(this.#el.nativeElement);
  }
}

// ─── HkTooltip directive — the complete CSS Anchor Positioning way ──────────
// Content is a plain string or a TemplateRef (rich, stamped lazily).
// Requires CSS Anchor Positioning and THROWS at construction without it:
// use the JS-positioned `hkJsTooltip` directive in those environments (the
// `supportsAnchorPositioning()` helper is exported for template branching).
//
// Trigger selection, per host element:
//
//   <a href …>  + Interest Invokers supported
//     → `interestfor` points at the singleton popover. The browser owns
//       show/hide, hover+focus+long-press semantics, and delays (mapped to
//       the CSS `interest-delay-start/end` properties from the same inputs).
//
//   anything else
//     → JS-delegation path via the anchor-id attribute + registry
//       (positioning still 100% CSS anchor).

@Directive({
  selector: '[hkTooltip]',
  standalone: true,
  host: {
    '[style.anchor-name]': 'anchorName',

    // The registry key — both trigger paths resolve the directive from it
    // and read content/placement/delays live off its signals.
    '[attr.data-tooltip-id]': 'anchorId',

    // interestfor path: browser-native trigger + CSS-native delays.
    '[attr.interestfor]': 'useInterest ? tooltipId : null',
    '[style.interest-delay-start]': 'useInterest ? showDelay() + "ms" : null',
    '[style.interest-delay-end]': 'useInterest ? hideDelay() + "ms" : null',
  },
})
export class HkTooltip implements TooltipTrigger {
  readonly #manager = inject(TooltipsManager);

  /** Host element — the manager reads live engagement state (:hover) off it. */
  readonly hostEl = inject(ElementRef<HTMLElement>).nativeElement;

  readonly method = 'anchor' as const;

  content = input.required<HkTooltipContent>({ alias: 'hkTooltip' });
  data = input<unknown>(undefined, { alias: 'hkTooltipData' });
  placement = input<TooltipPlacement>('top', { alias: 'hkTooltipPlacement' });
  showDelay = input<number>(0, { alias: 'hkTooltipDelay' });
  hideDelay = input<number>(80, { alias: 'hkTooltipHideDelay' });

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
      INTEREST_FOR_SUPPORTED &&
      this.hostEl instanceof HTMLAnchorElement &&
      this.hostEl.hasAttribute('href')
    );
  }

  constructor() {
    if (!supportsAnchorPositioning()) {
      throw new Error(
        '[hkTooltip] This environment has no CSS Anchor Positioning support. ' +
          'Use the JS-positioned `hkJsTooltip` directive here instead ' +
          '(branch with the exported supportsAnchorPositioning() helper).',
      );
    }

    this.anchorId = nextTooltipAnchorId();
    this.anchorName = `--${this.anchorId}`;
    this.#manager.register(this);

    inject(DestroyRef).onDestroy(() => this.#manager.unregister(this));
  }
}
