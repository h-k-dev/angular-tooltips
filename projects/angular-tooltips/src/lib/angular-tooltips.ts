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
} from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

/**
 * Template context for rich tooltip content. The implicit `let` variable
 * binds to the trigger's `[hkTooltipData]` input.
 */
export interface HkTooltipContext<T = unknown> {
  $implicit: T;
}

export type HkTooltipContent = string | TemplateRef<HkTooltipContext>;

/**
 * Platform requirements. Both checks are deliberately lazy (not cached) so
 * tests can stub `CSS.supports` and the element prototypes.
 */
export function supportsAnchorPositioning(): boolean {
  return typeof CSS !== 'undefined' && !!CSS.supports?.('anchor-name', '--a');
}

/**
 * Interest Invokers (`interestfor`). The reflected IDL attribute is
 * `interestForElement`; where it exists the browser handles hover *and*
 * focus *and* touch long-press *and* delays natively.
 */
export function supportsInterestInvokers(): boolean {
  return (
    typeof HTMLAnchorElement !== 'undefined' &&
    'interestForElement' in HTMLAnchorElement.prototype
  );
}

/** Singleton popover element id — every trigger's `interestfor` target. */
export const TOOLTIP_ID = 'hk-tooltip';

const CLASS_BASE = 'hk-tooltip';

/**
 * The ONE anchor name the popover follows. The manager moves it between
 * whichever invoker holds interest — many triggers, one bubble, zero
 * per-trigger ids or attributes.
 */
const INVOKER_ANCHOR = '--hk-invoker';

// ─── TooltipsManager ─────────────────────────────────────────────────────────
// The service exclusively manages the singleton popover element and its
// content (string fast path / lazily stamped embedded views). Everything
// else — showing, hiding, delays, hover/focus/long-press semantics — is the
// BROWSER's job via Interest Invokers:
//
//   * every [hkTooltip] host carries `interestfor` → this popover;
//   * the `interest` event fires on the popover BEFORE it opens, with
//     `event.source` = the invoker gaining interest — the manager renders
//     the content and moves the `--hk-invoker` anchor name onto the source;
//   * moving `anchor-name` is all CSS needs: position-area, the flip
//     fallbacks and the tail's anchored() queries re-resolve automatically,
//     even while the popover is open;
//   * `loseinterest` hides — with a staleness guard for fast invoker →
//     invoker handoffs (see below).
//
// String content stays a bare textContent write; TemplateRef content is
// stamped as an embedded view — created lazily on show, destroyed on
// hide/swap, so projected components run their full lifecycle (and a
// resource() inside one fires on first show, never eagerly). The async
// content cache is the HkTooltipCache service next door.

@Injectable({ providedIn: 'root' })
export class TooltipsManager {
  #tooltipEl: HTMLElement | null = null;
  #active: HkTooltip | null = null;
  #activeView: EmbeddedViewRef<HkTooltipContext> | null = null;

  #registry = new Map<HTMLElement, HkTooltip>();

  readonly #doc = inject(DOCUMENT);
  readonly #appRef = inject(ApplicationRef);

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Every trigger directive registers on construction and unregisters on destroy. */
  register(dir: HkTooltip): void {
    this.#registry.set(dir.hostEl, dir);
    this.#ensureInit();
  }

  unregister(dir: HkTooltip): void {
    this.#registry.delete(dir.hostEl);
    // Never leave the singleton anchored to a removed element, or an
    // embedded view alive past its declaring component.
    if (this.#active === dir) {
      dir.hostEl.style.removeProperty('anchor-name');
      this.#hide();
    }
  }

  /**
   * Render + re-point the singleton at a trigger. Called from the
   * `interest` event (where the browser then opens the popover itself;
   * the showPopover() below is a no-op-guard for that case).
   */
  show(dir: HkTooltip): void {
    if (!this.#registry.has(dir.hostEl) || !this.#hasContent(dir)) return;
    const el = this.#tooltipEl!;

    if (this.#active === dir && el.matches(':popover-open')) return;

    this.#render(dir);
    this.#point(dir);

    if (!el.matches(':popover-open')) el.showPopover();
  }

  // ── Anchoring ──────────────────────────────────────────────────────────────

  /** Move the one anchor name onto the trigger gaining interest. */
  #point(dir: HkTooltip): void {
    const prev = this.#active;
    if (prev && prev !== dir) prev.hostEl.style.removeProperty('anchor-name');
    dir.hostEl.style.setProperty('anchor-name', INVOKER_ANCHOR);
    this.#tooltipEl!.setAttribute('data-placement-pref', dir.placement());
    this.#active = dir;
  }

  // ── Content ────────────────────────────────────────────────────────────────

  #hasContent(dir: HkTooltip): boolean {
    const content = dir.content();
    return typeof content === 'string' ? content.length > 0 : content != null;
  }

