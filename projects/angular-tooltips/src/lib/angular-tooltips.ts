import {
  inject,
  Injectable,
  Directive,
  input,
  effect,
  untracked,
  booleanAttribute,
  numberAttribute,
  ElementRef,
  ApplicationRef,
  DestroyRef,
  TemplateRef,
  EmbeddedViewRef,
  DOCUMENT,
  Signal,
  InputSignal,
} from '@angular/core';

// ─── Types ────────────────────────────────────────────────────────────────────

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

/**
 * Which engine triggers a tooltip:
 *  - `invoker` — the browser, via Interest Invokers (`interestfor`);
 *  - `js`      — the directive, via pointer/focus listeners and timers.
 * Positioning is CSS Anchor Positioning for both.
 */
export type TooltipEngine = 'invoker' | 'js';

/**
 * Template context for rich tooltip content. The implicit `let` variable
 * binds to the trigger's `[hkTooltipData]` input.
 */
export interface HkTooltipContext<T = unknown> {
  $implicit: T;
}

export type HkTooltipContent = string | TemplateRef<HkTooltipContext>;

/**
 * The ONE contract every trigger directive fulfils — towards the manager and
 * towards consumers. `HkTooltip` (invoker engine) and `HkJsTooltip` (JS
 * engine) both implement it, so the public API is identical: the same inputs
 * (MatTooltip-style names), the same `show()` / `hide()` / `toggle()`.
 */
export interface HkTooltipTrigger {
  /** Host element — the anchor name lands here while this trigger is active. */
  readonly hostEl: HTMLElement;
  readonly engine: TooltipEngine;

  readonly content: Signal<HkTooltipContent>;
  readonly data: Signal<unknown>;
  readonly placement: Signal<TooltipPlacement>;
  readonly showDelay: Signal<number>;
  readonly hideDelay: Signal<number>;
  readonly disabled: Signal<boolean>;

  /** Show after `delay` ms (default: `showDelay`). */
  show(delay?: number): void;
  /** Hide after `delay` ms (default: `hideDelay`). */
  hide(delay?: number): void;
  toggle(): void;
  isVisible(): boolean;
}

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

/**
 * Can this element be an interest invoker (`<button>`, `<a href>`,
 * `<area href>`)? This is the line between the two engines: `hkTooltip`
 * requires it, `hkJsTooltip` refuses it.
 */
export function isInterestInvoker(el: Element): boolean {
  return 'interestForElement' in el;
}

/** Singleton popover element id — every invoker trigger's `interestfor` target. */
export const TOOLTIP_ID = 'hk-tooltip';

const CLASS_BASE = 'hk-tooltip';

/**
 * The ONE anchor name the popover follows. The manager moves it between
 * whichever trigger is active — many triggers, one bubble, zero per-trigger
 * ids or attributes.
 */
const INVOKER_ANCHOR = '--hk-invoker';

function assertPlatform(directive: string): void {
  if (!supportsAnchorPositioning() || !supportsInterestInvokers()) {
    throw new Error(
      `${directive} This environment lacks CSS Anchor Positioning and/or ` +
        'Interest Invokers (`interestfor`). This library is anchor-native ' +
        'only — there is no positioning fallback.',
    );
  }
}

// ─── TooltipsManager ─────────────────────────────────────────────────────────
// The service exclusively manages the singleton popover element, its content
// (string fast path / lazily stamped embedded views) and the ONE anchor name.
// Two engines feed it, and they blend because both end in the same two
// calls — show(trigger) / hide(trigger):
//
//   invoker — every [hkTooltip] host carries `interestfor` → this popover.
//     The `interest` event fires on the popover BEFORE it opens, with
//     `event.source` = the invoker gaining interest — the manager renders
//     the content and moves the `--hk-invoker` anchor name onto the source;
//     `loseinterest` hides. Hover/focus/long-press/delays are the browser's.
//
//   js — [hkJsTooltip] hosts (anything that can't be an invoker) listen for
//     pointer/focus themselves, run the delays, and call show()/hide().
//     Hovering the popover keeps a JS tooltip open; Escape and a pointerdown
//     outside close it — the same semantics the browser gives invokers.
//
// Moving `anchor-name` is all CSS needs: position-area, the flip fallbacks
// and the tail's anchored() queries re-resolve automatically, even while
// the popover is open. The name is removed again on every hide — a stale
// anchor-name on a previous host would win the tie (last in tree order) and
// put the bubble next to the wrong element.
//
// String content stays a bare textContent write; TemplateRef content is
// stamped as an embedded view — created lazily on show, destroyed on
// hide/swap, so projected components run their full lifecycle (and a
// resource() inside one fires on first show, never eagerly). The async
// content cache is the HkTooltipCache service next door.

@Injectable({ providedIn: 'root' })
export class TooltipsManager {
  #tooltipEl: HTMLElement | null = null;
  #active: HkTooltipTrigger | null = null;
  /** The host currently carrying the anchor name (may outlive #active by a tick). */
  #anchored: HTMLElement | null = null;
  /** Trigger the browser closed over while it was still engaged — reopen ASAP. */
  #pendingReopen: HkTooltipTrigger | null = null;
  #activeView: EmbeddedViewRef<HkTooltipContext> | null = null;

  #registry = new Map<HTMLElement, HkTooltipTrigger>();

  readonly #doc = inject(DOCUMENT);
  readonly #appRef = inject(ApplicationRef);

  // ── Public API ─────────────────────────────────────────────────────────────

  /** Every trigger directive registers on construction and unregisters on destroy. */
  register(dir: HkTooltipTrigger): void {
    this.#registry.set(dir.hostEl, dir);
    this.#ensureInit();
  }

  unregister(dir: HkTooltipTrigger): void {
    this.#registry.delete(dir.hostEl);
    // Never leave the singleton anchored to a removed element, or an
    // embedded view alive past its declaring component.
    if (this.#active === dir) this.#hide();
    else if (this.#anchored === dir.hostEl) this.#unanchor();
  }

  /**
   * Render + re-point the singleton at a trigger and open it. Both engines
   * end here: the invoker engine from the `interest` event (where the
   * browser then opens the popover itself — the showPopover() below is a
   * no-op guard for that case), the JS engine from its own listeners.
   */
  show(dir: HkTooltipTrigger): void {
    if (!this.#registry.has(dir.hostEl) || !this.#showable(dir)) return;
    const el = this.#tooltipEl!;

    if (this.#active === dir && el.matches(':popover-open')) return;

    this.#render(dir);
    this.#point(dir);

    if (!el.matches(':popover-open')) el.showPopover();
  }

  /** Hide — only if `dir` is the trigger currently shown. */
  hide(dir: HkTooltipTrigger): void {
    if (this.#active === dir) this.#hide();
  }

  /** Re-render content and placement of the active trigger in place. */
  refresh(dir: HkTooltipTrigger): void {
    if (this.#active !== dir || !this.#tooltipEl?.matches(':popover-open')) return;
    if (!this.#showable(dir)) {
      this.#hide();
      return;
    }
    this.#render(dir);
    this.#point(dir);
  }

  isVisible(dir: HkTooltipTrigger): boolean {
    return this.#active === dir && (this.#tooltipEl?.matches(':popover-open') ?? false);
  }

  // ── Anchoring ──────────────────────────────────────────────────────────────

  /** Move the one anchor name onto the trigger being shown. */
  #point(dir: HkTooltipTrigger): void {
    if (this.#anchored !== dir.hostEl) {
      this.#unanchor();
      dir.hostEl.style.setProperty('anchor-name', INVOKER_ANCHOR);
      this.#anchored = dir.hostEl;
    }
    this.#tooltipEl!.setAttribute('data-placement-pref', dir.placement());
    this.#active = dir;
  }

  #unanchor(): void {
    this.#anchored?.style.removeProperty('anchor-name');
    this.#anchored = null;
  }

  // ── Content ────────────────────────────────────────────────────────────────

  #showable(dir: HkTooltipTrigger): boolean {
    if (dir.disabled()) return false;
    const content = dir.content();
    return typeof content === 'string' ? content.length > 0 : content != null;
  }

  /** Is the pointer or keyboard focus still on this trigger (or the tooltip)? */
  #isEngaged(dir: HkTooltipTrigger): boolean {
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
  #render(dir: HkTooltipTrigger): void {
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
    this.#pendingReopen = null;
    if (this.#tooltipEl?.matches(':popover-open')) this.#tooltipEl.hidePopover();
    this.#destroyView();
    this.#unanchor();
  }

  /** Complete a seamless reopen (see the beforetoggle listener) if one is due. */
  #reopenIfPending(): void {
    const dir = this.#pendingReopen;
    if (!dir) return;
    this.#pendingReopen = null;
    const el = this.#tooltipEl!;
    if (this.#active !== dir || el.matches(':popover-open')) return;
    el.style.animation = 'none';
    el.showPopover();
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

    // ── Invoker engine ──────────────────────────────────────────────────
    // The `interest` event fires ON THE TARGET (this element), with
    // `event.source` = the invoker, BEFORE the browser's default action
    // opens the popover — exactly the hook to render the content and
    // re-point the anchor at the right trigger.
    el.addEventListener('interest', (e: Event) => {
      const src = (e as Event & { source?: Element }).source ?? null;
      const dir = src instanceof HTMLElement ? this.#registry.get(src) : undefined;
      // Disabled / no content (yet): cancel the event, or the browser's
      // default action would open the popover empty — show() alone can't
      // stop that.
      if (!dir || !this.#showable(dir)) {
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
    // pointer left the invoker, so during a fast handoff — to another
    // invoker, or to a JS trigger — it belongs to a PREVIOUS anchor. NEVER
    // cancel it — a cancelled loseinterest leaves the invoker permanently
    // "interested" and its next hover fires no interest event at all.
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
    // handed-off tooltip (stale interest loss — e.g. an invoker's delay-end
    // firing after the pointer already moved on to a JS trigger). Reopen
    // after the hide completes but before the next paint, with the entrance
    // animation suppressed, so visually the tooltip never left.
    //
    // "After the hide completes" is NOT a microtask: the browser dispatches
    // beforetoggle from inside its hide algorithm and runs a microtask
    // checkpoint right after each listener returns — still inside the hide,
    // with :popover-open still matching, and showPopover() would throw. The
    // hide is done when the browser's task ends; whichever comes first — the
    // queued toggle task, or the next frame's rAF callbacks — performs the
    // reopen, and both run before anything is painted.
    el.addEventListener('beforetoggle', (e: Event) => {
      if ((e as ToggleEvent).newState !== 'closed') return;
      const active = this.#active;
      if (!active || !this.#isEngaged(active)) return;
      this.#pendingReopen = active;
      const win = this.#doc.defaultView;
      if (win?.requestAnimationFrame) win.requestAnimationFrame(() => this.#reopenIfPending());
      else setTimeout(() => this.#reopenIfPending(), 0);
    });

    // Whatever closed the popover: reset state and drop any stamped view.
    // The open-state guard covers the coalesced toggle case where the
    // popover was re-opened before this async event fired — never tear
    // down a view that a newer show() just stamped.
    el.addEventListener('toggle', (e: Event) => {
      if ((e as ToggleEvent).newState !== 'closed') return;
      this.#reopenIfPending();
      if (el.matches(':popover-open')) return;
      this.#active = null;
      this.#destroyView();
      this.#unanchor();
      // If a seamless reopen suppressed the entrance animation, restore it
      // now that the popover is genuinely closed (invisible, so no restart).
      el.style.removeProperty('animation');
    });

    // ── JS engine ───────────────────────────────────────────────────────
    // What the browser does for invokers, done here for JS triggers:
    // hovering the popover sustains it; Escape and a pointerdown outside
    // the trigger + popover dismiss it.
    el.addEventListener('pointerenter', () => {
      if (this.#active?.engine === 'js') this.#active.show(0);
    });
    el.addEventListener('pointerleave', () => {
      if (this.#active?.engine === 'js') this.#active.hide();
    });
    this.#doc.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.#active?.engine === 'js') this.#active.hide(0);
    });
    this.#doc.addEventListener('pointerdown', (e: PointerEvent) => {
      const active = this.#active;
      if (active?.engine !== 'js') return;
      const target = e.target as Node | null;
      if (target && (active.hostEl.contains(target) || el.contains(target))) return;
      active.hide(0);
    });

    this.#doc.body.appendChild(el);
    this.#tooltipEl = el;
  }
}

// ─── HkTooltipBase — the shared, MatTooltip-shaped API ──────────────────────
// Everything both engines have in common lives here: the inputs (identical
// names on both directives), the programmatic show/hide/toggle with their
// delays, registration, and a live refresh while open. Concrete directives
// add only their engine, their content input alias, and (JS) their
// listeners.

@Directive()
export abstract class HkTooltipBase implements HkTooltipTrigger {
  protected readonly manager = inject(TooltipsManager);

  readonly hostEl = inject(ElementRef<HTMLElement>).nativeElement;

  abstract readonly engine: TooltipEngine;
  /** Tooltip text or template — aliased to the selector on each directive. */
  abstract readonly content: InputSignal<HkTooltipContent>;

  readonly data = input<unknown>(undefined, { alias: 'hkTooltipData' });
  readonly placement = input<TooltipPlacement>('top', { alias: 'hkTooltipPlacement' });
  readonly showDelay = input(0, { alias: 'hkTooltipShowDelay', transform: numberAttribute });
  readonly hideDelay = input(80, { alias: 'hkTooltipHideDelay', transform: numberAttribute });
  readonly disabled = input(false, { alias: 'hkTooltipDisabled', transform: booleanAttribute });

  #showTimer: ReturnType<typeof setTimeout> | null = null;
  #hideTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.manager.register(this);

    // Keep an OPEN tooltip live: content, data, placement or disabled
    // changing while shown re-renders in place (or hides when disabled).
    effect(() => {
      this.content();
      this.data();
      this.placement();
      this.disabled();
      untracked(() => this.manager.refresh(this));
    });

    inject(DestroyRef).onDestroy(() => {
      this.#clearTimers();
      this.manager.unregister(this);
    });
  }

  show(delay: number = this.showDelay()): void {
    this.#clearTimers();
    if (delay <= 0) {
      this.manager.show(this);
      return;
    }
    this.#showTimer = setTimeout(() => {
      this.#showTimer = null;
      this.manager.show(this);
    }, delay);
  }

  hide(delay: number = this.hideDelay()): void {
    this.#clearTimers();
    if (delay <= 0) {
      this.manager.hide(this);
      return;
    }
    this.#hideTimer = setTimeout(() => {
      this.#hideTimer = null;
      this.manager.hide(this);
    }, delay);
  }

  toggle(): void {
    if (this.isVisible()) this.hide(0);
    else this.show(0);
  }

  isVisible(): boolean {
    return this.manager.isVisible(this);
  }

  #clearTimers(): void {
    if (this.#showTimer) clearTimeout(this.#showTimer);
    if (this.#hideTimer) clearTimeout(this.#hideTimer);
    this.#showTimer = this.#hideTimer = null;
  }
}

// ─── HkTooltip — the invoker engine ─────────────────────────────────────────
// Triggering is Interest Invokers ONLY: the host must be a valid interest
// invoker (<button>, <a href>, <area href>) — anything else belongs to
// `hkJsTooltip`. Missing platform support or an incompatible host THROWS at
// construction — early and loud instead of a silently degraded experience.

@Directive({
  selector: '[hkTooltip]',
  exportAs: 'hkTooltip',
  standalone: true,
  host: {
    // Browser-native trigger + CSS-native delays.
    '[attr.interestfor]': 'disabled() ? null : tooltipId',
    '[style.interest-delay-start]': 'showDelay() + "ms"',
    '[style.interest-delay-end]': 'hideDelay() + "ms"',
  },
})
export class HkTooltip extends HkTooltipBase {
  readonly engine = 'invoker' as const;
  readonly content = input.required<HkTooltipContent>({ alias: 'hkTooltip' });

  protected readonly tooltipId = TOOLTIP_ID;

  constructor() {
    // Checks run BEFORE registration so a throwing constructor leaves
    // nothing behind in the manager.
    const hostEl = inject(ElementRef<HTMLElement>).nativeElement;
    assertPlatform('[hkTooltip]');
    if (!isInterestInvoker(hostEl)) {
      throw new Error(
        `[hkTooltip] <${hostEl.tagName.toLowerCase()}> cannot be an interest ` +
          'invoker — use a <button>, <a href> or <area href> host, or ' +
          '`hkJsTooltip` for any other element.',
      );
    }
    super();
  }
}