  /** Is the pointer or keyboard focus still on this trigger (or the tooltip)? */
  #isEngaged(dir: HkTooltip): boolean {
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
   * and rendered synchronously so anchor positioning sees the real size.
   * `role="tooltip"` only fits plain text; template content is a hovercard,
   * not a tooltip, in ARIA terms, so the role is dropped while one is active.
   */
  #render(dir: HkTooltip): void {
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
    this.#active = null;
    if (this.#tooltipEl?.matches(':popover-open')) this.#tooltipEl.hidePopover();
    this.#destroyView();
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  // No style injection here: the stylesheet ships as a global CSS file
  // (styles/angular-tooltips.css) imported once by the application. The
  // popover's own `position-anchor: --hk-invoker` lives there too.

  #ensureInit() {
    if (this.#tooltipEl) return;

    const el = this.#doc.createElement('div');
    el.id = TOOLTIP_ID;
    el.classList.add(CLASS_BASE);
    el.setAttribute('popover', 'manual');
    el.setAttribute('role', 'tooltip');

    // The `interest` event fires ON THE TARGET (this element), with
    // `event.source` = the invoker, BEFORE the browser's default action
    // opens the popover — exactly the hook to render the content and
    // re-point the anchor at the right trigger.
    el.addEventListener('interest', (e: Event) => {
      const src = (e as Event & { source?: Element }).source ?? null;
      const dir = src instanceof HTMLElement ? this.#registry.get(src) : undefined;
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
    // template content — works for free.)
    //
    // Staleness guard: `loseinterest` fires interest-delay-end AFTER the
    // pointer left the invoker, so during a fast invoker → invoker handoff
    // it belongs to a PREVIOUS anchor. NEVER cancel it — a cancelled
    // loseinterest leaves the invoker permanently "interested" and its next
    // hover fires no interest event at all.
    el.addEventListener('loseinterest', (e: Event) => {
      const src = (e as Event & { source?: Element }).source ?? null;
      const dir = src instanceof HTMLElement ? this.#registry.get(src) : undefined;
      const active = this.#active;

      // Stale + engaged: do nothing ourselves. The browser will clear its
      // interest state and hide the popover on its own schedule (sync or a
      // later task — implementations differ); the beforetoggle guard below
      // restores it the moment that hide actually executes.
      if (active && dir !== active && this.#isEngaged(active)) return;
      this.#hide();
    });

    // ── Seamless-reopen guard ────────────────────────────────────────────
    // beforetoggle fires SYNCHRONOUSLY inside every popover hide, no matter
    // who initiated it or when. Library-initiated hides clear #active
    // before calling hidePopover(), so a hide that arrives here with an
    // active, still-engaged trigger can only be the browser closing over a
    // handed-off tooltip (stale interest loss). Reopen one microtask later —
    // after the hide completes, before the next paint — with the entrance
    // animation suppressed, so visually the tooltip never left.
    el.addEventListener('beforetoggle', (e: Event) => {
      if ((e as ToggleEvent).newState !== 'closed') return;
      const active = this.#active;
      if (!active || !this.#isEngaged(active)) return;
      queueMicrotask(() => {
        if (this.#active !== active) return;
        if (el.matches(':popover-open')) return;
        el.style.animation = 'none';
        el.showPopover();
      });
    });

    // Whatever closed the popover: reset state and drop any stamped view.
    // The open-state guard covers the coalesced toggle case where the
    // popover was re-opened before this async event fired — never tear
    // down a view that a newer show() just stamped.
    el.addEventListener('toggle', (e: Event) => {
      if ((e as ToggleEvent).newState !== 'closed') return;
      if (el.matches(':popover-open')) return;
      this.#active = null;
      this.#destroyView();
      // If a seamless reopen suppressed the entrance animation, restore it
      // now that the popover is genuinely closed (invisible, so no restart).
      el.style.removeProperty('animation');
    });

    this.#doc.body.appendChild(el);
    this.#tooltipEl = el;
  }
}

// ─── HkTooltip directive — interest-native anchor tooltips ──────────────────
// Content is a plain string or a TemplateRef (rich, stamped lazily on first
// show — so async content via resource() inside a projected component is
// lazy by construction).
//
// Triggering is Interest Invokers ONLY: the host must be a valid interest
// invoker (<button>, <a href>, <area href>). Positioning is 100% CSS Anchor
// Positioning. Missing platform support or an incompatible host THROWS at
// construction — early and loud instead of a silently degraded experience.

@Directive({
  selector: '[hkTooltip]',
  standalone: true,
  host: {
    // Browser-native trigger + CSS-native delays.
    '[attr.interestfor]': 'tooltipId',
    '[style.interest-delay-start]': 'showDelay() + "ms"',
    '[style.interest-delay-end]': 'hideDelay() + "ms"',
  },
})
export class HkTooltip {
  readonly #manager = inject(TooltipsManager);

  /** Host element — the anchor name lands here while this trigger is active. */
  readonly hostEl = inject(ElementRef<HTMLElement>).nativeElement;

  content = input.required<HkTooltipContent>({ alias: 'hkTooltip' });
  data = input<unknown>(undefined, { alias: 'hkTooltipData' });
  placement = input<TooltipPlacement>('top', { alias: 'hkTooltipPlacement' });
  showDelay = input<number>(0, { alias: 'hkTooltipDelay' });
  hideDelay = input<number>(80, { alias: 'hkTooltipHideDelay' });

  protected readonly tooltipId = TOOLTIP_ID;

  constructor() {
    if (!supportsAnchorPositioning() || !supportsInterestInvokers()) {
      throw new Error(
        '[hkTooltip] This environment lacks CSS Anchor Positioning and/or ' +
          'Interest Invokers (`interestfor`). This library is anchor-native ' +
          'only — there is no JS fallback.',
      );
    }
    if (!('interestForElement' in this.hostEl)) {
      throw new Error(
        `[hkTooltip] <${this.hostEl.tagName.toLowerCase()}> cannot be an ` +
          'interest invoker — use a <button>, <a href> or <area href> host.',
      );
    }
    this.#manager.register(this);
    inject(DestroyRef).onDestroy(() => this.#manager.unregister(this));
  }
}
